import { useCallback, useEffect, useMemo, useState } from 'react';
import { Header } from './components/Header';
import { Layout } from './components/Layout';
import { StartOverlay } from './components/StartOverlay';
import {
  loadManifest,
  type DemoManifest,
  type DemoManifestFork,
} from './sim/manifest';
import { useReplayPlayer, type ReplayPlayer } from './sim/useReplayPlayer';
import type { ReducerMeta } from './sim/reducer';

const MANIFEST_URL = '/demo/manifest.json';
const STATIC_META: ReducerMeta = {
  scenarioName: 'Taiwan Strait 2026',
  totalTurns: 4,
};

export type AppPhase =
  | 'loading'
  | 'idle'
  | 'baseline-running'
  | 'baseline-done'
  | 'compare-running'
  | 'compare-done'
  | 'error';

export interface ForkSelection {
  fork: DemoManifestFork;
}

export function App() {
  const [manifest, setManifest] = useState<DemoManifest | null>(null);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [forkSelection, setForkSelection] = useState<ForkSelection | null>(null);

  // Load manifest once at boot
  useEffect(() => {
    let cancelled = false;
    loadManifest(MANIFEST_URL)
      .then((m) => {
        if (!cancelled) setManifest(m);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setManifestError(
            err instanceof Error ? err.message : String(err),
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Baseline player - URL becomes available once manifest is loaded.
  const baseline = useReplayPlayer({
    url: manifest?.baseline.events ?? null,
    meta: STATIC_META,
  });

  // Fork player - lazy: URL is null until the user picks a fork.
  const fork = useReplayPlayer({
    url: forkSelection?.fork.events ?? null,
    meta: STATIC_META,
  });

  // Auto-start the fork the moment its events finish loading.
  useEffect(() => {
    if (!forkSelection) return;
    if (fork.status === 'ready') {
      fork.start();
    }
  }, [forkSelection, fork]);

  const phase: AppPhase = useMemo(() => {
    if (manifestError) return 'error';
    if (!manifest) return 'loading';
    if (!hasStarted) return 'idle';
    if (forkSelection) {
      if (fork.status === 'complete') return 'compare-done';
      return 'compare-running';
    }
    if (baseline.status === 'complete') return 'baseline-done';
    return 'baseline-running';
  }, [manifest, manifestError, hasStarted, forkSelection, baseline.status, fork.status]);

  const startBaseline = useCallback(() => {
    if (baseline.status === 'ready' || baseline.status === 'paused') {
      setHasStarted(true);
      baseline.start();
    }
  }, [baseline]);

  const handleSelectFork = useCallback(
    (forkEntry: DemoManifestFork) => {
      setForkSelection({ fork: forkEntry });
    },
    [],
  );

  const handleReset = useCallback(() => {
    setForkSelection(null);
    setHasStarted(false);
    baseline.reset();
  }, [baseline]);

  // The "active" timeline drives the map + header faction bars.
  const activeTimeline: 'baseline' | 'fork' = forkSelection ? 'fork' : 'baseline';
  const activePlayer: ReplayPlayer = activeTimeline === 'fork' ? fork : baseline;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <Header
        baseline={baseline}
        fork={forkSelection ? fork : null}
        activeTimeline={activeTimeline}
        phase={phase}
        onReset={handleReset}
      />
      <Layout
        baseline={baseline}
        fork={forkSelection ? fork : null}
        manifest={manifest}
        forkSelection={forkSelection}
        phase={phase}
        activePlayer={activePlayer}
        activeTimeline={activeTimeline}
        onSelectFork={handleSelectFork}
      />

      {phase === 'loading' && (
        <StartOverlay
          status="loading"
          onStart={() => {
            /* disabled */
          }}
        />
      )}
      {phase === 'error' && (
        <StartOverlay
          status="error"
          error={manifestError ?? 'Unknown error'}
          onStart={() => {
            /* disabled */
          }}
        />
      )}
      {phase === 'idle' && (
        <StartOverlay
          status={baseline.status === 'ready' ? 'ready' : 'loading'}
          onStart={startBaseline}
        />
      )}
    </div>
  );
}
