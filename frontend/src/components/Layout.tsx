import type { ReplayPlayer } from '../sim/useReplayPlayer';
import type { DemoManifest, DemoManifestFork } from '../sim/manifest';
import type { AppPhase, ForkSelection } from '../App';
import type { Timeline } from './map/data/mapTypes';
import { TaiwanMap } from './map/TaiwanMap';
import { NewsFeed } from './sidebar-left/NewsFeed';
import { StatsPanel } from './sidebar-left/StatsPanel';
import { DecisionTree } from './sidebar-right/DecisionTree';
import { OutcomesPanel } from './sidebar-right/OutcomesPanel';
import { ForkSuggestionBanner } from './sidebar-right/ForkSuggestionBanner';

interface Props {
  baseline: ReplayPlayer;
  fork: ReplayPlayer | null;
  manifest: DemoManifest | null;
  forkSelection: ForkSelection | null;
  phase: AppPhase;
  activePlayer: ReplayPlayer;
  activeTimeline: Timeline;
  onSelectFork: (fork: DemoManifestFork) => void;
}

export function Layout({
  baseline,
  fork,
  manifest,
  forkSelection,
  phase,
  activePlayer,
  activeTimeline,
  onSelectFork,
}: Props) {
  const showForkSuggestion =
    !forkSelection &&
    phase === 'baseline-done' &&
    manifest &&
    manifest.forks.length > 0;

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: '320px 1fr 400px',
        gap: 6,
        padding: 6,
        overflow: 'hidden',
      }}
    >
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
          style={{
            flex: '1 1 68%',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <NewsFeed
            baseline={baseline.state}
            fork={fork?.state ?? null}
          />
        </div>
        <div
          className="glass"
          style={{
            flex: '1 1 32%',
            minHeight: 220,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <StatsPanel
            baseline={baseline.state}
            fork={fork?.state ?? null}
          />
        </div>
      </aside>

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
          <TaiwanMap activePlayer={activePlayer} phase={phase} timeline={activeTimeline} />
        </div>
      </main>

      <aside
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {showForkSuggestion && manifest && (
          <ForkSuggestionBanner
            fork={manifest.forks[0]}
            onSelect={onSelectFork}
          />
        )}
        <div
          className="glass"
          style={{
            flex: '1 1 70%',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <DecisionTree
            baseline={baseline.state}
            fork={fork?.state ?? null}
            phase={phase}
            recommendedForkTurn={manifest?.forks[0]?.fromTurn ?? null}
            onForkClick={() => {
              if (manifest?.forks[0]) onSelectFork(manifest.forks[0]);
            }}
            forkSelectable={!forkSelection && phase === 'baseline-done'}
          />
        </div>
        <div
          className="glass"
          style={{
            flex: '1 1 30%',
            minHeight: 200,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <OutcomesPanel
            baseline={baseline.state}
            fork={fork?.state ?? null}
          />
        </div>
      </aside>
    </div>
  );
}
