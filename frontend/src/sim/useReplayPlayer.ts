/**
 * Drives a JSONL events stream through the reducer at human-readable
 * speed. Returns a derived UiGameState plus playback controls.
 *
 * The player consumes events one at a time; each event-kind has a
 * configured pause after it lands so the UI can breathe (e.g. an
 * OUTCOME_SELECTED lingers ~1s while operators read the candidate
 * cards). LLM_TRACE / BRIEFING_DELIVERED events are no-ops on UI state
 * and are consumed instantly to keep the perceived cadence on the
 * decision-relevant events.
 *
 * The hook owns its own timer; it does not rely on requestAnimationFrame
 * since per-event pauses range from ~50ms to ~1s and timing precision is
 * not critical.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadEvents } from './loadEvents';
import { applyEvent, initialUiState, type ReducerMeta } from './reducer';
import type { SimEvent } from './eventTypes';
import type { UiGameState } from './uiState';

export type ReplayStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'complete'
  | 'error';

export interface UseReplayPlayerOptions {
  url: string | null;
  meta?: ReducerMeta;
  /** 1.0 = real-time configured delays. 2.0 plays twice as fast. */
  speed?: number;
  /** Fired once GAME_COMPLETE is consumed. */
  onComplete?: (final: UiGameState) => void;
}

export interface ReplayPlayer {
  state: UiGameState;
  status: ReplayStatus;
  error?: string;
  /** Index of the next event to consume; equals events.length when done. */
  cursor: number;
  totalEvents: number;
  start: () => void;
  pause: () => void;
  reset: () => void;
  /** Skip to end without animating. */
  skipToEnd: () => void;
}

const DEFAULT_DELAY_MS = 200;
const DELAY_BY_KIND: Record<string, number> = {
  GAME_STARTED: 600,
  FORK_FROM: 800,
  TURN_START: 600,
  PLAYER_DECISION: 450,
  ACTIONS_SUBMITTED: 50,
  CANDIDATES_GENERATED: 800,
  OUTCOME_SELECTED: 1100,
  STATE_SNAPSHOT: 350,
  BRIEFING_DELIVERED: 0,
  LLM_TRACE: 0,
  GAME_COMPLETE: 0,
};

export function useReplayPlayer(
  opts: UseReplayPlayerOptions,
): ReplayPlayer {
  const { url, meta, speed = 1, onComplete } = opts;

  const [events, setEvents] = useState<SimEvent[]>([]);
  const [state, setState] = useState<UiGameState>(() => initialUiState(meta));
  const [status, setStatus] = useState<ReplayStatus>('idle');
  const [cursor, setCursor] = useState(0);
  const [error, setError] = useState<string | undefined>(undefined);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playingRef = useRef(false);
  const cursorRef = useRef(0);
  const eventsRef = useRef<SimEvent[]>([]);
  const stateRef = useRef<UiGameState>(state);
  const onCompleteRef = useRef(onComplete);
  const speedRef = useRef(speed);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Load events whenever url changes
  useEffect(() => {
    if (!url) {
      setEvents([]);
      setStatus('idle');
      setError(undefined);
      setCursor(0);
      setState(initialUiState(meta));
      return;
    }
    let cancelled = false;
    setStatus('loading');
    setError(undefined);
    loadEvents(url)
      .then((evs) => {
        if (cancelled) return;
        setEvents(evs);
        setCursor(0);
        setState(initialUiState(meta));
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
    // We intentionally exclude `meta` from deps; reducer meta is meant to
    // be stable across the player's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const advance = useCallback(() => {
    if (!playingRef.current) return;
    const evs = eventsRef.current;
    const i = cursorRef.current;
    if (i >= evs.length) {
      playingRef.current = false;
      setStatus('complete');
      const onC = onCompleteRef.current;
      if (onC) onC(stateRef.current);
      return;
    }
    const ev = evs[i];
    const next = applyEvent(stateRef.current, ev);
    stateRef.current = next;
    setState(next);
    cursorRef.current = i + 1;
    setCursor(i + 1);

    if (ev.kind === 'GAME_COMPLETE') {
      playingRef.current = false;
      setStatus('complete');
      const onC = onCompleteRef.current;
      if (onC) onC(next);
      return;
    }

    const delay = DELAY_BY_KIND[ev.kind] ?? DEFAULT_DELAY_MS;
    const adjusted = Math.max(0, delay / Math.max(0.1, speedRef.current));
    timerRef.current = setTimeout(advance, adjusted);
  }, []);

  const start = useCallback(() => {
    if (status === 'loading' || status === 'error') return;
    if (cursorRef.current >= eventsRef.current.length) {
      // already complete; restart from the top
      cursorRef.current = 0;
      setCursor(0);
      stateRef.current = initialUiState(meta);
      setState(stateRef.current);
    }
    playingRef.current = true;
    setStatus('playing');
    clearTimer();
    timerRef.current = setTimeout(advance, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advance, status]);

  const pause = useCallback(() => {
    playingRef.current = false;
    clearTimer();
    setStatus((prev) =>
      prev === 'playing' ? 'paused' : prev,
    );
  }, []);

  const reset = useCallback(() => {
    playingRef.current = false;
    clearTimer();
    cursorRef.current = 0;
    setCursor(0);
    const fresh = initialUiState(meta);
    stateRef.current = fresh;
    setState(fresh);
    setStatus(eventsRef.current.length > 0 ? 'ready' : 'idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skipToEnd = useCallback(() => {
    playingRef.current = false;
    clearTimer();
    let s = stateRef.current;
    for (let i = cursorRef.current; i < eventsRef.current.length; i++) {
      s = applyEvent(s, eventsRef.current[i]);
    }
    stateRef.current = s;
    setState(s);
    cursorRef.current = eventsRef.current.length;
    setCursor(eventsRef.current.length);
    setStatus('complete');
    const onC = onCompleteRef.current;
    if (onC) onC(s);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer();
      playingRef.current = false;
    };
  }, []);

  return useMemo(
    () => ({
      state,
      status,
      error,
      cursor,
      totalEvents: events.length,
      start,
      pause,
      reset,
      skipToEnd,
    }),
    [state, status, error, cursor, events.length, start, pause, reset, skipToEnd],
  );
}
