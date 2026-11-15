import cropsJson from "../data/crops.json";
import { weekToMonthDay } from "../engine/frost";
import type {
  Crop,
  CropId,
  CropsById,
  FarmMode,
  FieldJson,
  Level,
  PastRotationSlot,
  Priorities,
  QualitativeAnalysis,
  RotationSlot,
  RotationStrategy,
  Season,
  SimulationScores,
  SoilProfile,
  WeeklyClimatologyEntry,
} from "../engine/types";

const crops = cropsJson.crops as unknown as CropsById;

// --- The teammate's shape, mirrored ---------------------------------------
//
// A structural mirror of GroundRadarAnalysisResult from
// src/services/rotationGeneratorService.ts, declaring only the fields the
// simulation actually reads. Mirroring instead of importing keeps the team
// split clean (nothing in src/simulation/ depends on their files) and lets
// this compile before their branch lands; their richer type stays assignable
// to it because TypeScript is structural.

export interface AnalysisRotationSlot {
  year: number;
  season: Season;
  crops: string[];
}

export interface AnalysisStrategy {
  id: string;
  name: string;
  badge: string;
  summary: string;
  schedule: AnalysisRotationSlot[];
  agronomist_rationale: string;
}

export interface AnalysisWeeklyPoint {
  week: number;
  temp_low_c: number;
  temp_high_c: number;
  rainfall_mm: number;
  /** GWETROOT root-zone wetness, 0-1 as a fraction of saturation. */
  soil_moisture: number;
}

export interface AnalysisResult {
  field_profile: {
    latitude: number;
    longitude: number;
    area_acres: number;
    mode: FarmMode;
    elevation_m: number;
    slope_percent: number;
    organic_matter_level: Level;
    drainage_runoff_risk: Level;
  };
  nasa_environment: {
    soil: {
      sand_pct: number;
      silt_pct: number;
      clay_pct: number;
      texture_class: string;
      organic_carbon_g_kg: number;
      organic_matter_level: Level;
    };
    climate_summary: {
      annual_rainfall_mm: number;
      annual_et_mm: number;
      mean_soil_moisture: number;
      last_spring_frost_week: number;
      first_fall_frost_week: number;
      frost_free_weeks: number;
    };
    weekly_series: AnalysisWeeklyPoint[];
  };
  survey: {
    planned_rotation: AnalysisRotationSlot[];
    past_rotation: AnalysisRotationSlot[];
    priorities: Priorities;
  };
  strategies: AnalysisStrategy[];
  check_locally: string[];
}

export interface FromAnalysisOptions {
  /**
   * Calendar year the plan's first year maps to. Defaults to the real
   * current year, so tests that assert on years must pass it explicitly to
   * stay deterministic.
   */
  currentYear?: number;
  /** field_profile.field_id, which the analysis payload itself doesn't carry. */
  fieldId?: string;
  /** Human-readable place label; the UI falls back to coordinates without one. */
  locationName?: string;
}

export const YOUR_PLAN_STRATEGY_ID = "your_plan";

const MAX_ALTERNATES = 3;

// --- Small helpers --------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function seasonLabel(season: Season): string {
  return season === "warm_season" ? "warm-season" : "cool-season";
}

/** Fallow (and anything missing from crops.json) has no planting window. */
function isPlantable(crop: Crop | undefined): boolean {
  return Boolean(crop?.planting_window);
}

/**
 * Pore space as a fraction of soil volume, estimated from texture: sand
 * drains to roughly 0.40, clay holds closer to 0.50, and a loam lands near
 * 0.45. Rough by design — it only exists to turn the payload's 0-1 wetness
 * into the m3/m3 volumetric moisture the engine's thresholds are written
 * against, so it is surfaced as an estimate like every other derived number.
 */
export function estimatePorosity(sandPercent: number, clayPercent: number): number {
  return round(clamp(0.46 - 0.001 * sandPercent + 0.0015 * clayPercent, 0.35, 0.55), 3);
}

