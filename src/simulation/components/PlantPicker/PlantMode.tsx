import { useEffect, useMemo, useState } from "react";
import FollowUpCrops from "./FollowUpCrops";
import PlantPicker from "./PlantPicker";
import PlantScoreCard from "./PlantScoreCard";
import PlantTimeline from "./PlantTimeline";
import { getFrostWeeks, weekToMonthDay } from "../../engine/frost";
import { bestPlantingWeek, simulatePlanting, suggestFollowUpCrops } from "../../engine/plant";
import type { CropId, CropsById, FieldJson } from "../../engine/types";
import { usePlayback } from "../Timeline/usePlayback";

export interface PlantModeProps {
  fieldJson: FieldJson;
  crops: CropsById;
}

const PLANT_YEAR_WEEKS = 52;

const sectionStyle: React.CSSProperties = {
  marginBottom: "28px",
};

const sliderRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "16px",
  marginBottom: "12px",
};

const sliderStyle: React.CSSProperties = {
  flex: 1,
  accentColor: "var(--color-olive)",
};

const bestWeekChipStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  fontSize: "13px",
  border: "1px solid var(--color-olive)",
  borderRadius: "var(--radius-pill)",
  padding: "6px 14px",
  background: "var(--color-pale-green)",
  color: "var(--color-olive)",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const warningStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "13px",
  color: "var(--color-sim-risk)",
  background: "color-mix(in srgb, var(--color-sim-risk) 10%, var(--color-bg))",
  border: "1px solid color-mix(in srgb, var(--color-sim-risk) 40%, transparent)",
  borderRadius: "var(--radius-pill)",
  padding: "8px 16px",
  margin: "0 0 16px 0",
};

const emptyStateStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "14px",
  color: "var(--color-text-muted)",
};

function firstPlantableCropId(crops: CropsById, mode: FieldJson["field_profile"]["mode"]): CropId | null {
  const entry = Object.entries(crops).find(([, crop]) => crop.planting_window != null && crop.fits.includes(mode));
  return entry ? entry[0] : null;
}

/**
 * Plant mode: pick a crop, slide its planting week, watch it grow across a
 * single year, and see its score and good follow-up crops. Doesn't touch
 * `fieldJson`'s rotation_strategies at all — purely a read side exploration,
 * so switching back to Rotation mode never loses a rotation edit.
 */
export default function PlantMode({ fieldJson, crops }: PlantModeProps) {
  const mode = fieldJson.field_profile.mode;
  const frostWeeks = useMemo(() => getFrostWeeks(fieldJson.climate_data.frost_dates), [fieldJson]);

  const [selectedCropId, setSelectedCropId] = useState<CropId | null>(() => firstPlantableCropId(crops, mode));
  const [plantingWeek, setPlantingWeek] = useState<number>(() => {
    const defaultCropId = firstPlantableCropId(crops, mode);
    return defaultCropId ? (bestPlantingWeek(fieldJson, defaultCropId) ?? 1) : 1;
  });

  const playback = usePlayback(PLANT_YEAR_WEEKS);

  const result = useMemo(
    () => (selectedCropId ? simulatePlanting(fieldJson, selectedCropId, plantingWeek) : null),
    [fieldJson, selectedCropId, plantingWeek],
  );
  const bestWeek = useMemo(
    () => (selectedCropId ? bestPlantingWeek(fieldJson, selectedCropId) : null),
    [fieldJson, selectedCropId],
  );
  const followUps = useMemo(
    () => (selectedCropId ? suggestFollowUpCrops(selectedCropId, mode) : []),
    [selectedCropId, mode],
  );

  // If the field changes mode (not expected mid-session today, but keeps
  // this defensible) or the current crop stops being plantable, fall back
  // to the first plantable crop instead of showing a dead selection.
  useEffect(() => {
    if (selectedCropId && crops[selectedCropId]?.fits.includes(mode)) return;
    setSelectedCropId(firstPlantableCropId(crops, mode));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  function handleSelectCrop(cropId: CropId) {
    setSelectedCropId(cropId);
    const best = bestPlantingWeek(fieldJson, cropId);
    if (best != null) setPlantingWeek(best);
    playback.replay();
  }

  function handleSnapToBestWeek() {
    if (bestWeek != null) setPlantingWeek(bestWeek);
  }

  return (
    <div>
      <div style={sectionStyle}>
        <PlantPicker crops={crops} mode={mode} selectedCropId={selectedCropId} onSelect={handleSelectCrop} />
      </div>

      {!result ? (
        <p style={emptyStateStyle}>Pick a crop above to see how it would grow.</p>
      ) : (
        <>
          <PlantTimeline
            cropId={result.cropId}
            plantingWeek={plantingWeek}
            durationWeeks={result.durationWeeks}
            windowStartWeek={result.windowStartWeek}
            windowEndWeek={result.windowEndWeek}
            frostWeeks={frostWeeks}
            playback={playback}
          />

          <div style={sliderRowStyle}>
            <input
              type="range"
              min={1}
              max={52}
              step={1}
              value={plantingWeek}
              onChange={(e) => setPlantingWeek(Number(e.target.value))}
              style={sliderStyle}
              aria-label="Planting week"
            />
            {bestWeek != null && (
              <button style={bestWeekChipStyle} onClick={handleSnapToBestWeek}>
                Best week: {weekToMonthDay(bestWeek)}
              </button>
            )}
          </div>

          {!result.inWindow && (
            <p style={warningStyle}>
              This is outside {crops[result.cropId].display_name}'s usual planting window — scores reflect the real risk of
              planting now.
            </p>
          )}

          <PlantScoreCard result={result} playback={playback} />
          <FollowUpCrops suggestions={followUps} crops={crops} />
        </>
      )}
    </div>
  );
}
