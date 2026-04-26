import { useState } from 'react';
import type { GameState, OutcomeCandidate } from '../../mockData';

function conseqLabel(c: number): string {
  return ['', 'ROUTINE', 'LOW', 'MODERATE', 'HIGH', 'CRITICAL'][c] ?? '';
}

function conseqBarColor(c: number): string {
  if (c <= 2) return '#22c55e';
  if (c === 3) return '#f59e0b';
  return '#ef4444';
}

interface Props { state: GameState; }

export function OutcomesPanel({ state }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  const candidates =
    state.status === 'pending'
      ? state.pendingCandidates
      : state.turns[state.turns.length - 1]?.candidates ?? [];

  const turnLabel =
    state.status === 'pending'
      ? `TURN ${state.currentTurn + 1} — PENDING RESOLUTION`
      : `TURN ${state.currentTurn} — RESOLVED`;

  return (
    <>
      <div className="section-label">
        <span>OUTCOME CANDIDATES</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-secondary)' }}>
          {turnLabel}
        </span>
      </div>

      {/* Escalation question banner */}
      {state.pendingQuestion && state.status === 'pending' && (
        <div
          style={{
            margin: '6px 8px 0',
            padding: '7px 10px',
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: 3,
            fontSize: 10.5,
            color: 'rgba(245,158,11,0.9)',
            lineHeight: 1.4,
            flexShrink: 0,
          }}
        >
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.12em', marginBottom: 4, opacity: 0.7 }}>
            ESCALATION QUERY
          </div>
          {state.pendingQuestion}
        </div>
      )}

      <div className="scroll-area" style={{ padding: '6px 8px' }}>
        {candidates.map((c) => (
          <CandidateCard
            key={c.id}
            candidate={c}
            isSelected={selected === c.id}
            onClick={() => setSelected(prev => prev === c.id ? null : c.id)}
          />
        ))}
      </div>
    </>
  );
}

function CandidateCard({
  candidate,
  isSelected,
  onClick,
}: {
  candidate: OutcomeCandidate;
  isSelected: boolean;
  onClick: () => void;
}) {
  const color = conseqBarColor(candidate.consequentiality);
  const probPct = Math.round(candidate.probability * 100);
  const confPct = Math.round(candidate.confidence * 100);

  return (
    <div
      onClick={onClick}
      style={{
        marginBottom: 6,
        padding: '9px 10px',
        background: isSelected
          ? `rgba(${candidate.consequentiality >= 4 ? '239,68,68' : candidate.consequentiality === 3 ? '245,158,11' : '34,197,94'},0.07)`
          : 'rgba(255,255,255,0.025)',
        border: `1px solid ${isSelected ? `${color}44` : 'rgba(255,255,255,0.06)'}`,
        borderRadius: 4,
        cursor: 'pointer',
        transition: 'background 0.15s, border-color 0.15s',
      }}
      onMouseEnter={e => {
        if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
      }}
      onMouseLeave={e => {
        if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.025)';
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span className={`conseq conseq-${candidate.consequentiality}`}>
          {conseqLabel(candidate.consequentiality)}
        </span>
        <span
          style={{
            flex: 1,
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: color,
            textAlign: 'right',
          }}
        >
          {probPct}%
        </span>
      </div>

      {/* Summary */}
      <p style={{ fontSize: 11.5, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: 7 }}>
        {candidate.summary}
      </p>

      {/* Probability bar */}
      <div style={{ marginBottom: 5 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
            PROBABILITY
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-secondary)' }}>
            CONF {confPct}%
          </span>
        </div>
        <div className="prob-bar-track">
          <div
            className="prob-bar-fill"
            style={{ width: `${probPct}%`, background: color }}
          />
        </div>
      </div>

      {/* Rationale (expanded) */}
      {isSelected && (
        <p
          style={{
            marginTop: 6,
            paddingTop: 6,
            borderTop: '1px solid rgba(255,255,255,0.06)',
            fontSize: 10.5,
            color: 'var(--text-secondary)',
            lineHeight: 1.45,
            fontStyle: 'italic',
          }}
        >
          {candidate.rationale}
        </p>
      )}
    </div>
  );
}