// --- Per-slot derivation --------------------------------------------------

/** One crop's role in a slot, phrased to read as a clause inside `purpose`. */
function cropRoleClause(crop: Crop, season: Season): string {
  if (crop.is_cover_crop) {
    if (crop.nutrient_role === "nitrogen_fixer") return "adds nitrogen for the next cash crop";
    if (crop.root_depth === "deep") return "holds soil with deep roots";
    return `covers bare ${seasonLabel(season)} soil`;
  }
  if (crop.nutrient_role === "nitrogen_fixer") return `${seasonLabel(season)} cash crop that fixes its own nitrogen`;
  if (crop.nutrient_role === "heavy_feeder") return `main ${seasonLabel(season)} cash crop`;
  return `light-feeding ${seasonLabel(season)} crop`;
}

/**
 * RotationSlot.purpose, derived from the season plus each crop's role in
 * crops.json (never hard-coded per crop). A mix joins both crops' clauses so
 * the combined effect reads the way rule 7 scores it.
 */
export function describePurpose(cropIds: CropId[], season: Season): string {
  const known = cropIds.map((id) => crops[id]).filter((crop): crop is Crop => Boolean(crop));
  if (known.length === 0) return `${capitalizeFirst(seasonLabel(season))} planting`;

  const plantable = known.filter(isPlantable);
  if (plantable.length === 0) return "Unplanted bare period";

  const clauses = [...new Set(plantable.map((crop) => cropRoleClause(crop, season)))];
  const joined = clauses.length > 1 ? `${clauses.slice(0, -1).join(", ")} and ${clauses[clauses.length - 1]}` : clauses[0];

  if (plantable.some((crop) => crop.is_cover_crop)) {
    return `${plantable.length > 1 ? "Cover-crop mix" : "Cover crop"}: ${joined}`;
  }
  return capitalizeFirst(joined);
}

/**
 * Up to three swappable stand-ins for a slot: same season, same cover-crop
 * status as the slot's primary crop, growable in this mode, and not already
 * in the slot. Fallow slots get none — the cover-crop picker owns bare gaps.
 * Order follows crops.json, so the result is deterministic (rule 12).
 */
export function findAlternates(cropIds: CropId[], season: Season, mode: FarmMode): CropId[] {
  const primary = crops[cropIds[0]];
  if (!isPlantable(primary)) return [];

  return Object.keys(crops)
    .filter((id) => {
      if (cropIds.includes(id)) return false;
      const candidate = crops[id];
      if (!isPlantable(candidate)) return false;
      if (!candidate.fits.includes(mode)) return false;
      if (candidate.is_cover_crop !== primary.is_cover_crop) return false;
      return candidate.season_type === season || candidate.season_type === "any";
    })
    .slice(0, MAX_ALTERNATES);
}

function toRotationSlot(slot: AnalysisRotationSlot, calendarYear: number, mode: FarmMode): RotationSlot {
  return {
    year: calendarYear,
    season: slot.season,
    crops: slot.crops,
    alternate_crop_ids: findAlternates(slot.crops, slot.season, mode),
    is_mix: slot.crops.length > 1,
    purpose: describePurpose(slot.crops, slot.season),
  };
}

// --- Strategy assembly ----------------------------------------------------

// runSimulation fills every one of these in; they start null so an
// unscored strategy is never mistaken for a zero-scoring one.
const EMPTY_SCORES: SimulationScores = {
  computed_by: "simulation_engine",
  overall_success_score: null,
  water_efficiency_score: null,
  erosion_protection_score: null,
  pest_break_score: null,
  season_fit_score: null,
  income_score: null,
  soil_health_delta: null,
  estimated_irrigation_mm: null,
  nitrogen_balance_kg_ha: null,
  confidence: null,
  check_locally: null,
  seasons: null,
};

