// Shared types for the simulation engine.
// snake_case fields mirror the field JSON / crops.json exactly.
// camelCase fields are engine-computed.

export type Family =
  | "solanaceae"
  | "fabaceae"
  | "poaceae"
  | "cucurbitaceae"
  | "polygonaceae"
  | "asteraceae"
  | "apiaceae"
  | "amaryllidaceae"
  | "brassicaceae"
  | "none";

export type SeasonType = "warm_season" | "cool_season" | "any";
export type Season = "warm_season" | "cool_season";
export type PlantingAnchor = "last_spring_frost" | "first_fall_frost";
export type NutrientRole = "heavy_feeder" | "light_feeder" | "nitrogen_fixer" | "none";
export type WaterNeed = "none" | "low" | "medium" | "high";
export type RootDepth = "none" | "shallow" | "deep";
export type IncomeValue = "none" | "low" | "medium" | "high";
export type FarmMode = "farm" | "garden";

// Distinct 3-value scale, deliberately kept separate from WaterNeed/IncomeValue.
export type Level = "low" | "medium" | "high";

export interface PlantingWindow {
  anchor: PlantingAnchor;
  start_week_offset: number;
  end_week_offset: number;
}

export interface Crop {
  display_name: string;
  family: Family;
  season_type: SeasonType;
  planting_window: PlantingWindow | null; // null only for fallow
  days_to_maturity: number | null; // null only for fallow
  nutrient_role: NutrientRole;
  water_need: WaterNeed;
  root_depth: RootDepth;
  frost_tolerant: boolean | null; // null only for fallow
  is_cover_crop: boolean;
  income_value: IncomeValue;
  fits: FarmMode[];
}

export type CropId = string;
export type CropsById = Record<CropId, Crop>;

export interface FrostDates {
  last_spring_frost: string; // "MM-DD"
  first_fall_frost: string; // "MM-DD"
  frost_free_days: number;
}

export type FrostWeeks = Record<PlantingAnchor, number>;

export interface WeeklyClimatologyEntry {
  week: number; // 1-52
  temp_low_c: number;
  temp_high_c: number;
  rainfall_mm: number;
  soil_moisture_m3_m3: number;
}

export interface RotationSlot {
  year: number;
  season: Season;
  crops: CropId[];
  alternate_crop_ids: CropId[];
  is_mix: boolean;
  purpose: string;
}

// Narrower than RotationSlot: survey_inputs.past_rotation/planned_rotation
// entries only carry year, season, and crops.
export interface PastRotationSlot {
  year: number;
  season: Season;
  crops: CropId[];
}

export interface Priorities {
  water: number; // 0-10
  income: number; // 0-10
  soil_health: number; // 0-10
  pests: number; // 0-10
}

export interface SoilProfile {
  texture_class: string;
  sand_percent: number;
  silt_percent: number;
  clay_percent: number;
  organic_carbon_g_kg: number;
  organic_matter_level: Level;
  drainage_runoff_risk: Level;
  nitrogen_level: Level;
  pest_carryover_risk: Level;
  pest_carryover_family: Family;
}

// Carried season-to-season by soil.ts; threads carryover through simulate.ts.
export interface SoilState {
  nitrogen: number; // 0-100
  organicMatter: number; // 0-100
  pestPressureByFamily: Record<Family, number>; // 0-100 each
}

export interface QualitativeAnalysis {
  why_suggested: string;
  nasa_evidence: string;
  benefits: string[];
  information_gaps: string[];
  local_risks_for_review: string[];
}

export interface RotationStrategy {
  strategy_id: string;
  title: string;
  is_baseline: boolean;
  timeline: RotationSlot[];
  simulation_scores: SimulationScores | null;
  qualitative_analysis: QualitativeAnalysis;
}

// --- Timeline-building output types ---

export interface CropOccupancy {
  cropId: CropId;
  startAbsoluteWeek: number; // inclusive, 0-based across the whole timeline
  endAbsoluteWeek: number; // inclusive, 0-based across the whole timeline
}

export interface ExpandedRotationSlot extends RotationSlot {
  slotIndex: number;
  yearOffset: number;
  occupiedWeeks: CropOccupancy[];
}

