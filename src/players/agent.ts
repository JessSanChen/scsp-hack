/**
 * Per-faction player agent. One LLM call per faction per turn that
 * returns a structured Action[] plus a rationale. The engine fans out
 * `decideFactionActions` in parallel across factions each turn.
 */

import type {
  Action,
  CapabilityId,
  Faction,
  ForceLevel,
  Scenario,
} from "../scenario/types.js";
import type { WorldState } from "../engine/state.js";
import type { LlmClient, LlmResponse } from "../llm/types.js";
import {
  PlayerDecisionOutputSchema,
  playerDecisionJsonSchema,
  type PlayerDecisionOutput,
} from "./schema.js";
import {
  PLAYER_AGENT_SYSTEM_PROMPT,
  buildPlayerUserPrompt,
} from "./prompts.js";

export interface PlayerAgentResult {
  faction: string;
  rationale: string;
  actions: Action[];
  trace: {
    request: { system: string; user: string; mockContext: Record<string, unknown> };
    response: unknown;
    mock: boolean;
  };
}

export interface PlayerAgentInput {
  scenario: Scenario;
  faction: Faction;
  state: WorldState;
  turn: number;
  recentBriefings: Array<{ turn: number; headline: string; bullets: string[] }>;
}

export async function decideFactionActions(
  client: LlmClient,
  input: PlayerAgentInput,
): Promise<PlayerAgentResult> {
  const { scenario, faction, state, turn } = input;
  const user = buildPlayerUserPrompt(input);
  const ownCapabilityIds = scenario.capabilities
    .filter((c) => c.faction === faction.id)
    .map((c) => c.id);
  const ownForcesFingerprint = forcesFingerprint(state.factions[faction.id]?.forces ?? {});
  const mockContext = {
    factionId: faction.id,
    factionShortName: faction.shortName,
    turn,
    actionKinds: scenario.actionKinds,
    ownCapabilityIds,
    ownForcesFingerprint,
    escalationLevel: state.escalationLevel,
    objectives: faction.objectives,
  };
  const llmResp: LlmResponse<PlayerDecisionOutput> = await client.complete(
    {
      call: `player:${faction.id}`,
      system: PLAYER_AGENT_SYSTEM_PROMPT,
      user,
      jsonSchema: playerDecisionJsonSchema as unknown as {
        name: string;
        strict: true;
        schema: Record<string, unknown>;
      },
      temperature: 0.6,
      mockContext,
    },
    (raw) => PlayerDecisionOutputSchema.parse(raw),
  );

  const actions: Action[] = llmResp.parsed.actions.map((a) => ({
    id: a.id,
    faction: faction.id,
    summary: a.summary,
    ...(a.details ? { details: a.details } : {}),
    kind: a.kind,
    capabilitiesUsed: a.capabilitiesUsed,
  }));

  return {
    faction: faction.id,
    rationale: llmResp.parsed.rationale,
    actions,
    trace: {
      request: { system: PLAYER_AGENT_SYSTEM_PROMPT, user, mockContext },
      response: llmResp.raw,
      mock: llmResp.mock,
    },
  };
}

function forcesFingerprint(forces: Record<CapabilityId, ForceLevel>): string {
  const parts = Object.keys(forces)
    .sort()
    .map((k) => {
      const f = forces[k];
      return `${k}:q${f.quantity}:r${f.readiness.toFixed(2)}:p${f.posture}`;
    });
  return parts.join("|");
}
