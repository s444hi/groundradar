import cropsJson from "../data/crops.json";
import { getFrostWeeks } from "./frost";
import { runSimulation } from "./index";
import { buildTimeline } from "./timeline";
import type { Crop, CropsById, FieldJson, TimelineWeek, WeatherEventType } from "./types";

const crops = cropsJson.crops as unknown as CropsById;

export interface Hazard {
  absoluteWeek: number;
  type: WeatherEventType;
  cleared: boolean;
  reason: string;
}

function growingCropsFor(week: TimelineWeek): Crop[] {
  return week.cropIds.map((id) => crops[id]).filter((crop): crop is Crop => Boolean(crop));
}

// Only 3 hazard types, each judged against what's actually growing that
// week: heavy rain hits bare soil (erosion), frost hits a non-frost-tolerant
// crop, drought hits a high-water-need crop. Bare ground always clears
// frost/drought (nothing there to damage).
function buildHazard(type: WeatherEventType, absoluteWeek: number, week: TimelineWeek): Hazard {
  const growing = growingCropsFor(week);
  const names = (list: Crop[]) => list.map((crop) => crop.display_name).join(" + ");

  if (type === "heavy_rain") {
    if (week.isBare) {
      return { absoluteWeek, type, cleared: false, reason: "Heavy rain fell on bare soil, risking erosion." };
    }
    return { absoluteWeek, type, cleared: true, reason: `${names(growing)} held the soil through heavy rain.` };
  }

  if (type === "frost") {
    const vulnerable = growing.filter((crop) => crop.frost_tolerant === false);
    if (vulnerable.length > 0) {
      return { absoluteWeek, type, cleared: false, reason: `${names(vulnerable)} isn't frost tolerant and was exposed to frost.` };
    }
    if (growing.length > 0) {
      return { absoluteWeek, type, cleared: true, reason: `${names(growing)} is frost tolerant and survived the frost.` };
    }
    return { absoluteWeek, type, cleared: true, reason: "No crop was exposed to this frost." };
  }

  // drought
  const thirsty = growing.filter((crop) => crop.water_need === "high");
  if (thirsty.length > 0) {
    return { absoluteWeek, type, cleared: false, reason: `${names(thirsty)} needs high water and faced drought conditions.` };
  }
  if (growing.length > 0) {
    return { absoluteWeek, type, cleared: true, reason: `${names(growing)}'s lower water need meant drought wasn't a problem.` };
  }
  return { absoluteWeek, type, cleared: true, reason: "No crop was exposed to this drought." };
}

/**
 * DinoRunner's hazard feed: replays the engine's own per-season
 * weather_events (already computed by scoring.ts) against the strategy's
 * weekly timeline, so the runner only ever shows what the engine actually
 * scored — never its own logic. `seasons[i]` and `weeklyTimeline.slots[i]`
 * line up 1:1 (simulate.ts and timeline.ts tile cycles identically), which
 * is how each event's calendar week is placed on the 3-year absolute grid.
 */
export function getHazards(fieldJson: FieldJson, strategyIndex: number): Hazard[] {
  const scoredField = runSimulation(fieldJson);
  const strategy = scoredField.rotation_strategies[strategyIndex];
  const seasons = strategy.simulation_scores!.seasons ?? [];

  const frostWeeks = getFrostWeeks(fieldJson.climate_data.frost_dates);
  const weeklyTimeline = buildTimeline(strategy, crops, frostWeeks, 3);

  const hazards: Hazard[] = [];
  seasons.forEach((season, index) => {
    const slot = weeklyTimeline.slots[index];
    if (!slot) return;
    for (const event of season.weather_events) {
      const absoluteWeek = slot.yearOffset * 52 + (event.week - 1);
      const week = weeklyTimeline.weeks[absoluteWeek];
      if (!week) continue;
      hazards.push(buildHazard(event.type, absoluteWeek, week));
    }
  });
  return hazards;
}
