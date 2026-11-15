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

  const [values, setValues] = useState<(number | null)[]>(() =>
    trigger ? targets : targets.map(() => null),
  );

  useEffect(() => {
    if (!trigger) {
      setValues(targetsRef.current.map(() => null));
      return;
    }

    if (prefersReducedMotion) {
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
  }, [trigger, prefersReducedMotion, durationMs]);

  return values;
}
