/**
 * Prompt builder for a single faction's player agent.
 *
 * The agent is given a strictly visibility-scoped view of the world
 * (scenario static data + the faction's own forces, the regions, the
 * common knowledge timeline, and only this faction's secret knowledge),
 * its objectives, recent briefings, and the action vocabulary. It must
 * emit a structured Action[] plus a one-paragraph rationale.
 */

import type { Faction, Scenario } from "../scenario/types.js";
import type { WorldState } from "../engine/state.js";
import { viewForFaction } from "../engine/state.js";

export const PLAYER_AGENT_SYSTEM_PROMPT = `You play a single faction in a US-China-Taiwan crisis wargame.
You decide what actions your faction takes this turn. You must:

1. Stay in character. Pursue your faction's objectives. Do not break frame
   or speak as the adjudicator.

2. Choose 1-4 concrete actions for this turn. Each action must:
   - declare an action 'kind' from the supplied vocabulary,
   - cite the capability ids it employs (only capabilities your faction owns),
   - have a short summary and (when useful) a one-sentence details field.

3. Be realistic about escalation risk. Aggressive military action is on
   the table when your interests demand it, but de-escalation, diplomacy,
   information operations, and clandestine moves are equally valid. Players
   who reflexively pick the most aggressive action will be modelled as
   irrational by the adjudicator.

4. You only see what your faction can see (a visibility-scoped view of the
   world, your own order of battle, your own private knowledge). Reason
   under that uncertainty - do not assume facts you have not been told.

5. Provide a 1-3 sentence 'rationale' explaining why you chose this set of
   actions over alternatives. The adjudicator will see this rationale.

Return strict JSON matching the supplied schema.`;

export interface PlayerPromptInput {
  scenario: Scenario;
  faction: Faction;
  state: WorldState;
  turn: number;
  /** Most recent briefings delivered to this faction (oldest first). */
  recentBriefings: Array<{ turn: number; headline: string; bullets: string[] }>;
}

export function buildPlayerUserPrompt(input: PlayerPromptInput): string {
  const { scenario, faction, state, turn, recentBriefings } = input;
  const view = viewForFaction(state, faction.id).state;
  const lines: string[] = [];

  lines.push(`# You are: ${faction.name} (id: ${faction.id})`);
  lines.push(`# Brief: ${faction.brief}`);
  lines.push(`# Initial posture: ${faction.initialPosture}`);
  lines.push(`# Objectives:`);
  for (const o of faction.objectives) lines.push(`- ${o}`);
  lines.push("");

  lines.push(`# Scenario context: ${scenario.name}`);
  lines.push(scenario.description);
  lines.push("");

  lines.push(`# Action kinds (use exactly one per action)`);
  lines.push(`  ${scenario.actionKinds.join(", ")}`);
  lines.push("");

  const ownCaps = scenario.capabilities.filter((c) => c.faction === faction.id);
  lines.push(`# Your capabilities (only cite these in capabilitiesUsed)`);
  for (const c of ownCaps) {
    lines.push(`- ${c.id} (${c.name}, in ${c.unit}): ${c.description}`);
  }
  lines.push("");

  lines.push(`# Your current order of battle`);
  const myState = view.factions[faction.id];
  if (myState) {
    lines.push(
      `politicalWill=${myState.politicalWill} forceReadiness=${myState.forceReadiness} casualties=${myState.casualties} flags=[${myState.statusFlags.join(", ")}]`,
    );
    lines.push(`posture: ${myState.posture}`);
    for (const [capId, fl] of Object.entries(myState.forces)) {
      lines.push(
        `- ${capId}: qty=${fl.quantity} posture=${fl.posture} readiness=${fl.readiness}`,
      );
    }
  }
  lines.push("");

  lines.push(`# Other factions (limited public posture; your direct knowledge only)`);
  for (const [id, fs] of Object.entries(view.factions)) {
    if (id === faction.id) continue;
    lines.push(`- ${id}: posture="${fs.posture}" flags=[${fs.statusFlags.join(", ")}]`);
  }
  lines.push("");

  lines.push(`# Regions`);
  for (const [id, rs] of Object.entries(view.regions)) {
    lines.push(
      `- ${id}: tension=${rs.tensionLevel} control=${rs.controllingFaction ?? "contested"} present=[${rs.presentFactions.join(", ")}]`,
    );
    if (rs.recentIncidents.length > 0) {
      lines.push(`  recent: ${rs.recentIncidents.slice(-3).join(" | ")}`);
    }
  }
  lines.push("");

  lines.push(`# Common knowledge (most recent last)`);
  for (const k of view.commonKnowledge.slice(-12)) {
    lines.push(`  - [t${k.turn}] ${k.text}`);
  }
  const mySecrets = view.secretKnowledge[faction.id] ?? [];
  if (mySecrets.length > 0) {
    lines.push("");
    lines.push(`# Your private knowledge (only ${faction.id} sees this)`);
    for (const k of mySecrets.slice(-8)) {
      lines.push(`  - [t${k.turn}] ${k.text}`);
    }
  }
  lines.push("");

  lines.push(`# Global escalationLevel: ${view.escalationLevel} / 10`);
  lines.push("");

  if (recentBriefings.length > 0) {
    lines.push(`# Briefings you received last turn`);
    for (const b of recentBriefings.slice(-2)) {
      lines.push(`- [t${b.turn}] ${b.headline}`);
      for (const bl of b.bullets) lines.push(`    * ${bl}`);
    }
    lines.push("");
  }

  lines.push(`# Decide your actions for turn ${turn}.`);
  lines.push(
    `Pick 1-4 concrete actions. Each action's 'kind' must be one of the action kinds above; ` +
      `each capabilitiesUsed entry must be one of your capability ids above. Do not invent ids.`,
  );

  return lines.join("\n");
}
