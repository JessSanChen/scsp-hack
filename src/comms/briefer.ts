/**
 * The briefer translates the adjudicator's resolved turn into a
 * per-faction message: only what that faction can see (per the
 * candidate's `visibility` map and the faction's secret knowledge
 * timeline).
 *
 * One LLM call per faction per turn, called "briefer:<factionId>".
 */

import { briefingJsonSchema, BriefingOutputSchema } from "../adjudicator/schema.js";
import type { LlmClient } from "../llm/types.js";
import type { Action, FactionId, Scenario } from "../scenario/types.js";
import {
  type OutcomeCandidate,
  type WorldState,
  viewForFaction,
} from "../engine/state.js";

export const BRIEFER_SYSTEM_PROMPT = `You are an intelligence briefer producing a short turn summary for ONE faction's leadership.
You are given the faction's view of the world (filtered to what they can see), the action the
faction took, and a high-level "visibility" tag (full | partial | none) indicating how clearly
they observed the resolved outcome. Produce JSON with a headline, body (3-6 sentences), and
3-5 bullet points. Never reveal information the faction cannot see; if visibility is 'none',
say so frankly and recommend posture.`;

export interface BrieferInput {
  scenario: Scenario;
  faction: FactionId;
  turn: number;
  state: WorldState;
  selected: OutcomeCandidate;
  factionActions: Action[];
}

export async function generateBriefing(client: LlmClient, input: BrieferInput) {
  const { scenario, faction, turn, state, selected, factionActions } = input;
  const visibility = selected.visibility[faction] ?? "partial";
  const view = viewForFaction(state, faction);

  const factionMeta = scenario.factions.find((f) => f.id === faction);
  const factionName = factionMeta?.name ?? faction;

  const lines: string[] = [];
  lines.push(`# Faction: ${faction} (${factionName})`);
  lines.push(`# Turn just resolved: ${turn}`);
  lines.push(`# Your visibility into the outcome: ${visibility}`);
  lines.push("");
  lines.push("# Your actions this turn");
  if (factionActions.length === 0) lines.push("  (none)");
  for (const a of factionActions) {
    lines.push(`  - ${a.summary}`);
    if (a.details) lines.push(`    ${a.details}`);
  }
  lines.push("");
  lines.push("# Common knowledge available to you (most recent last)");
  for (const k of view.state.commonKnowledge.slice(-10)) {
    lines.push(`  - [t${k.turn}] ${k.text}`);
  }
  const secret = view.state.secretKnowledge[faction] ?? [];
  if (secret.length > 0) {
    lines.push("");
    lines.push("# Your private intelligence (do not reference what you do not know)");
    for (const k of secret.slice(-10)) {
      lines.push(`  - [t${k.turn}] ${k.text}`);
    }
  }
  lines.push("");
  lines.push("# Resolved outcome (filter through your visibility)");
  if (visibility === "none") {
    lines.push("  You did not directly observe this turn's resolution.");
  } else if (visibility === "partial") {
    lines.push(`  Partial: ${selected.summary}`);
  } else {
    lines.push(`  Full: ${selected.summary}`);
  }
  lines.push("");
  lines.push(
    "Produce JSON: { headline, body, bullets[] }. 3-5 bullets. " +
      "Tailor to this faction's leadership.",
  );

  return client.complete(
    {
      call: `briefer:${faction}`,
      system: BRIEFER_SYSTEM_PROMPT,
      user: lines.join("\n"),
      jsonSchema: briefingJsonSchema as unknown as {
        name: string;
        strict: true;
        schema: Record<string, unknown>;
      },
      temperature: 0.3,
      mockContext: {
        turn,
        faction,
        selectedSummary: selected.summary,
        visibility,
      },
    },
    (raw) => BriefingOutputSchema.parse(raw),
  );
}
