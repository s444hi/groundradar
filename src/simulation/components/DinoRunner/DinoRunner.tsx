import PixelSprite from "../PixelSprite";
import { FARMER_SPRITE, HAZARD_ICONS } from "../sprites";
import { GROUND_LINE_TOP } from "../Timeline/layout";
import type { PlaybackApi } from "../Timeline/usePlayback";
import { WEEKS_PER_SECOND } from "../Timeline/usePlayback";
import { usePrefersReducedMotion } from "../usePrefersReducedMotion";
import type { Hazard } from "../../engine/hazards";

export interface DinoRunnerProps {
  hazards: Hazard[];
  totalWeeks: number;
  playback: PlaybackApi;
}

const RUNNER_PIXEL_SIZE = 3;
const HAZARD_ICON_PIXEL_SIZE = 2;
// Wall-clock-paced leg swap (not simulated weeks, which would blur by at
// WEEKS_PER_SECOND's actual speed) — derived from currentWeek itself
// (a pure function of props) rather than reading the clock during render.
const FRAME_SWAP_SECONDS = 0.25;
const WEEKS_PER_FRAME_SWAP = WEEKS_PER_SECOND * FRAME_SWAP_SECONDS;

function spriteStyle(leftPercent: number): React.CSSProperties {
  return {
    position: "absolute",
    left: `${leftPercent}%`,
    bottom: `${GROUND_LINE_TOP}px`,
    transform: "translateX(-50%)",
    pointerEvents: "none",
  };
}

/**
 * Replays the engine's own hazards (engine/hazards.ts) — it never decides
 * hit/cleared itself. A small pixel farmer stands at the playhead; hazard
 * icons reveal as the playhead passes them and stay gray (cleared) or turn
 * --color-sim-risk (hit). No hop/stumble animation, no tally — just the
 * run-cycle leg swap and the icons' own reveal/color.
 */
export default function DinoRunner({ hazards, totalWeeks, playback }: DinoRunnerProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const showRunner = !playback.isFinished && !prefersReducedMotion;

  const runnerPercent = (Math.min(playback.currentWeek, totalWeeks) / totalWeeks) * 100;
  const frame =
    Math.floor(playback.currentWeek / WEEKS_PER_FRAME_SWAP) % 2 === 0 ? FARMER_SPRITE.frame1 : FARMER_SPRITE.frame2;

  return (
    <>
      {hazards
        .filter((hazard) => hazard.absoluteWeek <= playback.currentWeek)
        .map((hazard) => {
          const icon = HAZARD_ICONS[hazard.type];
          const leftPercent = (hazard.absoluteWeek / totalWeeks) * 100;
          return (
            <div
              key={`${hazard.type}-${hazard.absoluteWeek}`}
              title={hazard.reason}
              style={{ ...spriteStyle(leftPercent), pointerEvents: "auto" }}
            >
              <PixelSprite
                grid={icon.rows}
                pixelSize={HAZARD_ICON_PIXEL_SIZE}
                color={hazard.cleared ? "var(--color-text-muted)" : "var(--color-sim-risk)"}
              />
            </div>
          );
        })}
      {showRunner && (
        <div style={spriteStyle(runnerPercent)}>
          <PixelSprite grid={frame.rows} pixelSize={RUNNER_PIXEL_SIZE} />
        </div>
      )}
    </>
  );
}
