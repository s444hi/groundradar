import type { CoverCropOptionWithDelta } from "../CoverCropPicker/CoverCropPicker";
import { ADDED_COVER_CROP_PURPOSE } from "../CoverCropPicker/coverCropEdits";
import type { GapInfo } from "../CoverCropPicker/coverCropEdits";
import CropCard from "../CropCard/CropCard";
import DinoRunner from "../DinoRunner/DinoRunner";
import GapSlot from "../GapSlot/GapSlot";
import { weekToMonthName } from "../../engine/frost";
import type { Hazard } from "../../engine/hazards";
import type { CropId, CropsById, WeeklyTimeline } from "../../engine/types";
import { groupWeeksIntoSegments } from "./groupWeeksIntoSegments";
import {
  BELOW_GROUND_HEIGHT,
  GROUND_LINE_BOTTOM,
  GROUND_LINE_HEIGHT,
  LABEL_HEIGHT,
  seededRandom,
  TRACK_HEIGHT,
  YEAR_TICK_HEIGHT,
} from "./layout";
import type { PlaybackApi } from "./usePlayback";

export interface TimelineProps {
  weeklyTimeline: WeeklyTimeline;
  crops: CropsById;
  baseYear: number;
  playback: PlaybackApi;
  strategyIndex: number;
  templateLength: number;
  onSwapAlternate: (templateIndex: number) => void;
  openGapKey: string | null;
  pickerOptions: CoverCropOptionWithDelta[];
  onToggleGap: (gapKey: string, templateIndex: number, gapInfo: GapInfo) => void;
  onClosePicker: () => void;
  onPickCoverCrop: (cropId: CropId) => void;
  onRemoveCoverCrop: (templateIndex: number) => void;
  hazards: Hazard[];
}

const outerStyle: React.CSSProperties = {
  marginBottom: "32px",
};

const yearLabelRowStyle: React.CSSProperties = {
  position: "relative",
  height: "16px",
  marginBottom: "4px",
};

const yearLabelStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  fontFamily: "var(--font-mono)",
  fontSize: "10px",
  color: "var(--color-text-muted)",
  whiteSpace: "nowrap",
};

const trackAreaStyle: React.CSSProperties = {
  position: "relative",
  height: `${TRACK_HEIGHT}px`,
  cursor: "pointer",
};

const groundLineStyle: React.CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: `${GROUND_LINE_BOTTOM}px`,
  height: `${GROUND_LINE_HEIGHT}px`,
  background: "var(--color-pixel)",
};

const segmentRowStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  display: "flex",
  width: "100%",
  height: "100%",
};

function yearTickStyle(leftPercent: number): React.CSSProperties {
  const halfTick = (YEAR_TICK_HEIGHT - GROUND_LINE_HEIGHT) / 2;
  return {
    position: "absolute",
    left: `${leftPercent}%`,
    bottom: `${GROUND_LINE_BOTTOM - halfTick}px`,
    width: "2px",
    height: `${YEAR_TICK_HEIGHT}px`,
    background: "var(--color-pixel)",
  };
}

const playheadLineStyle = (leftPercent: number): React.CSSProperties => ({
  position: "absolute",
  left: `${leftPercent}%`,
  top: 0,
  bottom: `${LABEL_HEIGHT}px`,
  width: "2px",
  background: "var(--color-pixel)",
  pointerEvents: "none",
});

const playheadLabelStyle = (leftPercent: number): React.CSSProperties => ({
  position: "absolute",
  left: `${leftPercent}%`,
  transform: "translateX(-50%)",
  top: "-16px",
  fontFamily: "var(--font-mono)",
  fontSize: "10px",
  color: "var(--color-text-muted)",
  whiteSpace: "nowrap",
  pointerEvents: "none",
});

const DIRT_SPECK_SIZE = 3;
const DIRT_PEBBLE_SIZE = 5;

// Dirt specks (and a few bigger pebbles) under the ground line: deterministic
// per absolute week (not per segment), so they never shift on re-render or a
// future reorder. Fixed-size squares positioned by percent-left + a seeded
// px top offset — no non-uniform SVG scaling, so they stay crisp squares.
function DirtSpecks({ totalWeeks }: { totalWeeks: number }) {
  const specks = [];
  for (let week = 0; week < totalWeeks; week++) {
    const showRoll = seededRandom(week * 7 + 3);
    if (showRoll > 0.5) continue; // leave roughly half the weeks bare for a scattered look
    const isPebble = showRoll > 0.42; // a minority of specks are bigger pebbles
    const size = isPebble ? DIRT_PEBBLE_SIZE : DIRT_SPECK_SIZE;
    const leftPercent = ((week + 0.2 + seededRandom(week * 13 + 1) * 0.6) / totalWeeks) * 100;
    const topPx = seededRandom(week * 17 + 5) * (BELOW_GROUND_HEIGHT - size);
    specks.push(
      <div
        key={week}
        style={{
          position: "absolute",
          left: `${leftPercent}%`,
          top: `${topPx}px`,
          width: `${size}px`,
          height: `${size}px`,
          background: "var(--color-pixel-light)",
        }}
      />,
    );
  }
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: `${LABEL_HEIGHT}px`,
        height: `${BELOW_GROUND_HEIGHT}px`,
      }}
    >
      {specks}
    </div>
  );
}

