import type { ReplayPlayer } from '../sim/useReplayPlayer';
import type { AppPhase } from '../App';

const PHASE_LABEL: Record<AppPhase, string> = {
  loading: 'LOADING',
  idle: 'STANDBY',
  'baseline-running': 'BASELINE RUNNING',
  'baseline-done': 'BASELINE COMPLETE',
  'compare-running': 'COMPARE RUNNING',
  'compare-done': 'COMPARE COMPLETE',
  error: 'ERROR',
};

const PHASE_COLOR: Record<AppPhase, string> = {
  loading: '#64748b',
  idle: '#64748b',
  'baseline-running': '#22c55e',
  'baseline-done': '#38bdf8',
  'compare-running': '#f59e0b',
  'compare-done': '#a78bfa',
  error: '#ef4444',
};

interface Props {
  baseline: ReplayPlayer;
  fork: ReplayPlayer | null;
  activeTimeline: 'baseline' | 'fork';
  phase: AppPhase;
  onReset: () => void;
}

export function Header({ baseline, fork, activeTimeline, phase, onReset }: Props) {
  const phaseColor = PHASE_COLOR[phase];
  const active = activeTimeline === 'fork' && fork ? fork.state : baseline.state;
  const factions = active.factions;
  const trackPill = fork ? 'BASELINE + FORK' : 'BASELINE';

  return (
    <header
      style={{
        height: 44,
        flexShrink: 0,
        background: 'rgba(6,11,20,0.95)',
        borderBottom: '1px solid rgba(56,189,248,0.14)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        gap: 16,
        backdropFilter: 'blur(12px)',
        zIndex: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.2em',
            color: 'var(--accent)',
            textShadow: '0 0 8px rgba(56,189,248,0.5)',
            flexShrink: 0,
          }}
        >
          WARGAME//SIM
        </span>
        <span style={{ color: 'var(--border-glass-bright)', flexShrink: 0 }}>|</span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-secondary)',
            letterSpacing: '0.12em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {(active.scenarioName || 'TAIWAN STRAIT 2026').toUpperCase()}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 8.5,
            letterSpacing: '0.18em',
            padding: '2px 6px',
            background: fork
              ? 'rgba(167,139,250,0.12)'
              : 'rgba(56,189,248,0.10)',
            border: `1px solid ${
              fork ? 'rgba(167,139,250,0.35)' : 'rgba(56,189,248,0.25)'
            }`,
            color: fork ? '#c4b5fd' : '#7dd3fc',
            borderRadius: 2,
          }}
        >
          {trackPill}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontFamily: 'var(--font-mono)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 9, letterSpacing: '0.15em', color: 'var(--text-secondary)' }}>TURN</span>
          <span style={{ fontSize: 13, color: 'var(--text-primary)', letterSpacing: '0.05em' }}>
            {active.currentTurn}
            <span style={{ color: 'var(--text-secondary)', fontSize: 10 }}>
              /{active.totalTurns || 4}
            </span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: phaseColor,
              boxShadow: `0 0 8px ${phaseColor}`,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 9, letterSpacing: '0.18em', color: phaseColor }}>
            {PHASE_LABEL[phase]}
          </span>
        </div>
        <button
          onClick={onReset}
          title="Restart simulation"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.15em',
            padding: '3px 8px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            borderRadius: 2,
          }}
        >
          RESET
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {Object.values(factions).map((f) => {
          const color =
            f.id === 'USA'
              ? 'var(--usa)'
              : f.id === 'PRC'
              ? 'var(--prc)'
              : 'var(--roc)';
          return (
            <div
              key={f.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
              }}
            >
              <span style={{ color, letterSpacing: '0.12em' }}>{f.id}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <MiniBar value={f.politicalWill} color={color} label="WL" />
                <MiniBar value={f.forceReadiness} color={color} label="RD" />
              </div>
            </div>
          );
        })}
      </div>
    </header>
  );
}

function MiniBar({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ color: 'var(--text-secondary)', fontSize: 8, width: 12 }}>{label}</span>
      <div
        style={{
          width: 48,
          height: 3,
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${value}%`,
            height: '100%',
            background: color,
            opacity: 0.75,
            borderRadius: 2,
          }}
        />
      </div>
      <span style={{ color: 'var(--text-secondary)', fontSize: 8, width: 20, textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}
