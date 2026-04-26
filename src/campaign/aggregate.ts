/**
 * Campaign aggregation.
 *
 * Streams each game's events.jsonl, accumulating per-arm distributions
 * over final escalationLevel, outcomeKind frequencies, capability-citation
 * frequencies, and per-faction final state quantiles. Adds bootstrap 95%
 * CIs vs. a chosen baseline arm.
 */

import path from "node:path";
import { promises as fs } from "node:fs";
import seedrandom from "seedrandom";
import { reconstructTree, readEvents } from "../engine/tree.js";
import { loadCampaignManifest } from "./manifest.js";
import type { GameEvent } from "../engine/events.js";
import type { WorldState } from "../engine/state.js";

export interface AggregateOptions {
  campaignDir: string;
  /** Arm id to compare other arms against. Defaults to first arm in manifest. */
  baseline?: string;
  /** Bootstrap iteration count for CIs. Defaults to 2000. */
  bootstrap?: number;
  /** RNG seed for the bootstrap. Defaults to 42. */
  bootstrapSeed?: number;
}

export interface CampaignArmReport {
  armId: string;
  description?: string;
  perturbations: Array<{ faction: string; capability: string; quantityDelta?: number }>;
  gamesObserved: number;
  finalEscalationLevel: NumericSummary;
  finalEscalationDistribution: Histogram;
  meanEscalationByTurn: Record<number, number>;
  outcomeKindFrequency: Record<string, number>;
  capabilityCitationFrequency: Record<string, number>;
  factionFinalState: Record<
    string,
    {
      politicalWill: NumericSummary;
      forceReadiness: NumericSummary;
      casualties: NumericSummary;
    }
  >;
  forcePresenceFinal: Record<string, Record<string, NumericSummary>>;
  /** Pairwise vs-baseline deltas (set when arm != baseline). */
  vsBaseline?: {
    baselineArmId: string;
    finalEscalationDelta: { mean: number; ci95: [number, number] };
    politicalWillDeltaByFaction: Record<string, { mean: number; ci95: [number, number] }>;
    casualtiesDeltaByFaction: Record<string, { mean: number; ci95: [number, number] }>;
  };
}

export interface NumericSummary {
  n: number;
  mean: number;
  std: number;
  min: number;
  max: number;
  p25: number;
  p50: number;
  p75: number;
}

export interface Histogram {
  /** Inclusive integer bins. */
  bins: number[];
  counts: number[];
}

export interface CampaignReport {
  campaignDir: string;
  baselineArmId: string;
  arms: CampaignArmReport[];
  /** Total number of games considered. */
  gamesTotal: number;
}

export async function aggregateCampaign(opts: AggregateOptions): Promise<CampaignReport> {
  const campaignDir = path.resolve(opts.campaignDir);
  const manifest = await loadCampaignManifest(path.join(campaignDir, "manifest.json"));
  const armIds = manifest.arms.map((a) => a.id);
  const baselineArmId = opts.baseline ?? armIds[0]!;
  if (!armIds.includes(baselineArmId)) {
    throw new Error(`Baseline arm '${baselineArmId}' not in manifest`);
  }
  const bootstrap = opts.bootstrap ?? 2000;
  const bootstrapSeed = opts.bootstrapSeed ?? 42;

  // Per-arm collected metrics.
  type ArmAcc = {
    armId: string;
    description?: string;
    perturbations: Array<{ faction: string; capability: string; quantityDelta?: number }>;
    finalEscalations: number[];
    escalationByTurn: Map<number, number[]>;
    outcomeKindCounts: Map<string, number>;
    capabilityCitationCounts: Map<string, number>;
    factionMetrics: Map<string, {
      politicalWill: number[];
      forceReadiness: number[];
      casualties: number[];
    }>;
    forceTotals: Map<string, Map<string, number[]>>;
  };
  const accs = new Map<string, ArmAcc>();
  for (const arm of manifest.arms) {
    accs.set(arm.id, {
      armId: arm.id,
      ...(arm.description ? { description: arm.description } : {}),
      perturbations: arm.perturbations.map((p) => ({
        faction: p.faction,
        capability: p.capability,
        ...(p.quantityDelta !== undefined ? { quantityDelta: p.quantityDelta } : {}),
      })),
      finalEscalations: [],
      escalationByTurn: new Map(),
      outcomeKindCounts: new Map(),
      capabilityCitationCounts: new Map(),
      factionMetrics: new Map(),
      forceTotals: new Map(),
    });
  }

  const gamesRoot = path.join(campaignDir, "games");
  const armDirs = await safeReaddir(gamesRoot);
  let gamesTotal = 0;
  for (const armId of armDirs) {
    const acc = accs.get(armId);
    if (!acc) continue;
    const seedDirs = await safeReaddir(path.join(gamesRoot, armId));
    for (const seedDir of seedDirs) {
      const gameDir = path.join(gamesRoot, armId, seedDir);
      try {
        const events = await readEvents(gameDir);
        if (events.length === 0) continue;
        ingestGame(acc, events);
        gamesTotal += 1;
      } catch (err) {
        // Skip broken games but don't fail the whole report.
        continue;
      }
    }
  }

  const reports: CampaignArmReport[] = [];
  const baselineAcc = accs.get(baselineArmId)!;
  for (const arm of manifest.arms) {
    const acc = accs.get(arm.id)!;
    const r: CampaignArmReport = {
      armId: arm.id,
      ...(arm.description ? { description: arm.description } : {}),
      perturbations: acc.perturbations,
      gamesObserved: acc.finalEscalations.length,
      finalEscalationLevel: numericSummary(acc.finalEscalations),
      finalEscalationDistribution: buildHistogram(acc.finalEscalations, 0, 10),
      meanEscalationByTurn: meanByTurn(acc.escalationByTurn),
      outcomeKindFrequency: mapToFreq(acc.outcomeKindCounts, gamesObserved(acc)),
      capabilityCitationFrequency: mapToFreq(
        acc.capabilityCitationCounts,
        gamesObserved(acc),
      ),
      factionFinalState: factionSummaries(acc),
      forcePresenceFinal: forceSummaries(acc),
    };
    if (arm.id !== baselineArmId) {
      r.vsBaseline = pairwiseVsBaseline(acc, baselineAcc, baselineArmId, bootstrap, bootstrapSeed);
    }
    reports.push(r);
  }

  return {
    campaignDir,
    baselineArmId,
    arms: reports,
    gamesTotal,
  };
}