function yourPlanAnalysis(analysis: AnalysisResult): QualitativeAnalysis {
  const { annual_rainfall_mm, annual_et_mm, mean_soil_moisture, frost_free_weeks } =
    analysis.nasa_environment.climate_summary;
  return {
    why_suggested:
      "This is the rotation you entered in the survey, scored exactly as you planned it so the suggested rotations have something of yours to beat.",
    nasa_evidence: `NASA POWER and SMAP for this field: about ${annual_rainfall_mm} mm of rain a year against ${annual_et_mm} mm of evapotranspiration, ${frost_free_weeks} frost-free weeks, and ${Math.round(
      mean_soil_moisture * 100,
    )}% average root-zone wetness.`,
    benefits: ["Your own plan, left exactly as you entered it"],
    // check_locally seeds local_risks_for_review, which the engine turns
    // into its own check_locally flags. Repeating it as information_gaps
    // would print the same list again on the Overview tab.
    information_gaps: [],
    local_risks_for_review: analysis.check_locally,
  };
}

function strategyAnalysis(strategy: AnalysisStrategy, checkLocally: string[]): QualitativeAnalysis {
  return {
    why_suggested: strategy.summary,
    nasa_evidence: strategy.agronomist_rationale,
    benefits: [strategy.badge],
    information_gaps: [],
    local_risks_for_review: checkLocally,
  };
}

// --- Soil, climate, survey ------------------------------------------------

function toSoilProfile(analysis: AnalysisResult): SoilProfile {
  const { soil } = analysis.nasa_environment;
  const pastFamily = crops[analysis.survey.past_rotation[0]?.crops[0] ?? ""]?.family ?? "none";
  const plannedFamily = crops[analysis.survey.planned_rotation[0]?.crops[0] ?? ""]?.family ?? "none";
  // No past crop recorded means nothing to carry over; a recorded past crop
  // whose family is about to be planted again is the high-risk case.
  const pestRisk: Level = pastFamily === "none" ? "low" : pastFamily === plannedFamily ? "high" : "medium";

  return {
    texture_class: soil.texture_class,
    sand_percent: soil.sand_pct,
    silt_percent: soil.silt_pct,
    clay_percent: soil.clay_pct,
    organic_carbon_g_kg: soil.organic_carbon_g_kg,
    organic_matter_level: soil.organic_matter_level,
    drainage_runoff_risk: analysis.field_profile.drainage_runoff_risk,
    // The payload carries no measured nitrogen, and organic matter is the
    // closest proxy it does carry (a lab test is already flagged in
    // check_locally). Shown as an estimate in the UI like the rest.
    nitrogen_level: soil.organic_matter_level,
    pest_carryover_risk: pestRisk,
    pest_carryover_family: pastFamily,
  };
}

function toWeeklyClimatology(analysis: AnalysisResult): WeeklyClimatologyEntry[] {
  const { soil, weekly_series } = analysis.nasa_environment;
  const porosity = estimatePorosity(soil.sand_pct, soil.clay_pct);

  return [...weekly_series]
    .sort((a, b) => a.week - b.week)
    .map((point) => ({
      week: point.week,
      temp_low_c: point.temp_low_c,
      temp_high_c: point.temp_high_c,
      rainfall_mm: point.rainfall_mm,
      // 0-1 wetness (fraction of saturation) x pore space = m3/m3.
      soil_moisture_m3_m3: round(point.soil_moisture * porosity, 3),
    }));
}

/**
 * Past rotation runs up to the year before the plan starts: the most recent
 * recorded past season lands in currentYear - 1 and earlier ones step back
 * from there. Only the order matters to the engine; the years are for the UI.
 */
function toPastRotation(slots: AnalysisRotationSlot[], currentYear: number): PastRotationSlot[] {
  if (slots.length === 0) return [];
  const latest = Math.max(...slots.map((slot) => slot.year));
  return slots.map((slot) => ({
    year: currentYear - 1 - (latest - slot.year),
    season: slot.season,
    crops: slot.crops,
  }));
}

// --- Entry point ----------------------------------------------------------

