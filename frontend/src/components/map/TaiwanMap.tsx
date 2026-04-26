import { useEffect, useRef, useState } from 'react';
import { MapContainer } from './MapContainer';
import { LayerToggle } from './controls/LayerToggle';
import { useLayerToggles } from './hooks/useLayerToggles';
import type { Timeline } from './data/mapTypes';
import type { ReplayPlayer } from '../../sim/useReplayPlayer';
import type { AppPhase } from '../../App';

const MAX_TICK = 3;
const TWEEN_MS = 1400;

interface Props {
  activePlayer: ReplayPlayer;
  phase: AppPhase;
  timeline: Timeline;
}

export function TaiwanMap({ activePlayer, phase, timeline }: Props) {
  const { toggles, toggle } = useLayerToggles();

  // Tween between integer ticks so the units glide instead of snap.
  const targetTick = clamp(activePlayer.state.currentTurn, 0, MAX_TICK);
  const tickRef = useRef(targetTick);
  const fromRef = useRef(targetTick);
  const startTsRef = useRef(performance.now());
  const rafRef = useRef<number | null>(null);
  const [smoothTick, setSmoothTick] = useState(targetTick);

  useEffect(() => {
    if (targetTick === tickRef.current) return;
    fromRef.current = tickRef.current;
    tickRef.current = targetTick;
    startTsRef.current = performance.now();

    const step = (ts: number) => {
      const dt = ts - startTsRef.current;
      const f = Math.min(1, dt / TWEEN_MS);
      const eased = 0.5 - Math.cos(Math.PI * f) / 2;
      const cur = fromRef.current + (targetTick - fromRef.current) * eased;
      setSmoothTick(cur);
      if (f < 1) rafRef.current = requestAnimationFrame(step);
      else rafRef.current = null;
    };
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [targetTick]);

  const isReplaying = phase === 'baseline-running' || phase === 'compare-running';

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <MapContainer toggles={toggles} currentTick={smoothTick} timeline={timeline} />
      <LayerToggle toggles={toggles} toggle={toggle} />
      <ReplayBadge isReplaying={isReplaying} phase={phase} player={activePlayer} />
    </div>
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function ReplayBadge({
  isReplaying,
  phase,
  player,
}: {
  isReplaying: boolean;
  phase: AppPhase;
  player: ReplayPlayer;
}) {
  const t = player.state.currentTurn;
  const total = player.state.totalTurns || 4;
  const label =
    phase === 'baseline-running'
      ? 'BASELINE REPLAY'
      : phase === 'compare-running'
      ? 'FORK REPLAY'
      : phase === 'baseline-done'
      ? 'BASELINE COMPLETE'
      : phase === 'compare-done'
      ? 'COMPARE COMPLETE'
      : 'STANDBY';
  const accent =
    phase === 'baseline-running' || phase === 'baseline-done'
      ? '#7dd3fc'
      : phase === 'compare-running' || phase === 'compare-done'
      ? '#fbbf24'
      : '#94a3b8';

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '6px 14px',
        background: 'rgba(6,11,20,0.85)',
        border: `1px solid ${accent}55`,
        borderRadius: 4,
        backdropFilter: 'blur(12px)',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.16em',
        color: accent,
        pointerEvents: 'none',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: accent,
          boxShadow: `0 0 8px ${accent}`,
          animation: isReplaying ? 'pulse 1.4s ease-in-out infinite' : undefined,
        }}
      />
      <span>{label}</span>
      <span style={{ color: 'rgba(255,255,255,0.55)' }}>
        T{t}/{total}
      </span>
    </div>
  );
}
