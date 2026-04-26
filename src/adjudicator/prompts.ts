/**
 * Prompt builders for the adjudicator agent.
 *
 * The adjudicator does a single LLM call per turn ("candidate-gen") to
 * produce 2-4 typed outcome candidates with probabilities, state deltas,
 * outcome-kind tags and capability citations. The capability citations
 * and outcome kinds are what the Monte Carlo aggregator mines.
 */

import type { Action, FactionId } from "../scenario/types.js";
import type { Scenario } from "../scenario/types.js";
import type { WorldState } from "../engine/state.js";

export const ADJUDICATOR_SYSTEM_PROMPT = `You are an expert wargame adjudicator simulating a US-China-Taiwan crisis.
Given the current world state, each faction's order of battle, and the actions each faction took this turn, your job is to:

1. Generate 2-4 plausible OUTCOME CANDIDATES, each with:
   - probability (0..1; the set should sum to roughly 1)
   - consequentiality (1=routine, 5=potentially war-defining)
   - confidence (0..1; how sure you are this branch is plausible at all)
   - rationale (why this branch could happen)
   - a typed stateDelta with:
       narrativeAppend (1-2 sentences),
       escalationLevelDelta (typically -3..+3 to global escalationLevel 0..10),
       factionPatches (deltas to politicalWill / forceReadiness / casualties / posture / flags),
       regionPatches (tension, control, presence, incidents),
       forcePatches (attrition, repositioning, readiness changes for specific capability slots),
       knowledgeAdditions (scoped 'common' or 'secret' to a single faction)
   - per-faction visibility (full | partial | none) into the outcome itself
   - outcomeKinds: 1-3 tags drawn from the scenario's outcome-kind vocabulary
   - capabilityCitations: capability ids that materially shaped this outcome
     (used to mine "which capabilities most often appear in branches that
     lead to X?" across Monte Carlo campaigns - cite anything that mattered)
   - flagsExternalActor: name a non-modelled actor (Japan, Russia, EU, North Korea, etc.)
     ONLY if this branch's plausibility hinges on their reaction; otherwise null

2. Cover a meaningful spread: include at least one de-escalation branch and at
   least one materially worse branch when the situation warrants. Do not be
   reflexively aggressive: account for both sides' incentives to avoid open war.

3. Be strict about the JSON schema. faction ids, region ids, capability ids
   and outcome-kind tags must match exactly the ones provided. All array
   fields must be present (use [] when nothing). All numeric "*Delta" fields
   must be numbers or null - never strings.

4. The world model is the source of truth. Your stateDelta is the ONLY way
   state changes; do not narrate effects that do not appear in the delta.
   Forces deplete or reposture only via forcePatches.

5. Knowledge additions: 'common' is broadcast to all factions; 'secret' requires
   a faction id. Use secret for clandestine ops, intelligence gains, internal
   reads. Communication degradation can be modelled by writing distorted
   knowledge to the affected factions and accurate knowledge as 'secret' to
   the originator.`;

export interface CandidateGenInput {
  scenario: Scenario;
  state: WorldState;
  turn: number;
  actions: Record<FactionId, Action[]>;
  /**
   * Per-faction free-text rationale recorded by the player agents this
   * turn. Helpful intent signal for the adjudicator.
   */
  playerRationales?: Record<FactionId, string>;
}

export function buildCandidateGenUserPrompt(input: CandidateGenInput): string {
  const { scenario, state, turn, actions, playerRationales } = input;
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

  lines.push(`# Capabilities (use these ids exactly in capabilityCitations and forcePatches)`);
  for (const c of scenario.capabilities) {
    lines.push(`- ${c.id} [${c.faction}, ${c.unit}]: ${c.name} - ${c.description}`);
  }
  lines.push("");

  lines.push(`# Outcome-kind vocabulary (use 1-3 of these in outcomeKinds)`);
  lines.push(`  ${scenario.outcomeKinds.join(", ")}`);
  lines.push("");

  lines.push(`# Current world state (after turn ${state.turn})`);
  lines.push(`Global escalationLevel: ${state.escalationLevel} / 10`);
  lines.push("Faction state:");
  for (const [id, fs] of Object.entries(state.factions)) {
    lines.push(
      `  - ${id}: politicalWill=${fs.politicalWill} forceReadiness=${fs.forceReadiness} casualties=${fs.casualties} flags=[${fs.statusFlags.join(", ")}]`,
    );
    lines.push(`    posture: ${fs.posture}`);
    const force = Object.entries(fs.forces);
    if (force.length > 0) {
      lines.push(`    forces:`);
      for (const [capId, fl] of force) {
        lines.push(
          `      - ${capId}: qty=${fl.quantity} posture=${fl.posture} readiness=${fl.readiness}`,
        );
      }
    }
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
    if (playerRationales?.[factionId]) {
      lines.push(`Rationale: ${playerRationales[factionId]}`);
    }
    for (const a of actions[factionId] ?? []) {
      const caps = a.capabilitiesUsed.length > 0 ? ` [uses: ${a.capabilitiesUsed.join(", ")}]` : "";
      lines.push(`- (${a.kind}) ${a.summary}${caps}`);
      if (a.details) lines.push(`  Details: ${a.details}`);
    }
  }
  lines.push("");

  lines.push("# Your task");
  lines.push(
    `Generate 2-4 outcome candidates for turn ${turn}. Probabilities should sum to ~1. ` +
      "Use only the faction, region, capability, and outcome-kind ids declared above. " +
      "Keep narrativeAppend to 1-2 sentences. Cite every capability that materially " +
      "shapes the branch in capabilityCitations, even if you do not damage it via forcePatches.",
  );

  return lines.join("\n");
}
