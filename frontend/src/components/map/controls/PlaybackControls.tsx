const MAX_TICK = 3;
const SPEEDS = [0.5, 1, 2, 4];

interface Props {
  currentTick: number;
  playing: boolean;
  speed: number;
  onTogglePlay: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onSpeedChange: (s: number) => void;
  onSeek: (tick: number) => void;
}

export function PlaybackControls({
  currentTick, playing, speed,
  onTogglePlay, onStepBack, onStepForward, onSpeedChange, onSeek,
}: Props) {
  const displayTurn = Math.floor(currentTick);
  const pct = (currentTick / MAX_TICK) * 100;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '7px 14px',
        background: 'rgba(6,11,20,0.85)',
        border: '1px solid rgba(56,189,248,0.2)',
        borderRadius: 4,
        backdropFilter: 'blur(12px)',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
      }}
    >
      {/* Step back */}
      <CtrlBtn onClick={onStepBack} disabled={currentTick <= 0}>{'|◁'}</CtrlBtn>

      {/* Play / Pause */}
      <CtrlBtn onClick={onTogglePlay} active={playing}>
        {playing ? '⏸' : '▶'}
      </CtrlBtn>

      {/* Step forward */}
      <CtrlBtn onClick={onStepForward} disabled={currentTick >= MAX_TICK}>{'▷|'}</CtrlBtn>

      {/* Seek bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: 'rgba(56,189,248,0.6)', letterSpacing: '0.1em', fontSize: 9 }}>
          T{displayTurn}/{MAX_TICK}
        </span>
        <div
          style={{
            width: 120,
            height: 4,
            background: 'rgba(255,255,255,0.08)',
            borderRadius: 2,
            cursor: 'pointer',
            position: 'relative',
          }}
          onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            onSeek(ratio * MAX_TICK);
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              background: playing ? '#38bdf8' : 'rgba(56,189,248,0.5)',
              borderRadius: 2,
              transition: 'background 0.2s',
            }}
          />
          {/* Thumb */}
          <div
            style={{
              position: 'absolute',
              top: -3,
              left: `${pct}%`,
              transform: 'translateX(-50%)',
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#38bdf8',
              boxShadow: '0 0 6px #38bdf8',
            }}
          />
        </div>
      </div>

      {/* Speed selector */}
      <div style={{ display: 'flex', gap: 3 }}>
        {SPEEDS.map(s => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            style={{
              padding: '2px 5px',
              background: speed === s ? 'rgba(56,189,248,0.22)' : 'transparent',
              border: `1px solid ${speed === s ? 'rgba(56,189,248,0.5)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 2,
              color: speed === s ? '#38bdf8' : 'rgba(255,255,255,0.35)',
              fontFamily: 'var(--font-mono)',
              fontSize: 8,
              cursor: 'pointer',
              letterSpacing: '0.05em',
            }}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  );
}

function CtrlBtn({
  children, onClick, disabled, active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: active ? 'rgba(56,189,248,0.18)' : 'transparent',
        border: `1px solid ${active ? 'rgba(56,189,248,0.4)' : 'rgba(255,255,255,0.12)'}`,
        borderRadius: 3,
        color: disabled ? 'rgba(255,255,255,0.2)' : active ? '#38bdf8' : 'rgba(255,255,255,0.7)',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        padding: '3px 7px',
        cursor: disabled ? 'default' : 'pointer',
        transition: 'all 0.12s',
      }}
    >
      {children}
    </button>
  );
}
