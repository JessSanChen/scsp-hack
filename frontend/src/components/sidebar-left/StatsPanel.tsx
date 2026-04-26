/**
 * Bottom-left stats panel.
 *
 * The two charts intentionally show the *master* metrics from the engine,
 * not arbitrary per-faction signals:
 *
 *   1. Escalation Ladder - escalationLevel (0..10) over time, the single
 *      number that tells you whether the strategy avoided or triggered
 *      kinetic conflict. Threshold guides at 3 (limited) / 6 (broad).
 *
 *   2. Cumulative Casualties - per-faction casualty totals, ramped from
 *      STATE_SNAPSHOT.factions[*].casualties. This is the bottom-line
 *      cost metric and changes meaningfully across the demo.
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
  Legend,
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

interface CasualtyRow {
  turn: string;
  USA?: number;
  PRC?: number;
  ROC?: number;
  USA_F?: number;
  PRC_F?: number;
  ROC_F?: number;
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

function buildCasualtyRows(
  baseline: UiHistoricalStat[],
  fork: UiHistoricalStat[] | null,
): CasualtyRow[] {
  return unionTurns(baseline, fork).map((t) => {
    const b = baseline.find((s) => s.turn === t);
    const f = fork?.find((s) => s.turn === t);
    return {
      turn: `T${t}`,
      USA: b?.USA_casualties,
      PRC: b?.PRC_casualties,
      ROC: b?.ROC_casualties,
      USA_F: f?.USA_casualties,
      PRC_F: f?.PRC_casualties,
      ROC_F: f?.ROC_casualties,
    };
  });
}

export function StatsPanel({ baseline, fork }: Props) {
  const escRows = buildEscalationRows(
    baseline.historicalStats,
    fork?.historicalStats ?? null,
  );
  const casRows = buildCasualtyRows(
    baseline.historicalStats,
    fork?.historicalStats ?? null,
  );

  const baselineEsc = baseline.escalationLevel ?? 0;
  const forkEsc = fork?.escalationLevel ?? null;

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
        <CasualtyChart rows={casRows} hasFork={!!fork} />
      </div>
    </>
  );
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
          ESCALATION LADDER (0–10)
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

function CasualtyChart({ rows, hasFork }: { rows: CasualtyRow[]; hasFork: boolean }) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <span
        style={{
          padding: '2px 8px',
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          letterSpacing: '0.18em',
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
        }}
      >
        CUMULATIVE CASUALTIES
      </span>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="rgba(148,163,184,0.08)" vertical={false} />
            <XAxis dataKey="turn" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
            <YAxis
              tick={AXIS_STYLE}
              axisLine={false}
              tickLine={false}
              tickCount={4}
              allowDecimals={false}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#64748b', fontSize: 10 }} />
            <Legend
              iconType="plainline"
              iconSize={14}
              wrapperStyle={{ fontFamily: 'var(--font-mono)', fontSize: 9, paddingTop: 0 }}
            />
            <Line
              type="monotone"
              dataKey="USA"
              stroke="#3b82f6"
              strokeWidth={1.8}
              strokeDasharray={hasFork ? '4 3' : undefined}
              strokeOpacity={hasFork ? 0.55 : 1}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="PRC"
              stroke="#ef4444"
              strokeWidth={1.8}
              strokeDasharray={hasFork ? '4 3' : undefined}
              strokeOpacity={hasFork ? 0.55 : 1}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="ROC"
              stroke="#22c55e"
              strokeWidth={1.8}
              strokeDasharray={hasFork ? '4 3' : undefined}
              strokeOpacity={hasFork ? 0.55 : 1}
              dot={false}
              isAnimationActive={false}
            />
            {hasFork && (
              <>
                <Line
                  type="monotone"
                  dataKey="USA_F"
                  name="USA fork"
                  stroke="#3b82f6"
                  strokeWidth={2.2}
                  dot={{ r: 2 }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="PRC_F"
                  name="PRC fork"
                  stroke="#ef4444"
                  strokeWidth={2.2}
                  dot={{ r: 2 }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="ROC_F"
                  name="ROC fork"
                  stroke="#22c55e"
                  strokeWidth={2.2}
                  dot={{ r: 2 }}
                  isAnimationActive={false}
                />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
