import { useState, useRef, useEffect, useCallback } from 'react';
import type { TacticalUnit, Timeline, LatLng } from '../data/mapTypes';

const TURNS_PER_SECOND = 0.15; // full scenario (3 steps) in ~6.7s at 1×
const MAX_TICK = 3;

function positionForTurn(
  unit: TacticalUnit,
  turn: 0 | 1 | 2 | 3,
  timeline: Timeline,
): LatLng {
  if (timeline === 'fork' && unit.forkPositions?.[turn]) {
    return unit.forkPositions[turn]!;
  }
  return unit.turnPositions[turn];
}

export function visibleAt(
  unit: TacticalUnit,
  turn: 0 | 1 | 2 | 3,
  timeline: Timeline,
): boolean {
  if (timeline === 'fork') {
    if (unit.forkVisibleAtTurn?.[turn] !== undefined) return unit.forkVisibleAtTurn[turn]!;
  }
  if (unit.visibleAtTurn?.[turn] !== undefined) return unit.visibleAtTurn[turn]!;
  return true;
}

export function threatScale(
  unit: TacticalUnit,
  turn: 0 | 1 | 2 | 3,
): number {
  return unit.threatScaleAtTurn?.[turn] ?? 1;
}

export function interpolatePosition(
  unit: TacticalUnit,
  tick: number,
  timeline: Timeline = 'baseline',
): LatLng {
  const t0 = Math.max(0, Math.min(MAX_TICK - 1, Math.floor(tick))) as 0 | 1 | 2;
  const t1 = Math.min(MAX_TICK, t0 + 1) as 0 | 1 | 2 | 3;
  const frac = tick - t0;
  const p0 = positionForTurn(unit, t0, timeline);
  const p1 = positionForTurn(unit, t1, timeline);
  return {
    lat: p0.lat + (p1.lat - p0.lat) * frac,
    lng: p0.lng + (p1.lng - p0.lng) * frac,
  };
}

export function interpolateThreatScale(unit: TacticalUnit, tick: number): number {
  const t0 = Math.max(0, Math.min(MAX_TICK - 1, Math.floor(tick))) as 0 | 1 | 2;
  const t1 = Math.min(MAX_TICK, t0 + 1) as 0 | 1 | 2 | 3;
  const frac = tick - t0;
  const s0 = threatScale(unit, t0);
  const s1 = threatScale(unit, t1);
  return s0 + (s1 - s0) * frac;
}

export function interpolateVisibility(
  unit: TacticalUnit,
  tick: number,
  timeline: Timeline,
): number {
  // Fade based on the closer of the two anchor turns. Returns 0..1.
  const t0 = Math.max(0, Math.min(MAX_TICK - 1, Math.floor(tick))) as 0 | 1 | 2;
  const t1 = Math.min(MAX_TICK, t0 + 1) as 0 | 1 | 2 | 3;
  const v0 = visibleAt(unit, t0, timeline) ? 1 : 0;
  const v1 = visibleAt(unit, t1, timeline) ? 1 : 0;
  const frac = tick - t0;
  return v0 + (v1 - v0) * frac;
}

export function useMapAnimation(initialTurn: number) {
  const [currentTick, setCurrentTick] = useState<number>(initialTurn);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const rafRef = useRef<number>(0);
  const lastTsRef = useRef<number>(0);
  const playingRef = useRef(playing);
  const speedRef = useRef(speed);

  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  useEffect(() => {
    if (!playing) {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    lastTsRef.current = performance.now();

    const loop = (ts: number) => {
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      setCurrentTick(prev => {
        const next = prev + dt * speedRef.current * TURNS_PER_SECOND;
        if (next >= MAX_TICK) {
          setPlaying(false);
          return MAX_TICK;
        }
        return next;
      });
      if (playingRef.current) {
        rafRef.current = requestAnimationFrame(loop);
      }
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing]);

  const stepForward = useCallback(() => {
    setPlaying(false);
    setCurrentTick(prev => Math.min(MAX_TICK, Math.round(prev) + 1));
  }, []);

  const stepBack = useCallback(() => {
    setPlaying(false);
    setCurrentTick(prev => Math.max(0, Math.round(prev) - 1));
  }, []);

  const seek = useCallback((tick: number) => {
    setPlaying(false);
    setCurrentTick(Math.max(0, Math.min(MAX_TICK, tick)));
  }, []);

  const togglePlay = useCallback(() => {
    setCurrentTick(prev => {
      if (prev >= MAX_TICK) return 0; // restart from beginning
      return prev;
    });
    setPlaying(p => !p);
  }, []);

  return {
    currentTick,
    playing,
    speed,
    setSpeed,
    togglePlay,
    stepForward,
    stepBack,
    seek,
  };
}
