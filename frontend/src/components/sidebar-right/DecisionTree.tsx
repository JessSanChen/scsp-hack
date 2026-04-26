import { useState } from 'react';
import type {
  UiGameState,
  UiOutcomeCandidate,
  UiTurnData,
} from '../../sim/uiState';
import type { AppPhase } from '../../App';

const COL_X = [52, 152, 252, 352];
const ROW_Y_BASE = [70, 142, 214];
const ROW_Y_FORK = [296, 368, 440];
const NODE_W = 96;
const NODE_H = 64;
const VIEW_W = 408;
const VIEW_H = 480;
const SOLO_ROW_Y = [78, 152, 226];
const SOLO_VIEW_H = 290;

const BASELINE_ACCENT = 'rgba(56,189,248,0.55)';
const FORK_ACCENT = 'rgba(251,191,36,0.65)';

function conseqColor(c: number, alpha = 1): string {
  if (c <= 2) return `rgba(34,197,94,${alpha})`;
  if (c === 3) return `rgba(245,158,11,${alpha})`;
  return `rgba(239,68,68,${alpha})`;
}

interface NodeInfo {
  cx: number;
  cy: number;
  candidate: UiOutcomeCandidate;
  selected: boolean;
  pending: boolean;
  turn: number;
  track: 'baseline' | 'fork';
  recommendedFork?: boolean;
}

interface Props {
  baseline: UiGameState;
  fork: UiGameState | null;
  phase: AppPhase;
  recommendedForkTurn: number | null;
  onForkClick: () => void;
  forkSelectable: boolean;
}

