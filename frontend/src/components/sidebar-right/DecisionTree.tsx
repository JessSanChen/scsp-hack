import { useState } from 'react';
import type { GameState, OutcomeCandidate } from '../../mockData';

// Layout constants
const COL_X = [38, 118, 198];          // x-center of each turn column
const ROW_Y = [52, 112, 172];          // y-center of each candidate row
const NODE_W = 68;
const NODE_H = 34;
const VIEW_W = 248;
const VIEW_H = 230;

function conseqColor(c: number, alpha = 1): string {
  if (c <= 2) return `rgba(34,197,94,${alpha})`;
  if (c === 3) return `rgba(245,158,11,${alpha})`;
  return `rgba(239,68,68,${alpha})`;
}

interface NodeInfo {
  cx: number;
  cy: number;
  candidate: OutcomeCandidate;
  selected: boolean;
  isPending: boolean;
  turn: number;
}

interface Props { state: GameState; }

export function DecisionTree({ state }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  // Build node list: one column per completed turn + one for pending
  const nodes: NodeInfo[] = [];

  state.turns.forEach((t, colIdx) => {
    if (colIdx >= COL_X.length - 1) return; // max 2 completed turns displayed
    t.candidates.forEach((c, rowIdx) => {
      if (rowIdx >= ROW_Y.length) return;
      nodes.push({
        cx: COL_X[colIdx]!,
        cy: ROW_Y[rowIdx]!,
        candidate: c,
        selected: c.id === t.selectedCandidateId,
        isPending: false,
        turn: t.turn,
      });
    });
  });

  // Pending candidates in last column
  state.pendingCandidates.forEach((c, rowIdx) => {
    if (rowIdx >= ROW_Y.length) return;
    nodes.push({
      cx: COL_X[COL_X.length - 1]!,
      cy: ROW_Y[rowIdx]!,
      candidate: c,
      selected: false,
      isPending: true,
      turn: state.currentTurn + 1,
    });
  });

  // Lines: from selected node of col N to all nodes of col N+1
  const lines: Array<{ x1: number; y1: number; x2: number; y2: number; isSelected: boolean }> = [];
  state.turns.forEach((t, colIdx) => {
    if (colIdx >= COL_X.length - 1) return;
    const selNode = nodes.find(n => n.turn === t.turn && n.candidate.id === t.selectedCandidateId);
    if (!selNode) return;
    const nextColIdx = colIdx + 1;
    const nextTurn = state.turns[nextColIdx];
    const nextCandidates = nextTurn ? nextTurn.candidates : state.pendingCandidates;
    nextCandidates.forEach((nc, rowIdx) => {
      if (rowIdx >= ROW_Y.length) return;
      const tx = COL_X[nextColIdx]!;
      const ty = ROW_Y[rowIdx]!;
      const isSelPath = nextTurn
        ? nc.id === nextTurn.selectedCandidateId
        : false;
      lines.push({
        x1: selNode.cx + NODE_W / 2,
        y1: selNode.cy,
        x2: tx - NODE_W / 2,
        y2: ty,
        isSelected: isSelPath,
      });
    });
  });

  // Lines from last completed turn's selected node to pending candidates
  const lastTurn = state.turns[state.turns.length - 1];
  if (lastTurn && state.pendingCandidates.length > 0) {
    const lastColIdx = state.turns.length - 1;
    if (lastColIdx < COL_X.length - 1) {
      const selNode = nodes.find(
        n => n.turn === lastTurn.turn && n.candidate.id === lastTurn.selectedCandidateId
      );
      if (selNode) {
        state.pendingCandidates.forEach((_nc, rowIdx) => {
          if (rowIdx >= ROW_Y.length) return;
          lines.push({
            x1: selNode.cx + NODE_W / 2,
            y1: selNode.cy,
            x2: COL_X[COL_X.length - 1]! - NODE_W / 2,
            y2: ROW_Y[rowIdx]!,
            isSelected: false,
          });
        });
      }
    }
  }

  const hoveredNode = nodes.find(n => n.candidate.id === hovered);

  return (
    <>
      <div className="section-label">
        <span>DECISION TREE</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontFamily: 'var(--font-mono)', fontSize: 8 }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            T{state.currentTurn}/{state.totalTurns}
          </span>
          {state.status === 'pending' && (
            <span style={{ color: '#f59e0b', letterSpacing: '0.12em' }}>PENDING</span>
          )}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, position: 'relative', padding: '4px 8px 4px' }}>
        {/* Column turn labels */}
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          style={{ width: '100%', height: '100%', overflow: 'visible' }}
        >
          {/* Turn column headers */}
          {COL_X.map((x, i) => {
            const isLast = i === COL_X.length - 1;
            return (
              <text
                key={i}
                x={x}
                y={18}
                textAnchor="middle"
                fontFamily="var(--font-mono)"
                fontSize="8"
                fill={isLast ? 'rgba(245,158,11,0.7)' : 'rgba(56,189,248,0.45)'}
                letterSpacing="1"
              >
                {isLast ? `T${state.currentTurn + 1}?` : `T${i + 1}`}
              </text>
            );
          })}

          {/* Column separators */}
          {COL_X.slice(0, -1).map((x, i) => (
            <line
              key={i}
              x1={(x + COL_X[i + 1]!) / 2}
              y1={24}
              x2={(x + COL_X[i + 1]!) / 2}
              y2={VIEW_H - 8}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="0.5"
              strokeDasharray="3 5"
            />
          ))}

          {/* Connector lines */}
          {lines.map((l, i) => (
            <line
              key={i}
              x1={l.x1} y1={l.y1}
              x2={l.x2} y2={l.y2}
              stroke={l.isSelected ? 'rgba(56,189,248,0.5)' : 'rgba(255,255,255,0.08)'}
              strokeWidth={l.isSelected ? 1.5 : 0.8}
              strokeDasharray={l.isSelected ? undefined : '3 4'}
            />
          ))}

          {/* Nodes */}
          {nodes.map((n) => {
            const isHovered = hovered === n.candidate.id;
            const baseColor = conseqColor(n.candidate.consequentiality);
            const fillAlpha = n.selected ? 0.18 : n.isPending ? 0.1 : 0.06;
            const strokeAlpha = n.selected ? 0.85 : n.isPending ? 0.55 : 0.22;
            const textOpacity = n.selected ? 1 : n.isPending ? 0.8 : 0.45;
            const nx = n.cx - NODE_W / 2;
            const ny = n.cy - NODE_H / 2;

            return (
              <g
                key={n.candidate.id}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHovered(n.candidate.id)}
                onMouseLeave={() => setHovered(null)}
              >
                {/* Glow for selected */}
                {n.selected && (
                  <rect
                    x={nx - 2} y={ny - 2}
                    width={NODE_W + 4} height={NODE_H + 4}
                    rx={4} ry={4}
                    fill="none"
                    stroke={conseqColor(n.candidate.consequentiality, 0.3)}
                    strokeWidth={4}
                    style={{ filter: 'blur(4px)' }}
                  />
                )}
                {/* Hover glow */}
                {isHovered && (
                  <rect
                    x={nx - 1} y={ny - 1}
                    width={NODE_W + 2} height={NODE_H + 2}
                    rx={3.5} ry={3.5}
                    fill="none"
                    stroke="rgba(255,255,255,0.25)"
                    strokeWidth={2}
                    style={{ filter: 'blur(2px)' }}
                  />
                )}
                {/* Node body */}
                <rect
                  x={nx} y={ny}
                  width={NODE_W} height={NODE_H}
                  rx={3} ry={3}
                  fill={conseqColor(n.candidate.consequentiality, fillAlpha)}
                  stroke={conseqColor(n.candidate.consequentiality, strokeAlpha)}
                  strokeWidth={n.selected ? 1.2 : 0.7}
                />
                {/* Probability bar at bottom of node */}
                <rect
                  x={nx + 2} y={ny + NODE_H - 5}
                  width={(NODE_W - 4) * n.candidate.probability}
                  height={3}
                  rx={1.5}
                  fill={baseColor}
                  opacity={n.selected || n.isPending ? 0.6 : 0.25}
                />
                {/* Summary text */}
                <foreignObject x={nx + 3} y={ny + 3} width={NODE_W - 6} height={NODE_H - 10}>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 6.5,
                      lineHeight: 1.3,
                      color: `rgba(226,232,240,${textOpacity})`,
                      overflow: 'hidden',
                      height: '100%',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {n.candidate.summary}
                  </div>
                </foreignObject>
                {/* Selected marker */}
                {n.selected && (
                  <circle
                    cx={nx + NODE_W - 6}
                    cy={ny + 6}
                    r={3}
                    fill={baseColor}
                  />
                )}
                {/* Pending spinner / question mark */}
                {n.isPending && (
                  <text
                    x={nx + NODE_W - 7}
                    y={ny + 9}
                    fill="rgba(245,158,11,0.7)"
                    fontSize="8"
                    fontFamily="var(--font-mono)"
                  >
                    ?
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
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
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-secondary)' }}>
                p={Math.round(hoveredNode.candidate.probability * 100)}%
                {' '}conf={Math.round(hoveredNode.candidate.confidence * 100)}%
              </span>
            </div>
            <p style={{ fontSize: 10.5, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: 3 }}>
              {hoveredNode.candidate.summary}
            </p>
            <p style={{ fontSize: 9.5, color: 'var(--text-secondary)', lineHeight: 1.35, fontStyle: 'italic' }}>
              {hoveredNode.candidate.rationale}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
