import type { GameState } from '../mockData';

const STATUS_LABEL: Record<string, string> = {
  running: 'ADVANCING',
  pending: 'AWAITING INPUT',
  complete: 'CONCLUDED',
};
const STATUS_COLOR: Record<string, string> = {
  running: '#22c55e',
  pending: '#f59e0b',
  complete: '#64748b',
};

interface Props { state: GameState; }

export function Header({ state }: Props) {
  const statusColor = STATUS_COLOR[state.status] ?? '#64748b';

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
      {/* Left — branding */}
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
          {state.scenarioName.toUpperCase()}
        </span>
      </div>

      {/* Center — turn + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontFamily: 'var(--font-mono)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 9, letterSpacing: '0.15em', color: 'var(--text-secondary)' }}>TURN</span>
          <span style={{ fontSize: 13, color: 'var(--text-primary)', letterSpacing: '0.05em' }}>
            {state.currentTurn}
            <span style={{ color: 'var(--text-secondary)', fontSize: 10 }}>/{state.totalTurns}</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: statusColor,
              boxShadow: `0 0 8px ${statusColor}`,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 9, letterSpacing: '0.18em', color: statusColor }}>
            {STATUS_LABEL[state.status] ?? state.status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Right — faction readouts */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {Object.values(state.factions).map((f) => {
          const color =
            f.id === 'USA' ? 'var(--usa)'
            : f.id === 'PRC' ? 'var(--prc)'
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
      <span style={{ color: 'var(--text-secondary)', fontSize: 8, width: 20, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