/* ---------- ingestion ------------------------------------------------ */

function ingestGame(acc: {
  finalEscalations: number[];
  escalationByTurn: Map<number, number[]>;
  outcomeKindCounts: Map<string, number>;
  capabilityCitationCounts: Map<string, number>;
  factionMetrics: Map<string, {
    politicalWill: number[];
    forceReadiness: number[];
    casualties: number[];
  }>;
  forceTotals: Map<string, Map<string, number[]>>;
}, events: GameEvent[]): void {
  const tree = reconstructTree(events);
  const finalState = tree.currentState;
  acc.finalEscalations.push(finalState.escalationLevel);
  for (const turn of tree.turns) {
    // Find the STATE_SNAPSHOT for this turn to record escalation level.
    const snap = events.find(
      (e) => e.kind === "STATE_SNAPSHOT" && e.turn === turn.turn,
    );
    if (snap && snap.kind === "STATE_SNAPSHOT") {
      bucketAppend(acc.escalationByTurn, turn.turn, snap.state.escalationLevel);
    }
  }

  for (const turn of tree.turns) {
    const sel = turn.candidates.find((c) => c.id === turn.selectedCandidateId);
    if (!sel) continue;
    for (const k of sel.outcomeKinds ?? []) {
      acc.outcomeKindCounts.set(k, (acc.outcomeKindCounts.get(k) ?? 0) + 1);
    }
    for (const c of sel.capabilityCitations ?? []) {
      acc.capabilityCitationCounts.set(
        c,
        (acc.capabilityCitationCounts.get(c) ?? 0) + 1,
      );
    }
  }

  for (const [fid, fs] of Object.entries(finalState.factions)) {
    let m = acc.factionMetrics.get(fid);
    if (!m) {
      m = { politicalWill: [], forceReadiness: [], casualties: [] };
      acc.factionMetrics.set(fid, m);
    }
    m.politicalWill.push(fs.politicalWill);
    m.forceReadiness.push(fs.forceReadiness);
    m.casualties.push(fs.casualties);

    let factionForce = acc.forceTotals.get(fid);
    if (!factionForce) {
      factionForce = new Map();
      acc.forceTotals.set(fid, factionForce);
    }
    for (const [capId, fl] of Object.entries(fs.forces)) {
      let arr = factionForce.get(capId);
      if (!arr) {
        arr = [];
        factionForce.set(capId, arr);
      }
      arr.push(fl.quantity);
    }
  }
}

function bucketAppend<K>(m: Map<K, number[]>, k: K, v: number): void {
  let arr = m.get(k);
  if (!arr) {
    arr = [];
    m.set(k, arr);
  }
  arr.push(v);
}

function gamesObserved(acc: { finalEscalations: number[] }): number {
  return acc.finalEscalations.length;
}

/* ---------- summaries ----------------------------------------------- */

function numericSummary(xs: number[]): NumericSummary {
  if (xs.length === 0) {
    return { n: 0, mean: 0, std: 0, min: 0, max: 0, p25: 0, p50: 0, p75: 0 };
  }
  const sorted = [...xs].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  const variance = sorted.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  return {
    n,
    mean,
    std,
    min: sorted[0]!,
    max: sorted[n - 1]!,
    p25: quantile(sorted, 0.25),
    p50: quantile(sorted, 0.5),
    p75: quantile(sorted, 0.75),
  };
}

function quantile(sortedAsc: number[], q: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0]!;
  const pos = (sortedAsc.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedAsc[lo]!;
  return sortedAsc[lo]! + (sortedAsc[hi]! - sortedAsc[lo]!) * (pos - lo);
}