export interface TimelineWeek {
  absoluteWeek: number; // 0-based, 0 .. years*52 - 1
  yearOffset: number; // floor(absoluteWeek / 52)
  week: number; // 1-52
  cropIds: CropId[]; // [] = bare soil
  isBare: boolean;
}

export interface WeeklyTimeline {
  strategyId: string;
  years: number;
  slots: ExpandedRotationSlot[];
  weeks: TimelineWeek[];
}

// --- Minimal stub types referenced by RotationStrategy.simulation_scores ---
// (not populated by frost.ts/timeline.ts; declared so this file compiles standalone)

export type ConfidenceLevel = "High" | "Medium" | "Low";

export interface Confidence {
  level: ConfidenceLevel;
  reasons: string[];
}

export type WeatherEventType = "frost" | "drought" | "heavy_rain";

export interface WeatherEvent {
  week: number;
  type: WeatherEventType;
}

export type ScoreCategory = "season_fit" | "water" | "nitrogen" | "pests" | "erosion" | "income";

export interface ScoreReason {
  delta: number;
  text: string;
  category?: ScoreCategory;
  // The one number that changes year to year for this reason (nitrogen:
  // current soil nitrogen; pests: current pest pressure), so the UI can
  // collapse a changing-number sequence into one trend line instead of
  // repeating near-duplicate lines.
  trendValue?: number;
  // Ready-made subject for a trend line (crop display name or a family's
  // common name) — avoids the UI having to regex-parse prose text.
  subjectLabel?: string;
}

export interface SeasonSubscores {
  water_efficiency_score: number;
  erosion_protection_score: number;
  pest_break_score: number;
  season_fit_score: number;
  income_score: number;
  // Internal per-season category (rule 5's "Nitrogen" scoring). Not one of
  // the top-level SimulationScores fields; it feeds soil_health_delta and
  // overall_success_score's priority weighting instead.
  nitrogen_score: number;
}

export interface SeasonResult {
  year: number;
  season: Season;
  crops: CropId[];
  score: number;
  subscores: SeasonSubscores;
  reasons: ScoreReason[];
  weather_events: WeatherEvent[];
}

export interface SimulationScores {
  computed_by?: string;
  overall_success_score: number | null;
  water_efficiency_score: number | null;
  erosion_protection_score: number | null;
  pest_break_score: number | null;
  season_fit_score: number | null;
  income_score: number | null;
  soil_health_delta: number | null;
  estimated_irrigation_mm: number | null;
  nitrogen_balance_kg_ha: number | null;
  confidence: Confidence | null;
  check_locally: string[] | null;
  seasons: SeasonResult[] | null;
}

// --- Full field JSON (teammate's input/output contract) ---

export interface Location {
  latitude: number;
  longitude: number;
}

export interface FieldProfile {
  field_id: string;
  mode: FarmMode;
  location: Location;
  location_name?: string; // human-readable label (e.g. "Folsom, CA"); fall back to location when absent
  area_acres: number;
  elevation_m: number;
  slope_percent: number;
  soil: SoilProfile;
}

export interface SurveyInputs {
  past_rotation: PastRotationSlot[];
  planned_rotation: PastRotationSlot[];
  priorities: Priorities;
}

export interface LongTermTrends {
  temp_trend_c_per_decade: number;
  precip_trend_pct_per_decade: number;
  grace_groundwater_cm_per_yr: number;
}

export interface NasaDiagnosticsSummary {
  smap_soil_moisture_status: string;
  gpm_rainfall_pattern: string;
  ecostress_evap_stress: string;
  heat_stress_days_above_35c: number;
  erosion_vulnerability: Level;
  typical_bare_soil_months: number[];
  peak_vegetation_stress_months: number[];
}

export interface ClimateData {
  frost_dates: FrostDates;
  weekly_climatology: WeeklyClimatologyEntry[];
  long_term_trends: LongTermTrends;
  nasa_diagnostics_summary: NasaDiagnosticsSummary;
}

export interface FieldJson {
  field_profile: FieldProfile;
  survey_inputs: SurveyInputs;
  climate_data: ClimateData;
  rotation_strategies: RotationStrategy[];
  ai_agronomist_context_seed?: string;
}
