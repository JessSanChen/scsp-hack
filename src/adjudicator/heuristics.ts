/**
 * Escalation heuristics: decide whether the adjudicator should hand the
 * decision off to the human expert before sampling an outcome.
 *
 * All thresholds are tunable per game and persisted in `config.json`,
 * so a future UI can expose them without code changes.
 */

import type { OutcomeCandidate } from "../engine/state.js";
import type { GameEvent, HeuristicsSnapshot } from "../engine/events.js";

export interface HeuristicsConfig extends HeuristicsSnapshot {}

export const DEFAULT_HEURISTICS: HeuristicsConfig = {
  /** Escalate if any candidate has consequentiality >= this. */
  consequentialityThreshold: 4,
  /** Escalate if no candidate has at least this much probability mass. */
  minTopProbability: 0.5,
  /** Escalate if any high-prob (>=0.3) candidate has confidence below this. */
  confidenceFloor: 0.45,
  /** Escalate at least once every N quiet turns. */
  maxTurnsBetweenAsks: 3,
  /** Escalate when any candidate flags a non-modelled external actor. */
  askOnExternalActorMention: true,
  /** Always escalate on these turns regardless of other heuristics. */
  alwaysAskOnTurns: [],
};

export interface EscalationDecision {
  escalate: boolean;
  reasons: string[];
}

export function shouldEscalate(input: {
  turn: number;
  candidates: OutcomeCandidate[];
  config: HeuristicsConfig;
  /** Turns previously escalated, in order. Used for `maxTurnsBetweenAsks`. */
  prevEscalationTurns: number[];
}): EscalationDecision {
  const { turn, candidates, config, prevEscalationTurns } = input;
  const reasons: string[] = [];

  if (config.alwaysAskOnTurns.includes(turn)) {
    reasons.push(`Turn ${turn} is in alwaysAskOnTurns`);
  }

  const maxConseq = candidates.reduce((m, c) => Math.max(m, c.consequentiality), 0);
  if (maxConseq >= config.consequentialityThreshold) {
    reasons.push(
      `Max consequentiality ${maxConseq} >= threshold ${config.consequentialityThreshold}`,
    );
  }

  const topProb = candidates.reduce((m, c) => Math.max(m, c.probability), 0);
  if (topProb < config.minTopProbability) {
    reasons.push(
      `Top probability ${topProb.toFixed(2)} < minTopProbability ${config.minTopProbability} (no clear winner)`,
    );
  }

  const lowConfHigh = candidates.find(
    (c) => c.probability >= 0.3 && c.confidence < config.confidenceFloor,
  );
  if (lowConfHigh) {
    reasons.push(
      `Candidate '${lowConfHigh.id}' has prob ${lowConfHigh.probability.toFixed(2)} but confidence ${lowConfHigh.confidence.toFixed(2)} < floor ${config.confidenceFloor}`,
    );
  }

  if (config.askOnExternalActorMention) {
    const ext = candidates.find((c) => c.flagsExternalActor);
    if (ext) {
      reasons.push(
        `Candidate '${ext.id}' depends on external actor '${ext.flagsExternalActor}'`,
      );
    }
  }

  const lastAsked = prevEscalationTurns.length > 0 ? prevEscalationTurns[prevEscalationTurns.length - 1]! : 0;
  const turnsSinceLastAsk = turn - lastAsked;
  if (turnsSinceLastAsk >= config.maxTurnsBetweenAsks) {
    reasons.push(
      `Turns since last human ask (${turnsSinceLastAsk}) >= maxTurnsBetweenAsks (${config.maxTurnsBetweenAsks})`,
    );
  }

  return {
    escalate: reasons.length > 0,
    reasons,
  };
}

export function previousEscalationTurns(events: GameEvent[]): number[] {
  return events
    .filter((e) => e.kind === "ESCALATION_RESOLVED")
    .map((e) => (e as { turn: number }).turn);
}
