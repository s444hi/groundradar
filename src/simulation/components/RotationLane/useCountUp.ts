import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../usePrefersReducedMotion";

/**
 * Animates a set of target numbers from 0 up to their final values over
 * `durationMs`, starting only once `trigger` becomes true (and resetting to
 * "not started" — null per value — if it goes false again, e.g. on replay).
 * With reduced motion, skips straight to the final values with no animation.
 */
export function useCountUp(targets: number[], durationMs: number, trigger: boolean): (number | null)[] {
  const prefersReducedMotion = usePrefersReducedMotion();
  const targetsRef = useRef(targets);
  useEffect(() => {
    targetsRef.current = targets;
  });

  // An edit re-scores while `trigger` (playback.isFinished) is already true,
  // so targets can change without `trigger` ever flipping false->true again.
  // Keying the restart on the targets themselves (not just `trigger`) is what
  // makes the badge pick up the new value at all; whether a *previously
  // true* trigger counts as "already running" (edit: jump straight to the
  // new value) vs "just finished" (first reveal: animate) is tracked below.
  const wasTriggeredRef = useRef(false);
  const targetsKey = targets.join(",");

  const [values, setValues] = useState<(number | null)[]>(() =>
    trigger ? targets : targets.map(() => null),
  );

  useEffect(() => {
    if (!trigger) {
      wasTriggeredRef.current = false;
      setValues(targetsRef.current.map(() => null));
      return;
    }

    const isFreshFinish = !wasTriggeredRef.current;
    wasTriggeredRef.current = true;

    if (prefersReducedMotion || !isFreshFinish) {
      // Reduced motion, or the targets changed from an edit while already
      // finished: show the new value immediately, no animation.
      setValues(targetsRef.current);
      return;
    }

    let rafId: number;
    let startTime: number | null = null;

    function tick(time: number) {
      if (startTime === null) startTime = time;
      const progress = Math.min(1, (time - startTime) / durationMs);
      setValues(targetsRef.current.map((target) => target * progress));
      if (progress < 1) rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [trigger, prefersReducedMotion, durationMs, targetsKey]);

  return values;
}
