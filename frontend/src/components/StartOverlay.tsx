interface Props {
  status: 'loading' | 'ready' | 'error';
  error?: string;
  onStart: () => void;
}

export function StartOverlay({ status, error, onStart }: Props) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(2,6,14,0.78)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
    >
      <div
        style={{
          background: 'rgba(8,14,26,0.92)',
          border: '1px solid rgba(56,189,248,0.25)',
          borderRadius: 6,
          padding: '28px 36px',
          minWidth: 380,
          textAlign: 'center',
          boxShadow: '0 0 60px rgba(56,189,248,0.12)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.32em',
            color: 'rgba(56,189,248,0.65)',
            marginBottom: 10,
          }}
        >
          WARGAME // SIM CONTROL
        </div>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: '#e2e8f0',
            marginBottom: 6,
            letterSpacing: '0.02em',
          }}
        >
          Taiwan Strait 2026
        </h2>
        <p
          style={{
            fontSize: 11.5,
            color: 'var(--text-secondary)',
            lineHeight: 1.55,
            marginBottom: 20,
            maxWidth: 340,
            margin: '0 auto 20px',
          }}
        >
          Pre-recorded autonomous baseline. After the run completes, click the
          highlighted T2 node or the suggestion banner to fork into a
          counterfactual where the USA forces a pre-emptive strike.
        </p>

        {status === 'error' && (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: '#ef4444',
              marginBottom: 14,
              padding: '8px 10px',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 3,
            }}
          >
            {error ?? 'Failed to load demo data.'}
          </div>
        )}

        <button
          onClick={onStart}
          disabled={status !== 'ready'}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.18em',
            padding: '10px 32px',
            background:
              status === 'ready'
                ? 'rgba(56,189,248,0.16)'
                : 'rgba(255,255,255,0.04)',
            border: `1px solid ${
              status === 'ready' ? 'rgba(56,189,248,0.55)' : 'rgba(255,255,255,0.08)'
            }`,
            color: status === 'ready' ? '#7dd3fc' : 'var(--text-secondary)',
            cursor: status === 'ready' ? 'pointer' : 'not-allowed',
            borderRadius: 3,
            transition: 'background 0.15s, border-color 0.15s',
            textShadow: status === 'ready' ? '0 0 10px rgba(56,189,248,0.45)' : 'none',
          }}
        >
          {status === 'loading' ? 'LOADING…' : 'START SIMULATION'}
        </button>
      </div>
    </div>
  );
}
