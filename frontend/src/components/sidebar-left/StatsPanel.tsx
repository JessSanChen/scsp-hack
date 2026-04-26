import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import type { HistoricalStat } from '../../mockData';

interface Props { stats: HistoricalStat[]; }

const TOOLTIP_STYLE = {
  background: 'rgba(6,11,20,0.92)',
  border: '1px solid rgba(56,189,248,0.2)',
  borderRadius: 3,
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  color: '#e2e8f0',
  padding: '6px 10px',
};

const AXIS_STYLE = {
  fontFamily: 'var(--font-mono)',
  fontSize: 8,
  fill: '#334155',
};

export function StatsPanel({ stats }: Props) {
  const willData = stats.map(s => ({ turn: `T${s.turn}`, USA: s.USA_will, PRC: s.PRC_will, ROC: s.ROC_will }));
  const readyData = stats.map(s => ({ turn: `T${s.turn}`, USA: s.USA_ready, PRC: s.PRC_ready, ROC: s.ROC_ready }));

  return (
    <>
      <div className="section-label">
        <span>FACTION METRICS</span>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '6px 4px 4px', gap: 4 }}>
        {/* Political Will */}
        <ChartBlock label="POLITICAL WILL" data={willData} />

        {/* Force Readiness */}
        <ChartBlock label="FORCE READINESS" data={readyData} />
      </div>
    </>
  );
}

function ChartBlock({ label, data }: { label: string; data: { turn: string; USA: number; PRC: number; ROC: number }[] }) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 8,
          letterSpacing: '0.15em',
          color: 'var(--text-secondary)',
          padding: '2px 8px',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-usa-${label}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id={`grad-prc-${label}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.22} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
              <linearGradient id={`grad-roc-${label}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.22} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="turn" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
            <YAxis domain={[40, 100]} tick={AXIS_STYLE} axisLine={false} tickLine={false} tickCount={4} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelStyle={{ color: '#64748b', fontSize: 9 }}
              itemStyle={{ fontSize: 10 }}
            />
            <Area
              type="monotone" dataKey="USA"
              stroke="#3b82f6" strokeWidth={1.5}
              fill={`url(#grad-usa-${label})`}
              dot={false} activeDot={{ r: 3, fill: '#3b82f6' }}
            />
            <Area
              type="monotone" dataKey="PRC"
              stroke="#ef4444" strokeWidth={1.5}
              fill={`url(#grad-prc-${label})`}
              dot={false} activeDot={{ r: 3, fill: '#ef4444' }}
            />
            <Area
              type="monotone" dataKey="ROC"
              stroke="#22c55e" strokeWidth={1.5}
              fill={`url(#grad-roc-${label})`}
              dot={false} activeDot={{ r: 3, fill: '#22c55e' }}
            />
            <Legend
              iconType="plainline"
              iconSize={16}
              wrapperStyle={{ fontFamily: 'var(--font-mono)', fontSize: 8, paddingTop: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
