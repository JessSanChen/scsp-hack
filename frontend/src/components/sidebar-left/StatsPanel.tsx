/**
 * Bottom-left stats panel.
 *
 * The two charts intentionally show the *master* environmental metrics
 * from the engine, not arbitrary per-faction signals:
 *
 *   1. Escalation Ladder - escalationLevel (0..10) over time, the single
 *      number that tells you whether the strategy avoided or triggered
 *      kinetic conflict. Threshold guides at 3 (limited) / 6 (broad).
 *
 *   2. Regional Tension - avgTension (0..10) over time, the mean
 *      tensionLevel across the scenario's regions. This is the broader
 *      "operating environment" signal: it captures pressure across the
 *      theater rather than just kinetic escalation.
 *
 * In compare mode the baseline series renders dashed/faded, the fork
 * series renders solid/full-strength.
 */

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import type { UiGameState, UiHistoricalStat } from '../../sim/uiState';

interface Props {
  baseline: UiGameState;
  fork: UiGameState | null;
}

const TOOLTIP_STYLE: React.CSSProperties = {
  background: 'rgba(6,11,20,0.94)',
  border: '1px solid rgba(56,189,248,0.25)',
  borderRadius: 4,
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  color: '#e2e8f0',
  padding: '6px 10px',
};
const AXIS_STYLE = { fontFamily: 'var(--font-mono)', fontSize: 9, fill: '#475569' };

interface EscRow {
  turn: string;
  base?: number;
  fork?: number;
}

interface TensionRow {
  turn: string;
  base?: number;
  fork?: number;
}

function unionTurns(
  baseline: UiHistoricalStat[],
  fork: UiHistoricalStat[] | null,
): number[] {
  const set = new Set<number>();
  baseline.forEach((s) => set.add(s.turn));
  fork?.forEach((s) => set.add(s.turn));
  return [...set].sort((a, b) => a - b);
}

function buildEscalationRows(
  baseline: UiHistoricalStat[],
  fork: UiHistoricalStat[] | null,
): EscRow[] {
  return unionTurns(baseline, fork).map((t) => {
    const b = baseline.find((s) => s.turn === t);
    const f = fork?.find((s) => s.turn === t);
    return {
      turn: `T${t}`,
      base: b?.escalationLevel,
      fork: f?.escalationLevel,
    };
  });
}

function buildTensionRows(
  baseline: UiHistoricalStat[],
  fork: UiHistoricalStat[] | null,
): TensionRow[] {
  return unionTurns(baseline, fork).map((t) => {
    const b = baseline.find((s) => s.turn === t);
    const f = fork?.find((s) => s.turn === t);
    return {
      turn: `T${t}`,
      base: b?.avgTension,
      fork: f?.avgTension,
    };
  });
}

export function StatsPanel({ baseline, fork }: Props) {
  const escRows = buildEscalationRows(
    baseline.historicalStats,
    fork?.historicalStats ?? null,
  );
  const tensionRows = buildTensionRows(
    baseline.historicalStats,
    fork?.historicalStats ?? null,
  );

  const baselineEsc = baseline.escalationLevel ?? 0;
  const forkEsc = fork?.escalationLevel ?? null;

  const lastBaselineTension =
    baseline.historicalStats[baseline.historicalStats.length - 1]?.avgTension ?? 0;
  const lastForkTension =
    fork?.historicalStats[fork.historicalStats.length - 1]?.avgTension ?? null;

  return (
    <>
      <div className="section-label">
        <span>STRATEGIC METRICS</span>
        {fork && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-secondary)' }}>
            <span style={{ color: '#7dd3fc' }}>--- BASELINE</span>
            {'  '}
            <span style={{ color: '#fbbf24' }}>― FORK</span>
          </span>
        )}
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: '6px 4px 4px',
          gap: 8,
        }}
      >
        <EscalationChart
          rows={escRows}
          baselineEsc={baselineEsc}
          forkEsc={forkEsc}
          hasFork={!!fork}
        />
        <TensionChart
          rows={tensionRows}
          baselineTension={lastBaselineTension}
          forkTension={lastForkTension}
          hasFork={!!fork}
        />
      </div>
    </>
  );
}

const ESCALATION_THRESHOLD = 3;

type EscalationStatus = 'normal' | 'red' | 'green';

function computeEscalationStatus(
  rows: EscRow[],
  hasFork: boolean,
  forkEsc: number | null,
): EscalationStatus {
  const baselineCrossed = rows.some(
    (r) => (r.base ?? 0) > ESCALATION_THRESHOLD,
  );
  const forkCrossed = rows.some(
    (r) => (r.fork ?? 0) > ESCALATION_THRESHOLD,
  );

  // Once a fork is in flight and finishes below the alert threshold without
  // ever crossing it, treat the situation as "resolved" - the strategist's
  // alternative path averted the escalation.
  if (
    hasFork &&
    forkEsc !== null &&
    forkEsc <= ESCALATION_THRESHOLD &&
    !forkCrossed
  ) {
    return 'green';
  }

  if (baselineCrossed || forkCrossed) return 'red';
  return 'normal';
}

