import cropsData from '../simulation/data/crops.json';
import type { TracedFieldData } from '../components/FieldTracerMap';
import type { RotationSlotInput, SurveyModalOutput } from '../components/FieldSurveyModal';
import type { NasaFieldEnvironment } from './nasaClimateService';
import { supabase } from './supabaseService';

export interface RotationStrategy {
  id: string;
  name: string;
  badge: string;
  summary: string;
  expected_benefits: {
    water_savings_pct: number;
    soil_organic_gain_pct: number;
    pest_risk_reduction_pct: number;
    estimated_yield_index: number;
  };
  schedule: RotationSlotInput[];
  agronomist_rationale: string;
}

export interface GroundRadarAnalysisResult {
  field_profile: {
    latitude: number;
    longitude: number;
    area_acres: number;
    mode: 'farm' | 'garden';
    elevation_m: number;
    slope_percent: number;
    soil_texture: string;
    drainage_class: string;
    hydrologic_group: string;
    organic_matter_level: 'low' | 'medium' | 'high';
    drainage_runoff_risk: 'low' | 'medium' | 'high';
    ground_truth_photo_count: number;
    ground_truth_diagnosis: string;
    vision_ai_verified: boolean;
  };
  nasa_environment: NasaFieldEnvironment;
  survey: SurveyModalOutput;
  strategies: RotationStrategy[];
  check_locally: string[];
}

async function inspectFieldPhotosWithGeminiVision(
  photosBase64: string[],
  photoNotes: string,
  nasaEnv: NasaFieldEnvironment,
  targetCropName: string
): Promise<{ diagnosis: string; localChecks: string[]; verified: boolean } | null> {
  if (!supabase || photosBase64.length === 0) return null;

  try {
    const imageParts = photosBase64.slice(0, 6).map((dataUrl) => {
      const [header, data] = dataUrl.split(',');
      const mimeMatch = header.match(/data:(.*?);base64/);
      return {
        mime_type: mimeMatch ? mimeMatch[1] : 'image/jpeg',
        data,
      };
    });

    const prompt = `You are a NASA Space Apps agricultural remote-sensing agronomist.
Inspect these ${imageParts.length} ground-truth field photos to downscale coarse satellite pixels to plot scale.
Satellite & Soil Baseline:
- Soil: ${nasaEnv.soil.texture_class} (${nasaEnv.soil.sand_pct}% sand, ${nasaEnv.soil.silt_pct}% silt, ${nasaEnv.soil.clay_pct}% clay), Drainage: ${nasaEnv.soil.drainage_class} (Group ${nasaEnv.soil.hydrologic_group}), Organic Carbon: ${nasaEnv.soil.organic_carbon_g_kg} g/kg
- NASA POWER / SMAP: ${Math.round(nasaEnv.climate_summary.mean_surface_moisture * 100)}% surface moisture, ${Math.round(nasaEnv.climate_summary.mean_soil_moisture * 100)}% root-zone moisture, ${nasaEnv.climate_summary.annual_rainfall_mm} mm/yr rain, ${nasaEnv.climate_summary.annual_et_mm} mm/yr ET
- NASA SRTM Terrain: ${nasaEnv.elevation_m}m elevation, ${nasaEnv.slope_percent}% slope
- Target Crop: ${targetCropName}
- Farmer Notes: "${photoNotes || 'None'}"

Respond ONLY with valid JSON (no markdown fences):
{
  "diagnosis": "2-3 concise sentences describing what you visually observe in the photos (soil color/crusting/compaction, surface wetness/ponding, existing weeds/residue, nearby water/slope) and how it refines the NASA satellite data.",
  "localChecks": ["Actionable field check #1 based on the photos + NASA data", "Actionable field check #2"]
}`;

    const { data: geminiData, error } = await supabase.functions.invoke<{ text?: string }>('gemini', {
      body: { prompt, images: imageParts, temperature: 0.3 },
    });

    if (error) throw error;
    const rawText = geminiData?.text || '';
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (typeof parsed.diagnosis === 'string') {
      return {
        diagnosis: parsed.diagnosis,
        localChecks: Array.isArray(parsed.localChecks) ? parsed.localChecks : [],
        verified: true,
      };
    }
    return null;
  } catch (err) {
    console.warn('Gemini Vision inspection fallback activated:', err);
    return null;
  }
}

