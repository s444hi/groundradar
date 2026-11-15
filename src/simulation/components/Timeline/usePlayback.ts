import { useCallback, useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../usePrefersReducedMotion";

export type PlaybackSpeed = 1 | 2;

export interface PlaybackApi {
  currentWeek: number;
  isPlaying: boolean;
  speed: PlaybackSpeed;
  isFinished: boolean;
  play: () => void;
  pause: () => void;
  replay: () => void;
  seek: (week: number) => void;
  setSpeed: (speed: PlaybackSpeed) => void;
  /** For a future edit (e.g. drag/swap): jump straight to the final state
   * instead of replaying the whole animation from scratch. */
  jumpToEnd: () => void;
}

// Calibrated so a full 3-year (156-week) run takes ~10s at 1x.
const WEEKS_PER_SECOND_AT_1X = 15.6;

/**
 * Drives a single shared "growth clock" (currentWeek, 0..totalWeeks) via
 * requestAnimationFrame, so every lane fed the same instance animates in
 * sync. Auto-plays once on mount unless prefers-reduced-motion is set, in
 * which case it starts already at the final week and never auto-plays.
 */
export function usePlayback(totalWeeks: number): PlaybackApi {
  const prefersReducedMotion = usePrefersReducedMotion();

  const [currentWeek, setCurrentWeek] = useState(() => (prefersReducedMotion ? totalWeeks : 0));
  const [isPlaying, setIsPlaying] = useState(() => !prefersReducedMotion);
  const [speed, setSpeedState] = useState<PlaybackSpeed>(1);

  const weekRef = useRef(currentWeek);
  const speedRef = useRef(speed);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // Keep the refs in sync after each render (not during it), so the rAF
  // loop below can read the latest currentWeek/speed without needing to
  // restart on every change.
  useEffect(() => {
    weekRef.current = currentWeek;
  }, [currentWeek]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    if (!isPlaying) {
      lastTimeRef.current = null;
      return;
    }

    function tick(time: number) {
      if (lastTimeRef.current === null) lastTimeRef.current = time;
      const deltaMs = time - lastTimeRef.current;
      lastTimeRef.current = time;

      const deltaWeeks = (deltaMs / 1000) * WEEKS_PER_SECOND_AT_1X * speedRef.current;
      const next = Math.min(totalWeeks, weekRef.current + deltaWeeks);
      weekRef.current = next;
      setCurrentWeek(next);

      if (next >= totalWeeks) {
        setIsPlaying(false);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, totalWeeks]);

  const play = useCallback(() => {
    if (weekRef.current >= totalWeeks) {
      weekRef.current = 0;
      setCurrentWeek(0);
    }
    setIsPlaying(true);
  }, [totalWeeks]);

  const pause = useCallback(() => setIsPlaying(false), []);

  const replay = useCallback(() => {
    weekRef.current = 0;
    setCurrentWeek(0);
    setIsPlaying(true);
  }, []);

  const seek = useCallback(
    (week: number) => {
      const clamped = Math.max(0, Math.min(totalWeeks, week));
      weekRef.current = clamped;
      setCurrentWeek(clamped);
      setIsPlaying(false);
    },
    [totalWeeks],
  );

  const setSpeed = useCallback((next: PlaybackSpeed) => setSpeedState(next), []);

  const jumpToEnd = useCallback(() => {
    weekRef.current = totalWeeks;
    setCurrentWeek(totalWeeks);
    setIsPlaying(false);
  }, [totalWeeks]);

  return {
    currentWeek,
    isPlaying,
    speed,
    isFinished: currentWeek >= totalWeeks,
    play,
    pause,
    replay,
    seek,
    setSpeed,
    jumpToEnd,
  };
}