function buildHistogram(xs: number[], lo: number, hi: number): Histogram {
  const bins: number[] = [];
  for (let i = lo; i <= hi; i++) bins.push(i);
  const counts = bins.map(() => 0);
  for (const x of xs) {
    const idx = Math.max(0, Math.min(counts.length - 1, Math.round(x) - lo));
    counts[idx] = (counts[idx] ?? 0) + 1;
  }
  return { bins, counts };
}

function meanByTurn(m: Map<number, number[]>): Record<number, number> {
  const out: Record<number, number> = {};
  for (const [turn, xs] of m.entries()) {
    out[turn] = xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
  }
  return out;
}

function mapToFreq(m: Map<string, number>, denom: number): Record<string, number> {
  const out: Record<string, number> = {};
  if (denom <= 0) return out;
  for (const [k, v] of m.entries()) out[k] = v / denom;
  return out;
}

function factionSummaries(acc: {
  factionMetrics: Map<string, {
    politicalWill: number[];
    forceReadiness: number[];
    casualties: number[];
  }>;
}): CampaignArmReport["factionFinalState"] {
  const out: CampaignArmReport["factionFinalState"] = {};
  for (const [fid, m] of acc.factionMetrics.entries()) {
    out[fid] = {
      politicalWill: numericSummary(m.politicalWill),
      forceReadiness: numericSummary(m.forceReadiness),
      casualties: numericSummary(m.casualties),
    };
  }
  return out;
}

function forceSummaries(acc: {
  forceTotals: Map<string, Map<string, number[]>>;
}): CampaignArmReport["forcePresenceFinal"] {
  const out: CampaignArmReport["forcePresenceFinal"] = {};
  for (const [fid, byCap] of acc.forceTotals.entries()) {
    out[fid] = {};
    for (const [capId, xs] of byCap.entries()) {
      out[fid]![capId] = numericSummary(xs);
    }
  }
  return out;
}

/* ---------- pairwise vs baseline ------------------------------------ */

function pairwiseVsBaseline(
  arm: {
    finalEscalations: number[];
    factionMetrics: Map<string, { politicalWill: number[]; casualties: number[] }>;
  },
  baseline: {
    finalEscalations: number[];
    factionMetrics: Map<string, { politicalWill: number[]; casualties: number[] }>;
  },
  baselineId: string,
  bootstrap: number,
  bootstrapSeed: number,
): NonNullable<CampaignArmReport["vsBaseline"]> {
  const rng = seedrandom(`bootstrap::${bootstrapSeed}`);
  const finalEscalationDelta = bootstrapMeanDelta(
    arm.finalEscalations,
    baseline.finalEscalations,
    bootstrap,
    rng,
  );
  const politicalWillDeltaByFaction: Record<string, { mean: number; ci95: [number, number] }> = {};
  const casualtiesDeltaByFaction: Record<string, { mean: number; ci95: [number, number] }> = {};
  const factions = new Set([
    ...arm.factionMetrics.keys(),
    ...baseline.factionMetrics.keys(),
  ]);
  for (const fid of factions) {
    const a = arm.factionMetrics.get(fid);
    const b = baseline.factionMetrics.get(fid);
    if (!a || !b) continue;
    politicalWillDeltaByFaction[fid] = bootstrapMeanDelta(a.politicalWill, b.politicalWill, bootstrap, rng);
    casualtiesDeltaByFaction[fid] = bootstrapMeanDelta(a.casualties, b.casualties, bootstrap, rng);
  }
  return {
    baselineArmId: baselineId,
    finalEscalationDelta,
    politicalWillDeltaByFaction,
    casualtiesDeltaByFaction,
  };
}

function bootstrapMeanDelta(
  arm: number[],
  baseline: number[],
  iters: number,
  rng: seedrandom.PRNG,
): { mean: number; ci95: [number, number] } {
  if (arm.length === 0 || baseline.length === 0) {
    return { mean: 0, ci95: [0, 0] };
  }
  const observed = mean(arm) - mean(baseline);
  const deltas: number[] = [];
  for (let i = 0; i < iters; i++) {
    const a = bootstrapSample(arm, rng);
    const b = bootstrapSample(baseline, rng);
    deltas.push(mean(a) - mean(b));
  }
  deltas.sort((x, y) => x - y);
  const lo = deltas[Math.floor(iters * 0.025)] ?? deltas[0]!;
  const hi = deltas[Math.floor(iters * 0.975)] ?? deltas[deltas.length - 1]!;
  return { mean: observed, ci95: [lo, hi] };
}

function bootstrapSample(arr: number[], rng: seedrandom.PRNG): number[] {
  const out: number[] = new Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    out[i] = arr[Math.floor(rng() * arr.length)]!;
  }
  return out;
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/* ---------- helpers ------------------------------------------------- */

async function safeReaddir(p: string): Promise<string[]> {
  try {
    return await fs.readdir(p);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

export type { WorldState };
