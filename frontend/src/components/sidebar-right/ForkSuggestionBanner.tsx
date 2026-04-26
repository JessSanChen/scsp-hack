import type { DemoManifestFork } from '../../sim/manifest';

interface Props {
  fork: DemoManifestFork;
  onSelect: (fork: DemoManifestFork) => void;
}

export function ForkSuggestionBanner({ fork, onSelect }: Props) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(fork)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(fork);
        }
      }}
      className="glass"
      style={{
        flexShrink: 0,
        borderRadius: 4,
        padding: '10px 12px',
        cursor: 'pointer',
        border: '1px solid rgba(251,191,36,0.45)',
        background:
          'linear-gradient(180deg, rgba(251,191,36,0.08), rgba(251,191,36,0.02))',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        boxShadow: '0 0 18px rgba(251,191,36,0.12)',
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background =
          'linear-gradient(180deg, rgba(251,191,36,0.14), rgba(251,191,36,0.05))')
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.background =
          'linear-gradient(180deg, rgba(251,191,36,0.08), rgba(251,191,36,0.02))')
      }
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 8.5,
            letterSpacing: '0.18em',
            color: '#fbbf24',
          }}
        >
          COUNTERFACTUAL READY · T{fork.fromTurn}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 8,
            letterSpacing: '0.18em',
            padding: '1px 6px',
            border: '1px solid rgba(251,191,36,0.5)',
            color: '#fbbf24',
            borderRadius: 2,
          }}
        >
          FORK ▷
        </span>
      </div>
      <div
        style={{
          fontSize: 11.5,
          color: 'var(--text-primary)',
          fontWeight: 500,
        }}
      >
        {fork.title}
      </div>
      <div
        style={{
          fontSize: 10,
          color: 'var(--text-secondary)',
          lineHeight: 1.45,
        }}
      >
        {fork.description}
      </div>
    </div>
  );
}
