import { useState } from 'react';
import type { UiGameState, UiOutcomeCandidate } from '../../sim/uiState';

function conseqLabel(c: number): string {
  return ['', 'ROUTINE', 'LOW', 'MODERATE', 'HIGH', 'CRITICAL'][c] ?? '';
}

function conseqBarColor(c: number): string {
  if (c <= 2) return '#22c55e';
  if (c === 3) return '#f59e0b';
  return '#ef4444';
}

interface Props {
  baseline: UiGameState;
  fork: UiGameState | null;
}

export function OutcomesPanel({ baseline, fork }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  const baselineSection = pickActiveCandidates(baseline);
  const forkSection = fork ? pickActiveCandidates(fork) : null;

  return (
    <>
      <div className="section-label">
        <span>OUTCOME CANDIDATES</span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 8,
            color: 'var(--text-secondary)',
          }}
        >
          {fork ? 'COMPARE MODE' : `${baselineSection.label}`}
        </span>
      </div>

      <div className="scroll-area" style={{ padding: '6px 8px' }}>
        <CandidateSection
          title={fork ? `BASELINE — ${baselineSection.heading}` : null}
          accent="#7dd3fc"
          candidates={baselineSection.candidates}
          selectedId={selected}
          selectedCandidateId={baselineSection.selectedCandidateId}
          onSelect={(id) => setSelected((prev) => (prev === id ? null : id))}
          tagPrefix="b"
        />
        {forkSection && (
          <CandidateSection
            title={`FORK — ${forkSection.heading}`}
            accent="#fbbf24"
            candidates={forkSection.candidates}
            selectedId={selected}
            selectedCandidateId={forkSection.selectedCandidateId}
            onSelect={(id) => setSelected((prev) => (prev === id ? null : id))}
            tagPrefix="f"
          />
        )}
      </div>
    </>
  );
}

function pickActiveCandidates(state: UiGameState): {
  candidates: UiOutcomeCandidate[];
  selectedCandidateId?: string;
  heading: string;
  label: string;
} {
  if (state.status === 'pending' && state.pendingCandidates.length > 0) {
    return {
      candidates: state.pendingCandidates,
      heading: `T${state.pendingTurn ?? state.currentTurn} PENDING`,
      label: `TURN ${state.pendingTurn ?? state.currentTurn} — PENDING RESOLUTION`,
    };
  }
  const lastTurn = state.turns[state.turns.length - 1];
  if (lastTurn) {
    return {
      candidates: lastTurn.candidates,
      selectedCandidateId: lastTurn.selectedCandidateId,
      heading: `T${lastTurn.turn} RESOLVED`,
      label: `TURN ${lastTurn.turn} — RESOLVED`,
    };
  }
  return {
    candidates: [],
    heading: 'AWAITING TURN',
    label: 'AWAITING TURN',
  };
}

function CandidateSection({
  title,
  accent,
  candidates,
  selectedId,
  selectedCandidateId,
  onSelect,
  tagPrefix,
}: {
  title: string | null;
  accent: string;
  candidates: UiOutcomeCandidate[];
  selectedId: string | null;
  selectedCandidateId?: string;
  onSelect: (id: string) => void;
  tagPrefix: string;
}) {
  if (candidates.length === 0 && !title) return null;
  return (
    <div style={{ marginBottom: 6 }}>
      {title && (
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 8.5,
            letterSpacing: '0.18em',
            color: accent,
            padding: '4px 4px',
            marginBottom: 4,
            borderBottom: `1px solid ${accent}33`,
          }}
        >
          {title}
        </div>
      )}
      {candidates.length === 0 && (
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: 'var(--text-secondary)',
            padding: '8px 4px',
            opacity: 0.7,
          }}
        >
          (no candidates yet)
        </div>
      )}
      {candidates.map((c) => (
        <CandidateCard
          key={`${tagPrefix}-${c.id}`}
          candidate={c}
          isResolvedPick={c.id === selectedCandidateId}
          isSelected={selectedId === c.id}
          onClick={() => onSelect(c.id)}
        />
      ))}
    </div>
  );
}

function CandidateCard({
  candidate,
  isSelected,
  isResolvedPick,
  onClick,
}: {
  candidate: UiOutcomeCandidate;
  isSelected: boolean;
  isResolvedPick: boolean;
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
          ? `rgba(${
              candidate.consequentiality >= 4
                ? '239,68,68'
                : candidate.consequentiality === 3
                ? '245,158,11'
                : '34,197,94'
            },0.07)`
          : 'rgba(255,255,255,0.025)',
        border: `1px solid ${
          isResolvedPick ? `${color}88` : isSelected ? `${color}44` : 'rgba(255,255,255,0.06)'
        }`,
        borderRadius: 4,
        cursor: 'pointer',
        transition: 'background 0.15s, border-color 0.15s',
        boxShadow: isResolvedPick ? `0 0 0 1px ${color}22` : undefined,
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.025)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span className={`conseq conseq-${candidate.consequentiality}`}>
          {conseqLabel(candidate.consequentiality)}
        </span>
        {isResolvedPick && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 7.5,
              letterSpacing: '0.2em',
              padding: '1px 4px',
              border: `1px solid ${color}66`,
              color,
              borderRadius: 2,
            }}
          >
            SELECTED
          </span>
        )}
        <span
          style={{
            flex: 1,
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color,
            textAlign: 'right',
          }}
        >
          {probPct}%
        </span>
      </div>

      <p
        style={{
          fontSize: 11.5,
          color: 'var(--text-primary)',
          lineHeight: 1.4,
          marginBottom: 7,
        }}
      >
        {candidate.summary}
      </p>

      <div style={{ marginBottom: 5 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 8,
              color: 'var(--text-secondary)',
              letterSpacing: '0.1em',
            }}
          >
            PROBABILITY
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 8,
              color: 'var(--text-secondary)',
            }}
          >
            CONF {confPct}%
          </span>
        </div>
        <div className="prob-bar-track">
          <div className="prob-bar-fill" style={{ width: `${probPct}%`, background: color }} />
        </div>
      </div>

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
