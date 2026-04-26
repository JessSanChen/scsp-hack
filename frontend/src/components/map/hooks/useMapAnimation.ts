import { useState, useRef, useEffect, useCallback } from 'react';
import type { TacticalUnit, LatLng } from '../data/mapTypes';

const TURNS_PER_SECOND = 0.15; // full scenario (3 steps) in ~6.7s at 1×
const MAX_TICK = 3;

export function interpolatePosition(unit: TacticalUnit, tick: number): LatLng {
  const t0 = Math.max(0, Math.min(MAX_TICK - 1, Math.floor(tick))) as 0 | 1 | 2;
  const t1 = Math.min(MAX_TICK, t0 + 1) as 0 | 1 | 2 | 3;
  const frac = tick - t0;
  const p0 = unit.turnPositions[t0];
  const p1 = unit.turnPositions[t1];
  return {
    lat: p0.lat + (p1.lat - p0.lat) * frac,
    lng: p0.lng + (p1.lng - p0.lng) * frac,
  };
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