/**
 * Turns the teammate's full analysis payload into the field JSON the engine
 * eats, so the Results page can hand the whole analysis straight to
 * SimulationPage.
 *
 * Lanes come out as the user's own planned rotation first (the baseline),
 * then the three generated strategies in payload order. Pure and
 * deterministic for a given `currentYear`.
 */
export function fromAnalysis(analysis: AnalysisResult, options: FromAnalysisOptions = {}): FieldJson {
  const { currentYear = new Date().getFullYear(), fieldId = "analysis_field", locationName } = options;
  const mode = analysis.field_profile.mode;
  const { climate_summary } = analysis.nasa_environment;

  // Every lane shares one year axis: the earliest year mentioned anywhere in
  // the plan (the payload uses 1 and 2) becomes the current calendar year.
  const planYears = [
    ...analysis.survey.planned_rotation.map((slot) => slot.year),
    ...analysis.strategies.flatMap((strategy) => strategy.schedule.map((slot) => slot.year)),
  ];
  const baseYear = planYears.length > 0 ? Math.min(...planYears) : 1;
  const toCalendarYear = (year: number) => currentYear + (year - baseYear);

  const yourPlan: RotationStrategy = {
    strategy_id: YOUR_PLAN_STRATEGY_ID,
    title: "Your plan",
    is_baseline: true,
    timeline: analysis.survey.planned_rotation.map((slot) =>
      toRotationSlot(slot, toCalendarYear(slot.year), mode),
    ),
    simulation_scores: { ...EMPTY_SCORES },
    qualitative_analysis: yourPlanAnalysis(analysis),
  };

  const suggested: RotationStrategy[] = analysis.strategies.map((strategy) => ({
    strategy_id: strategy.id,
    title: strategy.name,
    is_baseline: false,
    timeline: strategy.schedule.map((slot) => toRotationSlot(slot, toCalendarYear(slot.year), mode)),
    simulation_scores: { ...EMPTY_SCORES },
    qualitative_analysis: strategyAnalysis(strategy, analysis.check_locally),
  }));

  return {
    field_profile: {
      field_id: fieldId,
      mode,
      location: {
        latitude: analysis.field_profile.latitude,
        longitude: analysis.field_profile.longitude,
      },
      ...(locationName ? { location_name: locationName } : {}),
      area_acres: analysis.field_profile.area_acres,
      elevation_m: analysis.field_profile.elevation_m,
      slope_percent: analysis.field_profile.slope_percent,
      soil: toSoilProfile(analysis),
    },
    survey_inputs: {
      past_rotation: toPastRotation(analysis.survey.past_rotation, currentYear),
      planned_rotation: analysis.survey.planned_rotation.map((slot) => ({
        year: toCalendarYear(slot.year),
        season: slot.season,
        crops: slot.crops,
      })),
      priorities: analysis.survey.priorities,
    },
    climate_data: {
      frost_dates: {
        last_spring_frost: weekToMonthDay(climate_summary.last_spring_frost_week),
        first_fall_frost: weekToMonthDay(climate_summary.first_fall_frost_week),
        frost_free_days: Math.round(climate_summary.frost_free_weeks * 7),
      },
      weekly_climatology: toWeeklyClimatology(analysis),
      // Neutral placeholders: the engine reads neither block, and the
      // payload carries no trend or diagnostics equivalents to fill them
      // with. Left empty rather than invented.
      long_term_trends: {
        temp_trend_c_per_decade: 0,
        precip_trend_pct_per_decade: 0,
        grace_groundwater_cm_per_yr: 0,
      },
      nasa_diagnostics_summary: {
        smap_soil_moisture_status: "",
        gpm_rainfall_pattern: "",
        ecostress_evap_stress: "",
        heat_stress_days_above_35c: 0,
        erosion_vulnerability: analysis.field_profile.drainage_runoff_risk,
        typical_bare_soil_months: [],
        peak_vegetation_stress_months: [],
      },
    },
    rotation_strategies: [yourPlan, ...suggested],
  };
}
