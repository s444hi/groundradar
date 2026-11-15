import { createClient } from '@supabase/supabase-js';
import type { TracedFieldData } from '../components/FieldTracerMap';
import type { GroundRadarAnalysisResult } from './rotationGeneratorService';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export interface SavedAnalysisRecord {
  fieldId: string;
  analysisId: string;
  photoUrls: string[];
  persistedToCloud: boolean;
}

function base64ToBlob(dataUrl: string): { blob: Blob; ext: string } {
  const [header, base64Data] = dataUrl.split(',');
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const ext = mimeType.split('/')[1] || 'jpg';

  const byteChars = atob(base64Data);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  return { blob: new Blob([new Uint8Array(byteNumbers)], { type: mimeType }), ext };
}

export async function saveFieldAnalysisToSupabase(
  field: TracedFieldData,
  analysis: GroundRadarAnalysisResult,
  userId?: string | null
): Promise<SavedAnalysisRecord> {
  if (!supabase) {
    console.warn('Supabase env vars missing; running in local-only mode.');
    return {
      fieldId: crypto.randomUUID(),
      analysisId: crypto.randomUUID(),
      photoUrls: analysis.survey.photosBase64,
      persistedToCloud: false,
    };
  }

  // 1. Insert traced field polygon into `fields`
  const { data: fieldRow, error: fieldError } = await supabase
    .from('fields')
    .insert({
      user_id: userId ?? null,
      latitude: field.latitude,
      longitude: field.longitude,
      area_acres: field.area_acres,
      mode: analysis.survey.mode,
      polygon_geojson: field.geoJson,
    })
    .select('id')
    .single();

  if (fieldError || !fieldRow) {
    throw new Error(`Failed to save field polygon: ${fieldError?.message}`);
  }

  // 2. Upload 3–6 ground-truth photos to Supabase Storage (`field-photos`)
  const uploadedUrls: string[] = [];
  for (let i = 0; i < analysis.survey.photosBase64.length; i++) {
    const dataUrl = analysis.survey.photosBase64[i];
    if (!dataUrl.startsWith('data:')) {
      uploadedUrls.push(dataUrl);
      continue;
    }

    const { blob, ext } = base64ToBlob(dataUrl);
    const filePath = `${fieldRow.id}/photo_${i + 1}_${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from('field-photos')
      .upload(filePath, blob, { upsert: true });

    if (!uploadErr) {
      const { data: pubUrl } = supabase.storage.from('field-photos').getPublicUrl(filePath);
      uploadedUrls.push(pubUrl.publicUrl);
    } else {
      console.warn(`Photo ${i + 1} upload skipped:`, uploadErr.message);
    }
  }

  const { soil, climate_summary, satellite_layers } = analysis.nasa_environment;
  const { field_profile } = analysis;

  // 3. Insert complete structured NASA + USDA + Gemini Vision + Strategies dataset into `field_analyses`
  const { data: analysisRow, error: analysisError } = await supabase
    .from('field_analyses')
    .insert({
      field_id: fieldRow.id,
      photo_urls: uploadedUrls,
      photo_notes: analysis.survey.photoNotes,
      planned_rotation: analysis.survey.planned_rotation,
      past_rotation: analysis.survey.past_rotation,
      priorities: analysis.survey.priorities,
      nasa_environment: analysis.nasa_environment,
      field_profile: analysis.field_profile,
      strategies: analysis.strategies,
      check_locally: analysis.check_locally,
      // Structured dataset columns for direct SQL queries & analytics
      soil_source: soil.source_label,
      soil_texture: soil.texture_class,
      sand_pct: soil.sand_pct,
      silt_pct: soil.silt_pct,
      clay_pct: soil.clay_pct,
      organic_carbon_g_kg: soil.organic_carbon_g_kg,
      drainage_class: soil.drainage_class,
      hydrologic_group: soil.hydrologic_group,
      available_water_capacity: soil.available_water_capacity,
      elevation_m: field_profile.elevation_m,
      slope_percent: field_profile.slope_percent,
      drainage_runoff_risk: field_profile.drainage_runoff_risk,
      annual_rainfall_mm: climate_summary.annual_rainfall_mm,
      annual_et_mm: climate_summary.annual_et_mm,
      mean_temp_c: climate_summary.mean_temp_c,
      mean_surface_moisture: climate_summary.mean_surface_moisture,
      mean_soil_moisture: climate_summary.mean_soil_moisture,
      mean_solar_mj_m2: climate_summary.mean_solar_mj_m2,
      last_spring_frost_week: climate_summary.last_spring_frost_week,
      first_fall_frost_week: climate_summary.first_fall_frost_week,
      frost_free_weeks: climate_summary.frost_free_weeks,
      modis_ndvi_snapshot_url: satellite_layers.modis_ndvi_snapshot_url,
      gpm_imerg_snapshot_url: satellite_layers.gpm_imerg_snapshot_url,
      ground_truth_diagnosis: field_profile.ground_truth_diagnosis,
      vision_ai_verified: field_profile.vision_ai_verified,
      selected_strategy_id: analysis.strategies[0]?.id ?? null,
    })
    .select('id')
    .single();

  if (analysisError || !analysisRow) {
    throw new Error(`Failed to save field analysis: ${analysisError?.message}`);
  }

  return {
    fieldId: fieldRow.id,
    analysisId: analysisRow.id,
    photoUrls: uploadedUrls,
    persistedToCloud: true,
  };
}

export async function recordSelectedSimulationStrategy(
  analysisId: string,
  selectedStrategyId: string
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('field_analyses')
    .update({
      selected_strategy_id: selectedStrategyId,
      simulation_entered_at: new Date().toISOString(),
    })
    .eq('id', analysisId);

  if (error) {
    console.warn('Could not update selected simulation strategy:', error.message);
  }
}

export async function logFieldChatTurn(
  analysisId: string,
  userMessage: string,
  assistantReply: string
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('field_chat_logs').insert([
    { analysis_id: analysisId, role: 'user', message: userMessage },
    { analysis_id: analysisId, role: 'assistant', message: assistantReply },
  ]);

  if (error) {
    console.warn('Could not log chat message:', error.message);
  }
}