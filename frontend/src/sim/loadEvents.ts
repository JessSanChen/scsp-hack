/**
 * Fetch + parse a JSONL events stream. The server (Vite dev or the
 * production static host) is expected to serve a plain UTF-8 text body
 * with one JSON object per non-empty line.
 */

import type { SimEvent } from './eventTypes';

export async function loadEvents(url: string): Promise<SimEvent[]> {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`loadEvents: ${url} -> HTTP ${resp.status}`);
  }
  const text = await resp.text();
  return parseJsonl(text);
}

export function parseJsonl(text: string): SimEvent[] {
  const out: SimEvent[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw) as SimEvent);
    } catch (err) {
      console.warn(`[loadEvents] failed to parse line ${i + 1}:`, err);
    }
  }
  return out;
}
