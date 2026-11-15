import PixelSprite from "../PixelSprite";
import { getCropSpriteSet } from "../sprites";
import { getVisibleStages } from "../Timeline/getVisibleStages";
import type { GrowthStageKey } from "../Timeline/getVisibleStages";
import { GROUND_LINE_BOTTOM, GROUND_LINE_HEIGHT, PIXEL_SIZE, TRACK_HEIGHT, spriteBottomOffset } from "../Timeline/layout";
import type { PlaybackApi } from "../Timeline/usePlayback";
import { weekToMonthDay, weekToMonthName } from "../../engine/frost";
import type { CropId, FrostWeeks } from "../../engine/types";

export interface PlantTimelineProps {
  cropId: CropId;
  plantingWeek: number; // 1-52
  durationWeeks: number;
  windowStartWeek: number; // 1-52
  windowEndWeek: number; // 1-52
  frostWeeks: FrostWeeks;
  playback: PlaybackApi; // a 52-week clock
}

const WEEKS_PER_YEAR = 52;

const outerStyle: React.CSSProperties = {
  marginBottom: "20px",
};

const trackAreaStyle: React.CSSProperties = {
  position: "relative",
  height: `${TRACK_HEIGHT}px`,
  cursor: "pointer",
  overflow: "hidden",
  borderRadius: "var(--radius-card)",
  background: "var(--color-bg-subtle)",
};

const groundLineStyle: React.CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: `${GROUND_LINE_BOTTOM}px`,
  height: `${GROUND_LINE_HEIGHT}px`,
  background: "var(--color-pixel)",
};

function windowShadeStyle(leftPercent: number, widthPercent: number): React.CSSProperties {
  return {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: `${leftPercent}%`,
    width: `${widthPercent}%`,
    background: "color-mix(in srgb, var(--color-sage) 25%, transparent)",
  };
}

function frostMarkerLineStyle(leftPercent: number): React.CSSProperties {
  return {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: `${leftPercent}%`,
    width: "1px",
    background: "var(--color-sim-risk)",
    opacity: 0.6,
  };
}

function frostMarkerLabelStyle(leftPercent: number): React.CSSProperties {
  return {
    position: "absolute",
    top: "2px",
    left: `${leftPercent}%`,
    transform: "translateX(-50%)",
    fontFamily: "var(--font-mono)",
    fontSize: "9px",
    color: "var(--color-sim-risk)",
    whiteSpace: "nowrap",
  };
}

const playheadLineStyle = (leftPercent: number): React.CSSProperties => ({
  position: "absolute",
  left: `${leftPercent}%`,
  top: 0,
  bottom: 0,
  width: "2px",
  background: "var(--color-pixel)",
  pointerEvents: "none",
});

const monthLabelRowStyle: React.CSSProperties = {
  position: "relative",
  height: "16px",
  marginBottom: "4px",
};

const monthLabelStyle = (leftPercent: number): React.CSSProperties => ({
  position: "absolute",
  left: `${leftPercent}%`,
  fontFamily: "var(--font-mono)",
  fontSize: "10px",
  color: "var(--color-text-muted)",
  whiteSpace: "nowrap",
});

/**
 * Single-year pixel timeline for Plant mode: the crop's own planting window
 * shaded, last-spring/first-fall frost markers, and its growth stage
 * (sprout -> young -> full) revealed by the shared playback clock — same
 * sprite/stage machinery CropCard uses, just for one crop across one year
 * instead of a whole rotation.
 */
export default function PlantTimeline({
  cropId,
  plantingWeek,
  durationWeeks,
  windowStartWeek,
  windowEndWeek,
  frostWeeks,
  playback,
}: PlantTimelineProps) {
  const spriteSet = getCropSpriteSet(cropId);
  const spriteFor: Record<GrowthStageKey, typeof spriteSet.full> = {
    sprout: spriteSet.sprout,
    young: spriteSet.young,
    full: spriteSet.full,
  };

  const widthPercent = (durationWeeks / WEEKS_PER_YEAR) * 100;
  const visibleStages = getVisibleStages(
    { startAbsoluteWeek: plantingWeek - 1, weekCount: durationWeeks },
    widthPercent,
    playback.currentWeek,
  );

  function handleTrackClick(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = (event.clientX - rect.left) / rect.width;
    playback.seek(Math.round(fraction * WEEKS_PER_YEAR));
  }

  // The planting window (and growth bar) can wrap across the year boundary
  // (e.g. a cool-season crop planted in autumn); render as two shaded
  // rectangles in that case instead of one that would wrap incorrectly.
  const windowRects: { left: number; width: number }[] =
    windowStartWeek <= windowEndWeek
      ? [{ left: ((windowStartWeek - 1) / WEEKS_PER_YEAR) * 100, width: ((windowEndWeek - windowStartWeek + 1) / WEEKS_PER_YEAR) * 100 }]
      : [
          { left: ((windowStartWeek - 1) / WEEKS_PER_YEAR) * 100, width: ((WEEKS_PER_YEAR - windowStartWeek + 1) / WEEKS_PER_YEAR) * 100 },
          { left: 0, width: (windowEndWeek / WEEKS_PER_YEAR) * 100 },
        ];

  const playheadPercent = (Math.min(playback.currentWeek, WEEKS_PER_YEAR) / WEEKS_PER_YEAR) * 100;

  return (
    <div style={outerStyle}>
      <div style={monthLabelRowStyle}>
        {[1, 5, 9].map((calendarWeek) => (
          <span key={calendarWeek} style={monthLabelStyle(((calendarWeek - 1) / WEEKS_PER_YEAR) * 100)}>
            {weekToMonthName(calendarWeek)}
          </span>
        ))}
      </div>
      <div style={trackAreaStyle} onClick={handleTrackClick}>
        {windowRects.map((rect, index) => (
          <div key={index} style={windowShadeStyle(rect.left, rect.width)} />
        ))}
        <div style={groundLineStyle} />
        <div style={frostMarkerLineStyle(((frostWeeks.last_spring_frost - 1) / WEEKS_PER_YEAR) * 100)} />
        <div style={frostMarkerLabelStyle(((frostWeeks.last_spring_frost - 1) / WEEKS_PER_YEAR) * 100)}>Last frost</div>
        <div style={frostMarkerLineStyle(((frostWeeks.first_fall_frost - 1) / WEEKS_PER_YEAR) * 100)} />
        <div style={frostMarkerLabelStyle(((frostWeeks.first_fall_frost - 1) / WEEKS_PER_YEAR) * 100)}>First frost</div>

        {visibleStages.map(({ stageKey, leftPercent: stageLeftPercent }) => {
          const sprite = spriteFor[stageKey];
          const absoluteLeftPercent = ((plantingWeek - 1) / WEEKS_PER_YEAR) * 100 + (stageLeftPercent / 100) * widthPercent;
          return (
            <div
              key={stageKey}
              style={{
                position: "absolute",
                left: `${absoluteLeftPercent}%`,
                transform: "translateX(-50%)",
                bottom: `${spriteBottomOffset(sprite)}px`,
              }}
            >
              <PixelSprite grid={sprite.rows} pixelSize={PIXEL_SIZE} />
            </div>
          );
        })}

        <div style={playheadLineStyle(playheadPercent)} />
      </div>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--color-text-muted)", margin: "4px 0 0 0" }}>
        Planting {weekToMonthDay(plantingWeek)}
      </p>
    </div>
  );
}
