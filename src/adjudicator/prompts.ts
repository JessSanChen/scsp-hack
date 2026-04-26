/**
 * Prompt builders for the adjudicator agent.
 *
 * The adjudicator does two LLM calls per turn at most:
 *   1. Candidate generation (called "candidate-gen").
 *   2. Optional regeneration after a human escalation answer
 *      ("post-escalation").
 *
 * Both share the same system prompt and JSON schema; only the user
 * message differs.
 */

import type { Action, FactionId } from "../scenario/types.js";
import type { Scenario } from "../scenario/types.js";
import type { WorldState } from "../engine/state.js";

export const ADJUDICATOR_SYSTEM_PROMPT = `You are an expert wargame adjudicator simulating a US-China-Taiwan crisis.
Your job is, given the current world state and the actions each faction took this turn:

1. Generate 2-4 plausible OUTCOME CANDIDATES, each with:
   - probability (0..1; the set should sum to roughly 1)
   - consequentiality (1=routine, 5=potentially war-defining)
   - confidence (0..1; how sure you are this branch is plausible at all)
   - rationale (why this branch could happen)
   - a typed stateDelta (numeric deltas to politicalWill/forceReadiness/casualties,
     posture text changes, region tension/incident updates, and knowledge
     additions scoped 'common' or 'secret' to a single faction)
   - per-faction visibility (full | partial | none) into the outcome itself
   - flagsExternalActor: name a non-modelled actor (e.g. Japan, Russia, EU, North Korea)
     ONLY if this branch's plausibility hinges on their reaction; otherwise null

2. Cover a meaningful spread: include at least one de-escalation branch
   and at least one materially worse branch when the situation warrants.

3. Be strict about the JSON schema. faction ids and region ids must
   exactly match the ones provided. statusFlagsAdd/Remove arrays must
   exist (use [] when nothing). All numeric "*Delta" fields must be
   numbers (positive or negative) or null - never strings.

4. The world model is the source of truth. Your stateDelta is the ONLY
   way state changes; do not narrate changes that do not appear in the
   delta. The narrativeAppend should be 1-2 sentences.

5. Knowledge additions: 'common' is broadcast to all factions; 'secret'
   requires a faction id and is held privately. Use secret for things
   like clandestine operations, intelligence gains, internal reads.`;

export interface CandidateGenInput {
  scenario: Scenario;
  state: WorldState;
  turn: number;
  actions: Record<FactionId, Action[]>;
  /** Free-form human guidance from a prior escalation, if any. */
  humanGuidance?: string;
}

export function buildCandidateGenUserPrompt(input: CandidateGenInput): string {
  const { scenario, state, turn, actions, humanGuidance } = input;
  const lines: string[] = [];

  lines.push(`# Scenario: ${scenario.name}`);
  lines.push(scenario.description);
  lines.push("");

  lines.push(`# Factions (use these ids exactly)`);
  for (const f of scenario.factions) {
    lines.push(`- ${f.id} (${f.name}): ${f.brief}`);
    lines.push(`  Objectives: ${f.objectives.join("; ")}`);
  }
  lines.push("");

  lines.push(`# Regions (use these ids exactly)`);
  for (const r of scenario.regions) {
    lines.push(`- ${r.id} (${r.name}): ${r.description}`);
  }
  lines.push("");

  lines.push(`# Current world state (after turn ${state.turn})`);
  lines.push("Faction state:");
  for (const [id, fs] of Object.entries(state.factions)) {
    lines.push(
      `  - ${id}: politicalWill=${fs.politicalWill} forceReadiness=${fs.forceReadiness} casualties=${fs.casualties} flags=[${fs.statusFlags.join(", ")}]`,
    );
    lines.push(`    posture: ${fs.posture}`);
  }
  lines.push("Region state:");
  for (const [id, rs] of Object.entries(state.regions)) {
    lines.push(
      `  - ${id}: tension=${rs.tensionLevel} control=${rs.controllingFaction ?? "contested"} present=[${rs.presentFactions.join(", ")}]`,
    );
    if (rs.recentIncidents.length > 0) {
      lines.push(`    recent incidents: ${rs.recentIncidents.slice(-3).join(" | ")}`);
    }
  }
  lines.push("");

  lines.push("# Common knowledge timeline (most recent last)");
  for (const k of state.commonKnowledge.slice(-12)) {
    lines.push(`  - [t${k.turn}] ${k.text}`);
  }
  lines.push("");

  lines.push("# Adjudicator narrative so far (full history; not visible to factions)");
  if (state.narrative.length === 0) lines.push("  (none yet)");
  for (const n of state.narrative.slice(-6)) lines.push(`  - ${n}`);
  lines.push("");

  lines.push(`# Actions submitted for turn ${turn}`);
  for (const factionId of Object.keys(actions)) {
    lines.push(`## ${factionId}`);
    for (const a of actions[factionId] ?? []) {
      lines.push(`- ${a.summary}`);
      if (a.details) lines.push(`  Details: ${a.details}`);
    }
  }
  lines.push("");

  if (humanGuidance) {
    lines.push("# Human expert guidance (must be incorporated)");
    lines.push(humanGuidance);
    lines.push("");
  }

  lines.push("# Your task");
  lines.push(
    `Generate 2-4 outcome candidates for turn ${turn}. Probabilities should sum to ~1. ` +
      "Use only the faction and region ids declared above. Keep the narrativeAppend short (1-2 sentences). " +
      "Set flagsExternalActor only if a non-modelled actor's reaction is decisive for that branch.",
  );

  return lines.join("\n");
}

/**
 * The escalation question shown to the human. Self-contained so a future
 * UI can render it without re-deriving anything.
 */
export function buildEscalationQuestion(input: {
  turn: number;
  state: WorldState;
  actions: Record<FactionId, Action[]>;
  reasons: string[];
  candidates: { summary: string; probability: number; consequentiality: number }[];
}): { question: string; stateSummary: string } {
  const { turn, state, actions, reasons, candidates } = input;
  const summary: string[] = [];
  summary.push(`Turn ${turn} state summary:`);
  for (const [id, fs] of Object.entries(state.factions)) {
    summary.push(
      `  ${id}: PW=${fs.politicalWill} FR=${fs.forceReadiness} cas=${fs.casualties} flags=[${fs.statusFlags.join(",")}]`,
    );
  }
  summary.push("Tension levels:");
  for (const [id, rs] of Object.entries(state.regions)) {
    summary.push(`  ${id}: tension=${rs.tensionLevel}`);
  }
  const stateSummary = summary.join("\n");

  const lines: string[] = [];
  lines.push(`The adjudicator is escalating turn ${turn} for human review.`);
  lines.push("");
  lines.push("Reasons:");
  for (const r of reasons) lines.push(`  - ${r}`);
  lines.push("");
  lines.push("Actions this turn:");
  for (const factionId of Object.keys(actions)) {
    lines.push(`  ${factionId}:`);
    for (const a of actions[factionId] ?? []) lines.push(`    - ${a.summary}`);
  }
  lines.push("");
  lines.push("Candidate outcomes the adjudicator generated:");
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]!;
    lines.push(
      `  ${i + 1}. [p=${c.probability.toFixed(2)} | conseq=${c.consequentiality}] ${c.summary}`,
    );
  }
  lines.push("");
  lines.push("Please respond with either:");
  lines.push("  - Free-form guidance (e.g. 'Consider how Japan reacts to a US FONOP'),");
  lines.push("    which will be added to the prompt for a regeneration.");
  lines.push("  - A specific candidate id to force-select.");
  return { question: lines.join("\n"), stateSummary };
}