export async function generateRotationAnalysis(
  field: TracedFieldData,
  survey: SurveyModalOutput,
  nasaEnv: NasaFieldEnvironment
): Promise<GroundRadarAnalysisResult> {
  const targetCropId = survey.planned_rotation[0]?.crops[0] || 'tomato';
  const pastCropId = survey.past_rotation[0]?.crops[0] || '';
  const cropsMap = cropsData.crops as Record<
    string,
    { display_name: string; family: string; nutrient_role: string; water_need: string; fits: string[] }
  >;

  const targetCrop = cropsMap[targetCropId] || {
    display_name: targetCropId,
    family: 'solanaceae',
    nutrient_role: 'heavy_feeder',
    water_need: 'medium',
    fits: ['farm', 'garden'],
  };

  // Run live Gemini Multimodal Vision inspection on the 3–6 field photos
  const visionResult = await inspectFieldPhotosWithGeminiVision(
    survey.photosBase64,
    survey.photoNotes,
    nasaEnv,
    targetCrop.display_name
  );

  const isLowMoisture = nasaEnv.climate_summary.mean_soil_moisture < 0.45;
  const isSloped = nasaEnv.slope_percent >= 3.0;
  const sameFamilyCarryover = Boolean(pastCropId && cropsMap[pastCropId]?.family === targetCrop.family);

  const notesLower = survey.photoNotes.toLowerCase();
  const hasWaterNote =
    notesLower.includes('puddle') ||
    notesLower.includes('creek') ||
    notesLower.includes('water') ||
    notesLower.includes('wet');

  const drainageRisk: 'low' | 'medium' | 'high' =
    isSloped ||
    hasWaterNote ||
    nasaEnv.soil.clay_pct >= 35 ||
    nasaEnv.soil.hydrologic_group === 'D'
      ? 'high'
      : nasaEnv.soil.clay_pct >= 25 || nasaEnv.soil.hydrologic_group === 'C'
      ? 'medium'
      : 'low';

  const photoDiagnosis =
    visionResult?.diagnosis ||
    (survey.photosBase64.length >= 3
      ? `Synthesized across ${survey.photosBase64.length} multi-angle ground-truth photos with ${nasaEnv.soil.source_label} (${nasaEnv.soil.texture_class}, ${nasaEnv.soil.drainage_class}) and ${nasaEnv.slope_percent}% NASA SRTM slope.`
      : `Derived from NASA POWER/SMAP (${Math.round(nasaEnv.climate_summary.mean_soil_moisture * 100)}% root-zone moisture) and ${nasaEnv.soil.source_label}.`);

  const legumeCrop = survey.mode === 'farm' ? 'soybean' : 'bush_bean';
  const coolCoverCrop = nasaEnv.soil.clay_pct >= 28 ? 'tillage_radish' : 'crimson_clover';
  const winterGrassCover = 'winter_rye';
  const warmCoverCrop = survey.mode === 'farm' ? 'sorghum_sudangrass' : 'buckwheat';

  const strategies: RotationStrategy[] = [
    {
      id: 'soil_regenerative',
      name: 'Soil & Moisture Regenerative Plan',
      badge: 'Recommended for Soil Health',
      summary: `Pairs ${targetCrop.display_name} with nitrogen-fixing legumes and overwintering cover crops to increase organic matter and buffer ${nasaEnv.climate_summary.annual_et_mm} mm/yr evapotranspiration.`,
      expected_benefits: {
        water_savings_pct: isLowMoisture ? 24 : 16,
        soil_organic_gain_pct: 22,
        pest_risk_reduction_pct: sameFamilyCarryover ? 42 : 28,
        estimated_yield_index: 88,
      },
      schedule: [
        { year: 1, season: 'warm_season', crops: [targetCropId] },
        { year: 1, season: 'cool_season', crops: [coolCoverCrop, winterGrassCover] },
        { year: 2, season: 'warm_season', crops: [legumeCrop] },
        { year: 2, season: 'cool_season', crops: ['oats'] },
      ],
      agronomist_rationale: `NASA POWER records ${nasaEnv.climate_summary.frost_free_weeks} frost-free weeks and ${nasaEnv.climate_summary.annual_rainfall_mm} mm/yr rainfall vs. ${nasaEnv.climate_summary.annual_et_mm} mm/yr ET. Following ${targetCrop.display_name} with ${cropsMap[coolCoverCrop]?.display_name} and ${cropsMap[legumeCrop]?.display_name} builds infiltration in ${nasaEnv.soil.texture_class} (${nasaEnv.soil.drainage_class}).`,
    },
    {
      id: 'pest_disease_break',
      name: '3-Family Pest & Pathogen Break',
      badge: sameFamilyCarryover ? 'Fixes Family Carryover' : 'Disease Shield',
      summary: `Rotates across distinct botanical families (avoiding back-to-back ${targetCrop.family}) to interrupt soil-borne pests and root pathogens.`,
      expected_benefits: {
        water_savings_pct: 14,
        soil_organic_gain_pct: 15,
        pest_risk_reduction_pct: 48,
        estimated_yield_index: 91,
      },
      schedule: [
        { year: 1, season: 'warm_season', crops: [targetCropId] },
        { year: 1, season: 'cool_season', crops: ['onion'] },
        { year: 2, season: 'warm_season', crops: [warmCoverCrop] },
        { year: 2, season: 'cool_season', crops: ['hairy_vetch'] },
      ],
      agronomist_rationale: `Separating ${targetCrop.display_name} (${targetCrop.family}) with Amaryllidaceae (Onions) and Polygonaceae/Poaceae cover prevents host-specific nematodes and fungal carryover.`,
    },
    {
      id: 'water_income_balanced',
      name: 'High-Return Water-Smart Rotation',
      badge: 'Balanced Harvest & Efficiency',
      summary: `Balances cash-crop harvest value with low-water-demand transitional crops tailored to your ${field.area_acres}-acre ${survey.mode} (${nasaEnv.soil.available_water_capacity} AWC).`,
      expected_benefits: {
        water_savings_pct: 20,
        soil_organic_gain_pct: 14,
        pest_risk_reduction_pct: 31,
        estimated_yield_index: 95,
      },
      schedule: [
        { year: 1, season: 'warm_season', crops: [targetCropId] },
        { year: 1, season: 'cool_season', crops: [survey.mode === 'farm' ? 'winter_wheat' : 'carrot'] },
        { year: 2, season: 'warm_season', crops: ['bush_bean'] },
        { year: 2, season: 'cool_season', crops: ['crimson_clover'] },
      ],
      agronomist_rationale: `Maximizes productive harvests across both warm and cool windows while keeping living roots anchored during winter precipitation on a ${nasaEnv.slope_percent}% slope.`,
    },
  ];

  const scored = [...strategies].sort((a, b) => {
    const score = (s: RotationStrategy) =>
      s.expected_benefits.water_savings_pct * survey.priorities.water +
      s.expected_benefits.soil_organic_gain_pct * survey.priorities.soil_health +
      s.expected_benefits.pest_risk_reduction_pct * survey.priorities.pests +
      s.expected_benefits.estimated_yield_index * survey.priorities.income;
    return score(b) - score(a);
  });

  const checkLocally: string[] =
    visionResult?.localChecks && visionResult.localChecks.length > 0
      ? visionResult.localChecks
      : [
          `Verify infiltration at ${field.latitude}°, ${field.longitude}° (${nasaEnv.soil.drainage_class}, Hydrologic Group ${nasaEnv.soil.hydrologic_group}, ${nasaEnv.slope_percent}% SRTM slope).`,
          `Confirm last spring frost timing around Week ${nasaEnv.climate_summary.last_spring_frost_week} before planting frost-sensitive ${targetCrop.display_name}.`,
        ];

  if (hasWaterNote) {
    checkLocally.push(
      'Maintain a vegetated filter strip along the nearby water edge noted in your ground-truth survey to prevent nutrient runoff.'
    );
  }

  return {
    field_profile: {
      latitude: field.latitude,
      longitude: field.longitude,
      area_acres: field.area_acres,
      mode: survey.mode,
      elevation_m: nasaEnv.elevation_m,
      slope_percent: nasaEnv.slope_percent,
      soil_texture: nasaEnv.soil.texture_class,
      drainage_class: nasaEnv.soil.drainage_class,
      hydrologic_group: nasaEnv.soil.hydrologic_group,
      organic_matter_level: nasaEnv.soil.organic_matter_level,
      drainage_runoff_risk: drainageRisk,
      ground_truth_photo_count: survey.photosBase64.length,
      ground_truth_diagnosis: photoDiagnosis,
      vision_ai_verified: Boolean(visionResult?.verified),
    },
    nasa_environment: nasaEnv,
    survey,
    strategies: scored,
    check_locally: checkLocally,
  };
}