export default function Timeline({
  weeklyTimeline,
  crops,
  baseYear,
  playback,
  strategyIndex,
  templateLength,
  onSwapAlternate,
  openGapKey,
  pickerOptions,
  onToggleGap,
  onClosePicker,
  onPickCoverCrop,
  onRemoveCoverCrop,
  hazards,
}: TimelineProps) {
  const totalWeeks = weeklyTimeline.years * 52;
  const segments = groupWeeksIntoSegments(weeklyTimeline);

  // Percentage widths that sum to exactly 100: the last segment absorbs
  // whatever rounding remainder is left, so there's never a visible gap or
  // overflow at the right edge.
  const rawPercents = segments.map((segment) => (segment.weekCount / totalWeeks) * 100);
  const percentBeforeLast = rawPercents.slice(0, -1).reduce((sum, pct) => sum + pct, 0);
  const widths = rawPercents.map((pct, index) => (index === rawPercents.length - 1 ? 100 - percentBeforeLast : pct));

  const playheadPercent = (playback.currentWeek / totalWeeks) * 100;
  const playheadWeek = Math.min(totalWeeks - 1, Math.floor(playback.currentWeek));
  const playheadCalendarWeek = (playheadWeek % 52) + 1;
  const playheadYear = baseYear + Math.floor(playheadWeek / 52);
  const playheadLabel = `${weekToMonthName(playheadCalendarWeek)} ${playheadYear}`;

  function handleTrackClick(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = (event.clientX - rect.left) / rect.width;
    playback.seek(Math.round(fraction * totalWeeks));
  }

  return (
    <div style={outerStyle}>
      <div style={yearLabelRowStyle}>
        {Array.from({ length: weeklyTimeline.years }, (_, yearOffset) => (
          <span
            key={yearOffset}
            style={{ ...yearLabelStyle, left: `${(yearOffset * 52 / totalWeeks) * 100}%` }}
          >
            {baseYear + yearOffset}
          </span>
        ))}
      </div>

      <div style={trackAreaStyle} onClick={handleTrackClick}>
        <DirtSpecks totalWeeks={totalWeeks} />
        <div style={groundLineStyle} />
        {Array.from({ length: weeklyTimeline.years - 1 }, (_, i) => i + 1).map((yearBoundary) => (
          <div key={yearBoundary} style={yearTickStyle((yearBoundary * 52 / totalWeeks) * 100)} />
        ))}

        <div style={segmentRowStyle}>
          {segments.map((segment, index) => {
            // Our placement never produces a segment spanning more than one
            // expanded slot in practice; take the first if it ever did.
            const expandedSlotIndex = segment.slotIndexes[0] ?? 0;
            const templateIndex = expandedSlotIndex % templateLength;
            const expandedSlot = weeklyTimeline.slots.find((slot) => slot.slotIndex === expandedSlotIndex);
            const alternateIds = expandedSlot?.alternate_crop_ids ?? [];

            const gapKey = `${strategyIndex}:${expandedSlotIndex}`;

            return segment.isBare ? (
              <GapSlot
                key={segment.startAbsoluteWeek}
                weekCount={segment.weekCount}
                startAbsoluteWeek={segment.startAbsoluteWeek}
                endAbsoluteWeek={segment.endAbsoluteWeek}
                widthPercent={widths[index]}
                currentWeek={playback.currentWeek}
                crops={crops}
                isPickerOpen={openGapKey === gapKey}
                pickerOptions={pickerOptions}
                onTogglePicker={() =>
                  onToggleGap(gapKey, templateIndex, {
                    startAbsoluteWeek: segment.startAbsoluteWeek,
                    endAbsoluteWeek: segment.endAbsoluteWeek,
                    yearOffset: segment.yearOffset,
                  })
                }
                onClosePicker={onClosePicker}
                onPickCoverCrop={onPickCoverCrop}
              />
            ) : (
              <CropCard
                key={segment.startAbsoluteWeek}
                cropIds={segment.cropIds}
                crops={crops}
                weekCount={segment.weekCount}
                startAbsoluteWeek={segment.startAbsoluteWeek}
                endAbsoluteWeek={segment.endAbsoluteWeek}
                widthPercent={widths[index]}
                currentWeek={playback.currentWeek}
                dragDropId={`${strategyIndex}:${expandedSlotIndex}`}
                season={expandedSlot?.season ?? "warm_season"}
                alternateIds={alternateIds}
                onSwapAlternate={() => onSwapAlternate(templateIndex)}
                isAddedCoverCrop={expandedSlot?.purpose === ADDED_COVER_CROP_PURPOSE}
                onRemoveCoverCrop={() => onRemoveCoverCrop(templateIndex)}
              />
            );
          })}
        </div>

        {!playback.isFinished && (
          <>
            <div style={playheadLineStyle(playheadPercent)} />
            <span style={playheadLabelStyle(playheadPercent)}>{playheadLabel}</span>
          </>
        )}

        <DinoRunner hazards={hazards} totalWeeks={totalWeeks} playback={playback} />
      </div>
    </div>
  );
}
