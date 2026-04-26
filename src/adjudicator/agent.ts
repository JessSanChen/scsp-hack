/**
 * The adjudicator agent. Wraps the LLM layer, prompt builders, and zod
 * schema validation behind a single async method used by the engine.
 *
 * The agent never mutates world state directly; it returns a parsed
 * `CandidateGenerationOutput` which the engine applies via
 * `applyDelta`. The autonomous-agent build runs exactly one
 * candidate-generation call per turn (no human-in-the-loop pass).
 */

import {
  CandidateGenerationOutputSchema,
  candidateGenerationJsonSchema,
  type CandidateGenerationOutput,
} from "./schema.js";
import {
  ADJUDICATOR_SYSTEM_PROMPT,
  buildCandidateGenUserPrompt,
  type CandidateGenInput,
} from "./prompts.js";
import type { LlmClient, LlmResponse } from "../llm/types.js";
import type { OutcomeCandidate } from "../engine/state.js";

export interface AdjudicatorRunResult {
  output: CandidateGenerationOutput;
  trace: {
    request: { system: string; user: string; mockContext: Record<string, unknown> };
    response: unknown;
    mock: boolean;
  };
  candidates: OutcomeCandidate[];
}

export async function generateCandidates(
  client: LlmClient,
  input: CandidateGenInput,
): Promise<AdjudicatorRunResult> {
  const user = buildCandidateGenUserPrompt(input);
  const factionIds = input.scenario.factions.map((f) => f.id);
  const regionIds = input.scenario.regions.map((r) => r.id);
  const capabilityIds = input.scenario.capabilities.map((c) => c.id);
  const outcomeKindIds = input.scenario.outcomeKinds;
  const actionSummaries: Record<string, string[]> = {};
  const actionCapabilities: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(input.actions)) {
    actionSummaries[k] = v.map((a) => a.summary);
    actionCapabilities[k] = Array.from(
      new Set(v.flatMap((a) => a.capabilitiesUsed)),
    );
  }
  const factionForcesFingerprint: Record<string, string> = {};
  for (const fid of factionIds) {
    const factionState = input.state.factions[fid];
    if (!factionState) continue;
    const parts = Object.keys(factionState.forces)
      .sort()
      .map((k) => {
        const f = factionState.forces[k];
        return `${k}:q${f.quantity}:r${f.readiness.toFixed(2)}:p${f.posture}`;
      });
    factionForcesFingerprint[fid] = parts.join("|");
  }
  const mockContext = {
    turn: input.turn,
    factionIds,
    regionIds,
    capabilityIds,
    outcomeKindIds,
    actionSummaries,
    actionCapabilities,
    escalationLevel: input.state.escalationLevel,
    factionForcesFingerprint,
  };
  const llmResp: LlmResponse<CandidateGenerationOutput> = await client.complete(
    {
      call: "candidate-gen",
      system: ADJUDICATOR_SYSTEM_PROMPT,
      user,
      jsonSchema: candidateGenerationJsonSchema as unknown as {
        name: string;
        strict: true;
        schema: Record<string, unknown>;
      },
      temperature: 0.4,
      mockContext,
    },
    (raw) => CandidateGenerationOutputSchema.parse(raw),
  );

  const candidates: OutcomeCandidate[] = llmResp.parsed.candidates.map((c) => ({
    id: c.id,
    summary: c.summary,
    rationale: c.rationale,
    probability: c.probability,
    consequentiality: c.consequentiality as 1 | 2 | 3 | 4 | 5,
    confidence: c.confidence,
    stateDelta: {
      narrativeAppend: c.stateDelta.narrativeAppend,
      ...(c.stateDelta.escalationLevelDelta !== null
        ? { escalationLevelDelta: c.stateDelta.escalationLevelDelta }
        : {}),
      factionPatches: c.stateDelta.factionPatches.map((p) => ({
        factionId: p.factionId,
        ...(p.politicalWillDelta !== null ? { politicalWillDelta: p.politicalWillDelta } : {}),
        ...(p.forceReadinessDelta !== null
          ? { forceReadinessDelta: p.forceReadinessDelta }
          : {}),
        ...(p.casualtiesDelta !== null ? { casualtiesDelta: p.casualtiesDelta } : {}),
        ...(p.postureSet !== null ? { postureSet: p.postureSet } : {}),
        statusFlagsAdd: p.statusFlagsAdd,
        statusFlagsRemove: p.statusFlagsRemove,
      })),
      regionPatches: c.stateDelta.regionPatches.map((p) => ({
        regionId: p.regionId,
        ...(p.tensionLevelDelta !== null ? { tensionLevelDelta: p.tensionLevelDelta } : {}),
        ...(p.setControllingFaction !== null
          ? { setControllingFaction: p.setControllingFaction }
          : {}),
        addPresentFactions: p.addPresentFactions,
        removePresentFactions: p.removePresentFactions,
        addIncidents: p.addIncidents,
      })),
      forcePatches: c.stateDelta.forcePatches.map((p) => ({
        factionId: p.factionId,
        capabilityId: p.capabilityId,
        ...(p.quantityDelta !== null ? { quantityDelta: p.quantityDelta } : {}),
        ...(p.postureSet !== null ? { postureSet: p.postureSet } : {}),
        ...(p.readinessDelta !== null ? { readinessDelta: p.readinessDelta } : {}),
      })),
      knowledgeAdditions: c.stateDelta.knowledgeAdditions.map((k) => {
        if (k.scope === "common") {
          return {
            scope: "common" as const,
            entry: { text: k.text, ...(k.tag ? { tag: k.tag } : {}) },
          };
        }
        if (!k.faction) {
          throw new Error(
            `LLM returned secret knowledge with no faction id (text="${k.text}")`,
          );
        }
        return {
          scope: "secret" as const,
          faction: k.faction,
          entry: { text: k.text, ...(k.tag ? { tag: k.tag } : {}) },
        };
      }),
    },
    visibility: Object.fromEntries(c.visibility.map((v) => [v.faction, v.level])),
    outcomeKinds: c.outcomeKinds,
    capabilityCitations: c.capabilityCitations,
    ...(c.flagsExternalActor ? { flagsExternalActor: c.flagsExternalActor } : {}),
  }));

  return {
    output: llmResp.parsed,
    trace: {
      request: { system: ADJUDICATOR_SYSTEM_PROMPT, user, mockContext },
      response: llmResp.raw,
      mock: llmResp.mock,
    },
    candidates,
  };
}