export async function askFieldAgronomistLive(
  question: string,
  analysis: GroundRadarAnalysisResult,
  selectedStrategy: RotationStrategy
): Promise<string> {
  const { climate_summary, soil } = analysis.nasa_environment;
  const { field_profile } = analysis;

  if (supabase) {
    try {
      const prompt = `You are Ground Radar's AI Field Agronomist. Answer the farmer's question concisely (3-4 sentences max) citing their exact NASA & USDA metrics:
- Location: ${field_profile.latitude}°, ${field_profile.longitude}° (${field_profile.area_acres} acres, ${field_profile.mode})
- Soil: ${soil.texture_class}, ${soil.drainage_class} (Hydrologic Group ${soil.hydrologic_group}), ${soil.organic_carbon_g_kg} g/kg SOC, AWC ${soil.available_water_capacity}
- NASA POWER/SMAP: ${climate_summary.annual_rainfall_mm} mm/yr rain, ${climate_summary.annual_et_mm} mm/yr ET, ${Math.round(climate_summary.mean_surface_moisture * 100)}% surface moisture, ${Math.round(climate_summary.mean_soil_moisture * 100)}% root-zone moisture, frost-free Weeks ${climate_summary.last_spring_frost_week}–${climate_summary.first_fall_frost_week}
- Visual Ground-Truth Diagnosis: ${field_profile.ground_truth_diagnosis}
- Selected Rotation Strategy: ${selectedStrategy.name}

Farmer Question: "${question}"`;

      const { data: geminiData, error } = await supabase.functions.invoke<{ text?: string }>('gemini', {
        body: { prompt, temperature: 0.4 },
      });

      if (!error) {
        const text = geminiData?.text;
        if (text) return text.trim();
      }
    } catch (err) {
      console.warn('Live Gemini chat fallback activated:', err);
    }
  }

  // Deterministic fallback citing live NASA + USDA data
  const q = question.toLowerCase();
  if (q.includes('frost') || q.includes('when') || q.includes('plant')) {
    return `NASA POWER climatology at ${field_profile.latitude}°, ${field_profile.longitude}° puts your last spring frost around Week ${climate_summary.last_spring_frost_week} and first fall frost around Week ${climate_summary.first_fall_frost_week} (${climate_summary.frost_free_weeks} frost-free weeks). Transplant warm-season crops 1–2 weeks after Week ${climate_summary.last_spring_frost_week}, and seed cool-season cover crops 6–8 weeks before Week ${climate_summary.first_fall_frost_week}.`;
  }
  if (q.includes('water') || q.includes('irrigat') || q.includes('moisture')) {
    return `NASA POWER/SMAP shows ${Math.round(climate_summary.mean_surface_moisture * 100)}% surface wetness and ${Math.round(climate_summary.mean_soil_moisture * 100)}% root-zone wetness, with ${climate_summary.annual_rainfall_mm} mm/yr rainfall against ${climate_summary.annual_et_mm} mm/yr evapotranspiration on ${soil.texture_class} (${soil.drainage_class}). "${selectedStrategy.name}" saves ~${selectedStrategy.expected_benefits.water_savings_pct}% water via continuous living cover.`;
  }
  return `Across your ${soil.texture_class} plot (${soil.drainage_class}, Hydrologic Group ${soil.hydrologic_group}, ${field_profile.slope_percent}% SRTM slope), "${selectedStrategy.name}" balances ${climate_summary.annual_rainfall_mm} mm/yr rainfall and ${climate_summary.annual_et_mm} mm/yr ET for a ${selectedStrategy.expected_benefits.estimated_yield_index}/100 yield index. Click "Enter Simulation" to test week-by-week moisture and nitrogen dynamics!`;
}