function EscalationChart({
  rows,
  baselineEsc,
  forkEsc,
  hasFork,
}: {
  rows: EscRow[];
  baselineEsc: number;
  forkEsc: number | null;
  hasFork: boolean;
}) {
  const maxLevel = Math.max(
    4,
    Math.ceil(
      Math.max(
        baselineEsc,
        forkEsc ?? 0,
        ...rows.flatMap((r) => [r.base ?? 0, r.fork ?? 0]),
      ),
    ),
  );

  const status = computeEscalationStatus(rows, hasFork, forkEsc);
  const statusBorder =
    status === 'red'
      ? '1px solid rgba(239,68,68,0.55)'
      : status === 'green'
        ? '1px solid rgba(34,197,94,0.55)'
        : '1px solid transparent';
  const statusBg =
    status === 'red'
      ? 'rgba(239,68,68,0.06)'
      : status === 'green'
        ? 'rgba(34,197,94,0.06)'
        : 'transparent';
  const statusLabelColor =
    status === 'red'
      ? '#ef4444'
      : status === 'green'
        ? '#22c55e'
        : 'var(--text-secondary)';

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        border: statusBorder,
        background: statusBg,
        borderRadius: 4,
        transition: 'border-color 0.4s ease, background 0.4s ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          padding: '2px 8px',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <span
          style={{
            fontSize: 9,
            letterSpacing: '0.18em',
            color: statusLabelColor,
            textTransform: 'uppercase',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            transition: 'color 0.4s ease',
          }}
        >
          ESCALATION LADDER (0–10)
          {status === 'green' && (
            <svg
              viewBox="0 0 16 16"
              width="11"
              height="11"
              aria-hidden="true"
              style={{ display: 'inline-block' }}
            >
              <circle cx="8" cy="8" r="7" fill="rgba(34,197,94,0.18)" stroke="#22c55e" strokeWidth="1.2" />
              <path
                d="M4.5 8.2 L7 10.6 L11.5 5.6"
                fill="none"
                stroke="#22c55e"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
        <span style={{ fontSize: 11, color: '#e2e8f0' }}>
          <span style={{ color: '#7dd3fc' }}>{baselineEsc.toFixed(0)}</span>
          {hasFork && forkEsc !== null && (
            <>
              <span style={{ color: '#475569', margin: '0 4px' }}>|</span>
              <span style={{ color: '#fbbf24' }}>{forkEsc.toFixed(0)}</span>
            </>
          )}
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 4, right: 12, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="rgba(148,163,184,0.08)" vertical={false} />
            <XAxis dataKey="turn" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
            <YAxis
              domain={[0, maxLevel]}
              tick={AXIS_STYLE}
              axisLine={false}
              tickLine={false}
              tickCount={Math.min(maxLevel + 1, 6)}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#64748b', fontSize: 10 }} />
            <ReferenceLine
              y={3}
              stroke="rgba(245,158,11,0.4)"
              strokeDasharray="4 4"
              label={{
                value: 'limited',
                position: 'right',
                fill: '#f59e0b',
                fontSize: 8,
                fontFamily: 'var(--font-mono)',
              }}
            />
            <ReferenceLine
              y={6}
              stroke="rgba(239,68,68,0.45)"
              strokeDasharray="4 4"
              label={{
                value: 'broad',
                position: 'right',
                fill: '#ef4444',
                fontSize: 8,
                fontFamily: 'var(--font-mono)',
              }}
            />
            <Area
              type="monotone"
              dataKey="base"
              name="baseline"
              stroke="#7dd3fc"
              fill="#0ea5e9"
              fillOpacity={hasFork ? 0.08 : 0.18}
              strokeWidth={hasFork ? 1.6 : 2.2}
              strokeDasharray={hasFork ? '4 3' : undefined}
              strokeOpacity={hasFork ? 0.7 : 1}
              dot={{ r: 2, fill: '#7dd3fc' }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
            {hasFork && (
              <Line
                type="monotone"
                dataKey="fork"
                name="fork"
                stroke="#fbbf24"
                strokeWidth={2.4}
                dot={{ r: 2.5, fill: '#fbbf24' }}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TensionChart({
  rows,
  baselineTension,
  forkTension,
  hasFork,
}: {
  rows: TensionRow[];
  baselineTension: number;
  forkTension: number | null;
  hasFork: boolean;
}) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          padding: '2px 8px',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <span
          style={{
            fontSize: 9,
            letterSpacing: '0.18em',
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
          }}
        >
          REGIONAL TENSION (0–10)
        </span>
        <span style={{ fontSize: 11, color: '#e2e8f0' }}>
          <span style={{ color: '#7dd3fc' }}>{baselineTension.toFixed(1)}</span>
          {hasFork && forkTension !== null && (
            <>
              <span style={{ color: '#475569', margin: '0 4px' }}>|</span>
              <span style={{ color: '#fbbf24' }}>{forkTension.toFixed(1)}</span>
            </>
          )}
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 4, right: 12, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="rgba(148,163,184,0.08)" vertical={false} />
            <XAxis dataKey="turn" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
            <YAxis
              domain={[0, 10]}
              tick={AXIS_STYLE}
              axisLine={false}
              tickLine={false}
              tickCount={6}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#64748b', fontSize: 10 }} />
            <ReferenceLine
              y={5}
              stroke="rgba(148,163,184,0.25)"
              strokeDasharray="2 4"
              label={{
                value: 'baseline',
                position: 'right',
                fill: '#94a3b8',
                fontSize: 8,
                fontFamily: 'var(--font-mono)',
              }}
            />
            <Area
              type="monotone"
              dataKey="base"
              name="baseline"
              stroke="#7dd3fc"
              fill="#0ea5e9"
              fillOpacity={hasFork ? 0.08 : 0.18}
              strokeWidth={hasFork ? 1.6 : 2.2}
              strokeDasharray={hasFork ? '4 3' : undefined}
              strokeOpacity={hasFork ? 0.7 : 1}
              dot={{ r: 2, fill: '#7dd3fc' }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
            {hasFork && (
              <Line
                type="monotone"
                dataKey="fork"
                name="fork"
                stroke="#fbbf24"
                strokeWidth={2.4}
                dot={{ r: 2.5, fill: '#fbbf24' }}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
