import type { GameState } from '../mockData';
import { TaiwanMap } from './map/TaiwanMap';
import { NewsFeed } from './sidebar-left/NewsFeed';
import { StatsPanel } from './sidebar-left/StatsPanel';
import { DecisionTree } from './sidebar-right/DecisionTree';
import { OutcomesPanel } from './sidebar-right/OutcomesPanel';

interface Props { state: GameState; }

export function Layout({ state }: Props) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: '272px 1fr 316px',
        gap: 6,
        padding: 6,
        overflow: 'hidden',
      }}
    >
      {/* ── Left sidebar ── */}
      <aside
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <div
          className="glass"
          style={{ flex: '1 1 58%', display: 'flex', flexDirection: 'column', minHeight: 0, borderRadius: 4, overflow: 'hidden' }}
        >
          <NewsFeed items={state.news} />
        </div>
        <div
          className="glass"
          style={{ flex: '1 1 42%', display: 'flex', flexDirection: 'column', minHeight: 0, borderRadius: 4, overflow: 'hidden' }}
        >
          <StatsPanel stats={state.historicalStats} />
        </div>
      </aside>

      {/* ── Center map ── */}
      <main
        className="glass"
        style={{
          borderRadius: 4,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        <div className="section-label">
          <span>OPERATIONAL MAP — WESTERN PACIFIC</span>
          <div className="dot" />
        </div>
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <TaiwanMap state={state} />
        </div>
      </main>

      {/* ── Right sidebar ── */}
      <aside
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <div
          className="glass"
          style={{ flex: '1 1 55%', display: 'flex', flexDirection: 'column', minHeight: 0, borderRadius: 4, overflow: 'hidden' }}
        >
          <DecisionTree state={state} />
        </div>
        <div
          className="glass"
          style={{ flex: '1 1 45%', display: 'flex', flexDirection: 'column', minHeight: 0, borderRadius: 4, overflow: 'hidden' }}
        >
          <OutcomesPanel state={state} />
        </div>
      </aside>
    </div>
  );
}