export function DecisionTree({
  baseline,
  fork,
  phase,
  recommendedForkTurn,
  onForkClick,
  forkSelectable,
}: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  const baselineNodes = buildNodes({
    state: baseline,
    rowYs: fork ? ROW_Y_BASE : SOLO_ROW_Y,
    track: 'baseline',
    recommendedTurn: recommendedForkTurn,
    pulseRecommended: phase === 'baseline-done' && forkSelectable,
  });
  const forkNodes = fork
    ? buildNodes({
        state: fork,
        rowYs: ROW_Y_FORK,
        track: 'fork',
      })
    : [];

  const baselineLines = buildLines(baselineNodes, baseline);
  const forkLines = fork ? buildLines(forkNodes, fork) : [];

  const allNodes = [...baselineNodes, ...forkNodes];
  const hoveredNode = allNodes.find((n) => `${n.track}-${n.candidate.id}-${n.turn}` === hovered);

  const viewH = fork ? VIEW_H : SOLO_VIEW_H;

  return (
    <>
      <div className="section-label">
        <span>DECISION TREE</span>
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
          }}
        >
          {fork ? (
            <>
              <span style={{ color: '#7dd3fc' }}>BASE T{baseline.currentTurn}</span>
              <span style={{ color: '#fbbf24' }}>FORK T{fork.currentTurn}</span>
            </>
          ) : (
            <span style={{ color: 'var(--text-secondary)' }}>
              T{baseline.currentTurn}/{baseline.totalTurns || 4}
            </span>
          )}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, position: 'relative', padding: '0 8px 4px' }}>
        <svg
          viewBox={`0 0 ${VIEW_W} ${viewH}`}
          preserveAspectRatio="xMidYMin meet"
          style={{ width: '100%', height: '100%', overflow: 'visible' }}
        >
          {COL_X.map((x, i) => (
            <text
              key={i}
              x={x}
              y={12}
              textAnchor="middle"
              fontFamily="var(--font-mono)"
              fontSize="14"
              fontWeight="600"
              fill="rgba(56,189,248,0.6)"
              letterSpacing="2"
            >
              T{i + 1}
            </text>
          ))}
          {recommendedForkTurn !== null && fork && (
            <line
              x1={(COL_X[recommendedForkTurn - 1] ?? 0) - NODE_W / 2 - 4}
              y1={10}
              x2={(COL_X[recommendedForkTurn - 1] ?? 0) - NODE_W / 2 - 4}
              y2={viewH - 8}
              stroke="rgba(251,191,36,0.45)"
              strokeWidth="0.7"
              strokeDasharray="3 3"
            />
          )}

          {fork && (
            <text
              x={8}
              y={ROW_Y_BASE[0]! - 36}
              fontFamily="var(--font-mono)"
              fontSize="12"
              fontWeight="600"
              fill="#7dd3fc"
              letterSpacing="2"
            >
              BASELINE
            </text>
          )}
          {fork && (
            <text
              x={8}
              y={ROW_Y_FORK[0]! - 36}
              fontFamily="var(--font-mono)"
              fontSize="12"
              fontWeight="600"
              fill="#fbbf24"
              letterSpacing="2"
            >
              FORK
            </text>
          )}

          {baselineLines.map((l, i) => (
            <line
              key={`bl-${i}`}
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              stroke={l.isSelected ? BASELINE_ACCENT : 'rgba(255,255,255,0.08)'}
              strokeWidth={l.isSelected ? 1.4 : 0.7}
              strokeDasharray={l.isSelected ? undefined : '3 4'}
            />
          ))}
          {forkLines.map((l, i) => (
            <line
              key={`fl-${i}`}
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              stroke={l.isSelected ? FORK_ACCENT : 'rgba(251,191,36,0.18)'}
              strokeWidth={l.isSelected ? 1.4 : 0.7}
              strokeDasharray={l.isSelected ? undefined : '3 4'}
            />
          ))}

          {allNodes.map((n) => {
            const key = `${n.track}-${n.candidate.id}-${n.turn}`;
            const isHovered = hovered === key;
            const baseColor = conseqColor(n.candidate.consequentiality);
            const fillAlpha = n.selected ? 0.2 : n.pending ? 0.1 : 0.06;
            const strokeAlpha = n.selected ? 0.85 : n.pending ? 0.55 : 0.22;
            const textOpacity = n.selected ? 1 : n.pending ? 0.8 : 0.55;
            const nx = n.cx - NODE_W / 2;
            const ny = n.cy - NODE_H / 2;
            const trackAccent =
              n.track === 'baseline' ? BASELINE_ACCENT : FORK_ACCENT;
            const clickable =
              n.track === 'baseline' && n.recommendedFork && forkSelectable;

            return (
              <g
                key={key}
                style={{ cursor: clickable ? 'pointer' : 'default' }}
                onMouseEnter={() => setHovered(key)}
                onMouseLeave={() => setHovered(null)}
                onClick={clickable ? onForkClick : undefined}
              >
                {n.recommendedFork && (
                  <rect
                    x={nx - 3}
                    y={ny - 3}
                    width={NODE_W + 6}
                    height={NODE_H + 6}
                    rx={5}
                    ry={5}
                    fill="none"
                    stroke={FORK_ACCENT}
                    strokeWidth={1.6}
                    strokeDasharray="4 3"
                  >
                    <animate
                      attributeName="stroke-opacity"
                      values="0.4;1;0.4"
                      dur="1.6s"
                      repeatCount="indefinite"
                    />
                  </rect>
                )}
                {n.selected && (
                  <rect
                    x={nx - 2}
                    y={ny - 2}
                    width={NODE_W + 4}
                    height={NODE_H + 4}
                    rx={4}
                    ry={4}
                    fill="none"
                    stroke={trackAccent}
                    strokeWidth={3.5}
                    style={{ filter: 'blur(3px)' }}
                  />
                )}
                {isHovered && (
                  <rect
                    x={nx - 1}
                    y={ny - 1}
                    width={NODE_W + 2}
                    height={NODE_H + 2}
                    rx={3.5}
                    ry={3.5}
                    fill="none"
                    stroke="rgba(255,255,255,0.25)"
                    strokeWidth={2}
                    style={{ filter: 'blur(2px)' }}
                  />
                )}
                <rect
                  x={nx}
                  y={ny}
                  width={NODE_W}
                  height={NODE_H}
                  rx={3}
                  ry={3}
                  fill={conseqColor(n.candidate.consequentiality, fillAlpha)}
                  stroke={conseqColor(n.candidate.consequentiality, strokeAlpha)}
                  strokeWidth={n.selected ? 1.2 : 0.7}
                />
                <rect
                  x={nx + 3}
                  y={ny + NODE_H - 6}
                  width={(NODE_W - 6) * n.candidate.probability}
                  height={4}
                  rx={2}
                  fill={baseColor}
                  opacity={n.selected || n.pending ? 0.7 : 0.3}
                />
                <text
                  x={nx + NODE_W - 4}
                  y={ny + NODE_H - 8}
                  textAnchor="end"
                  fontFamily="var(--font-mono)"
                  fontSize="9"
                  fill={`rgba(226,232,240,${0.4 + textOpacity * 0.4})`}
                >
                  {Math.round(n.candidate.probability * 100)}%
                </text>
                <foreignObject
                  x={nx + 4}
                  y={ny + 4}
                  width={NODE_W - 8}
                  height={NODE_H - 14}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      lineHeight: 1.25,
                      color: `rgba(226,232,240,${textOpacity})`,
                      overflow: 'hidden',
                      height: '100%',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {n.candidate.summary}
                  </div>
                </foreignObject>
                {n.selected && (
                  <circle cx={nx + NODE_W - 6} cy={ny + 6} r={3.5} fill={baseColor} />
                )}
                {n.pending && (
                  <text
                    x={nx + NODE_W - 7}
                    y={ny + 11}
                    fill="rgba(245,158,11,0.7)"
                    fontSize="10"
                    fontFamily="var(--font-mono)"
                  >
                    ?
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {hoveredNode && (
          <div
            style={{
              position: 'absolute',
              bottom: 8,
              left: 8,
              right: 8,
              background: 'rgba(6,11,20,0.95)',
              border: `1px solid ${conseqColor(hoveredNode.candidate.consequentiality, 0.4)}`,
              borderRadius: 4,
              padding: '8px 10px',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span className={`conseq conseq-${hoveredNode.candidate.consequentiality}`}>
                C{hoveredNode.candidate.consequentiality}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  color: 'var(--text-secondary)',
                }}
              >
                p={Math.round(hoveredNode.candidate.probability * 100)}% conf=
                {Math.round(hoveredNode.candidate.confidence * 100)}%
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: 4 }}>
              {hoveredNode.candidate.summary}
            </p>
            <p
              style={{
                fontSize: 11,
                color: 'var(--text-secondary)',
                lineHeight: 1.4,
                fontStyle: 'italic',
              }}
            >
              {hoveredNode.candidate.rationale}
            </p>
            {hoveredNode.recommendedFork && (
              <p
                style={{
                  marginTop: 6,
                  fontSize: 11,
                  color: '#fbbf24',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.1em',
                  fontWeight: 600,
                }}
              >
                CLICK TO FORK FROM THIS DECISION
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function buildNodes(opts: {
  state: UiGameState;
  rowYs: number[];
  track: 'baseline' | 'fork';
  recommendedTurn?: number | null;
  pulseRecommended?: boolean;
}): NodeInfo[] {
  const { state, rowYs, track, recommendedTurn, pulseRecommended } = opts;
  const nodes: NodeInfo[] = [];

  const turns: UiTurnData[] = state.turns;
  const lastTurn = turns[turns.length - 1];

  turns.forEach((t) => {
    const colIdx = Math.min(COL_X.length - 1, Math.max(0, t.turn - 1));
    t.candidates.forEach((c, rowIdx) => {
      if (rowIdx >= rowYs.length) return;
      const isRecommendedTurn =
        track === 'baseline' &&
        pulseRecommended === true &&
        recommendedTurn !== null &&
        recommendedTurn !== undefined &&
        t.turn === recommendedTurn &&
        c.id === t.selectedCandidateId;
      nodes.push({
        cx: COL_X[colIdx]!,
        cy: rowYs[rowIdx]!,
        candidate: c,
        selected: c.id === t.selectedCandidateId,
        pending: false,
        turn: t.turn,
        track,
        recommendedFork: isRecommendedTurn,
      });
    });
  });

  if (state.pendingCandidates.length > 0 && state.pendingTurn !== undefined) {
    const pTurn = state.pendingTurn;
    const colIdx = Math.min(COL_X.length - 1, Math.max(0, pTurn - 1));
    state.pendingCandidates.forEach((c, rowIdx) => {
      if (rowIdx >= rowYs.length) return;
      // skip if we already added a non-pending node in the same column for this candidate
      if (lastTurn?.turn === pTurn && lastTurn.candidates.some((cc) => cc.id === c.id)) return;
      nodes.push({
        cx: COL_X[colIdx]!,
        cy: rowYs[rowIdx]!,
        candidate: c,
        selected: false,
        pending: true,
        turn: pTurn,
        track,
      });
    });
  }

  return nodes;
}

function buildLines(
  nodes: NodeInfo[],
  state: UiGameState,
): Array<{ x1: number; y1: number; x2: number; y2: number; isSelected: boolean }> {
  const lines: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    isSelected: boolean;
  }> = [];

  state.turns.forEach((t) => {
    const fromNode = nodes.find((n) => n.turn === t.turn && n.candidate.id === t.selectedCandidateId);
    if (!fromNode) return;
    const nextTurn = state.turns.find((tt) => tt.turn === t.turn + 1);
    const nextCandidates = nextTurn ? nextTurn.candidates : state.pendingCandidates;
    const nextSelectedId = nextTurn?.selectedCandidateId;
    nextCandidates.forEach((nc) => {
      const target = nodes.find(
        (n) =>
          n.candidate.id === nc.id &&
          n.turn === (nextTurn ? nextTurn.turn : state.pendingTurn ?? t.turn + 1),
      );
      if (!target) return;
      lines.push({
        x1: fromNode.cx + NODE_W / 2,
        y1: fromNode.cy,
        x2: target.cx - NODE_W / 2,
        y2: target.cy,
        isSelected: nextSelectedId === nc.id,
      });
    });
  });

  return lines;
}
