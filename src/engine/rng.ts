/**
 * Seeded RNG for reproducible outcome selection.
 *
 * The seed lives in `config.json` for the game; every roll is also logged
 * inside `OUTCOME_SELECTED` events so a future replay can verify or
 * re-derive selections.
 */

import seedrandom from "seedrandom";
import type { OutcomeCandidate } from "./state.js";

export interface Rng {
  /** Returns a uniform [0, 1) value. */
  next(): number;
}

export function createRng(seed: number, salt = ""): Rng {
  const inner = seedrandom(`${seed}::${salt}`);
  return {
    next: () => inner(),
  };
}

/**
 * Normalise probabilities to sum to 1, replacing any negatives with 0.
 * If everything is 0, returns a uniform distribution.
 */
export function normaliseProbabilities(candidates: OutcomeCandidate[]): OutcomeCandidate[] {
  if (candidates.length === 0) return candidates;
  const positive = candidates.map((c) => Math.max(0, c.probability));
  const sum = positive.reduce((a, b) => a + b, 0);
  if (sum === 0) {
    const u = 1 / candidates.length;
    return candidates.map((c) => ({ ...c, probability: u }));
  }
  return candidates.map((c, i) => ({ ...c, probability: positive[i]! / sum }));
}

/**
 * Weighted sample from a candidate list using the supplied roll in [0,1).
 * Returns the index into the (already normalised) candidate list.
 */
export function weightedSampleIndex(
  candidates: OutcomeCandidate[],
  roll: number,
): number {
  if (candidates.length === 0) {
    throw new Error("No candidates to sample from");
  }
  let acc = 0;
  for (let i = 0; i < candidates.length; i++) {
    acc += candidates[i]!.probability;
    if (roll < acc) return i;
  }
  return candidates.length - 1;
}

export function rollAndSelect(
  rng: Rng,
  candidates: OutcomeCandidate[],
): { roll: number; selected: OutcomeCandidate; normalised: OutcomeCandidate[] } {
  const normalised = normaliseProbabilities(candidates);
  const roll = rng.next();
  const idx = weightedSampleIndex(normalised, roll);
  return { roll, selected: normalised[idx]!, normalised };
}
