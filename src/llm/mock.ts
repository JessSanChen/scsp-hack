/**
 * Deterministic mock LLM.
 *
 * Produces structured outputs for two call sites:
 *   - "candidate-gen" / "post-escalation": 3 candidate outcomes with
 *     varied probabilities, consequentiality, and a typed StateDelta.
 *   - "briefer:<factionId>": a small per-faction briefing.
 *
 * Determinism: outputs are seeded by a hash of the request's mockContext
 * (turn, faction set, etc.). No randomness; same context => same output.
 *
 * The mock deliberately escalates on certain turns so the human-in-the-loop
 * code path is exercised in offline demo runs.
 */

import seedrandom from "seedrandom";
import type { LlmClient, LlmRequest, LlmResponse } from "./types.js";
import type { CandidateGenerationOutput, BriefingOutput } from "../adjudicator/schema.js";

interface MockTurnContext {
  turn: number;
  factionIds: string[];
  regionIds: string[];
  /** Action summaries per faction, e.g. { USA: ["Hold fire ..."] }. */
  actionSummaries: Record<string, string[]>;
  /** True if this is a post-escalation regeneration. */
  postEscalation?: boolean;
  /** Free-form human guidance text, when post-escalation. */
  humanGuidance?: string;
}

interface MockBriefingContext {
  turn: number;
  faction: string;
  selectedSummary: string;
  visibility: "full" | "partial" | "none";
}

export function createMockClient(): LlmClient {
  return {
    modelName: "mock-llm-v1",
    isMock: true,
    async complete<T>(
      req: LlmRequest,
      parse: (raw: unknown) => T,
    ): Promise<LlmResponse<T>> {
      let raw: unknown;
      if (req.call === "candidate-gen" || req.call === "post-escalation") {
        raw = generateCandidates(req);
      } else if (req.call.startsWith("briefer:")) {
        raw = generateBriefing(req);
      } else {
        throw new Error(`Mock LLM has no handler for call '${req.call}'`);
      }
      return { parsed: parse(raw), raw, mock: true };
    },
  };
}

function generateCandidates(req: LlmRequest): CandidateGenerationOutput {
  const ctx = (req.mockContext ?? {}) as Partial<MockTurnContext>;
  const turn = ctx.turn ?? 1;
  const factions = ctx.factionIds ?? [];
  const regions = ctx.regionIds ?? [];
  const postEsc = ctx.postEscalation === true;

  const seedKey = `mock::turn=${turn}::factions=${factions.join(",")}::post=${postEsc ? 1 : 0}`;
  const rng = seedrandom(seedKey);

  // Three labelled candidate archetypes covering the range from
  // de-escalation to direct kinetic exchange. The mock intentionally
  // raises consequentiality on later turns so heuristics escalate.
  type Arc = {
    suffix: string;
    summary: string;
    rationale: string;
    weight: number;
    consequentiality: 1 | 2 | 3 | 4 | 5;
    confidence: number;
    flagsExternalActor: string | null;
    politicalWillBias: number;
    forceReadinessBias: number;
    casualtyBias: number;
    tensionDelta: number;
    statusFlag: string;
  };
  const archetypes: Arc[] = [
    {
      suffix: "deescalate",
      summary: "Mutual pause: both sides accept face-saving deconfliction.",
      rationale:
        "Quiet diplomatic channels and constrained ROE leave room for a low-friction off-ramp. Domestic audiences are temporarily satisfied.",
      weight: 1,
      consequentiality: 2,
      confidence: 0.7,
      flagsExternalActor: null,
      politicalWillBias: -2,
      forceReadinessBias: 0,
      casualtyBias: 0,
      tensionDelta: -1,
      statusFlag: "deconfliction-active",
    },
    {
      suffix: "limited-incident",
      summary:
        "Low-level kinetic incident with limited casualties; political fallout dominant.",
      rationale:
        "Forces in close proximity make accidental engagement plausible despite restrictive ROE; outcome turns on framing.",
      weight: 1.4,
      consequentiality: 3,
      confidence: 0.55,
      flagsExternalActor: null,
      politicalWillBias: -5,
      forceReadinessBias: -2,
      casualtyBias: 8,
      tensionDelta: 1,
      statusFlag: "alert-level-2",
    },
    {
      suffix: "broad-escalation",
      summary:
        "Broader escalation: PRC widens kinetic action; allies forced off the fence.",
      rationale:
        "PRC domestic pressure and forward-deployed launchers create a one-way ratchet; allied posture critical.",
      weight: 0.8,
      consequentiality: 5,
      confidence: 0.4,
      flagsExternalActor: turn >= 2 ? "Japan" : null,
      politicalWillBias: -10,
      forceReadinessBias: -8,
      casualtyBias: 35,
      tensionDelta: 2,
      statusFlag: "alert-level-3",
    },
  ];

  // Bias weights forward over turns so later turns are riskier.
  const turnBias = Math.min(turn, 4);
  archetypes[1]!.weight += 0.1 * turnBias;
  archetypes[2]!.weight += 0.15 * turnBias;
  if (postEsc) {
    // Human input nudges toward the de-escalatory arc for the demo.
    archetypes[0]!.weight += 0.6;
    archetypes[2]!.weight = Math.max(0.2, archetypes[2]!.weight - 0.4);
  }

  const totalWeight = archetypes.reduce((a, b) => a + b.weight, 0);

  const candidates = archetypes.map((arc, i) => {
    const probability = arc.weight / totalWeight;
    const factionPatches = factions.map((f) => ({
      factionId: f,
      politicalWillDelta: arc.politicalWillBias + Math.round((rng() - 0.5) * 4),
      forceReadinessDelta:
        arc.forceReadinessBias + Math.round((rng() - 0.5) * 3),
      casualtiesDelta: arc.casualtyBias > 0 ? Math.round(arc.casualtyBias * (0.6 + rng() * 0.6)) : 0,
      postureSet: null,
      statusFlagsAdd: arc.statusFlag ? [arc.statusFlag] : [],
      statusFlagsRemove: [] as string[],
    }));
    const regionPatches = regions.map((r) => ({
      regionId: r,
      tensionLevelDelta: arc.tensionDelta,
      setControllingFaction: null,
      addPresentFactions: [] as string[],
      removePresentFactions: [] as string[],
      addIncidents: i === 1 ? ["Maritime militia and CSG vessels exchanged warnings."] : [],
    }));
    const visibility = factions.map((f) => ({
      faction: f,
      level: "full" as const,
    }));
    return {
      id: `t${turn}-${arc.suffix}`,
      summary: arc.summary,
      rationale: arc.rationale,
      probability,
      consequentiality: arc.consequentiality,
      confidence: arc.confidence,
      stateDelta: {
        narrativeAppend: `Turn ${turn}: ${arc.summary}`,
        factionPatches,
        regionPatches,
        knowledgeAdditions: [
          {
            scope: "common" as const,
            faction: null,
            text: `Turn ${turn} resolution: ${arc.summary}`,
            tag: "summary",
          },
        ],
      },
      visibility,
      flagsExternalActor: arc.flagsExternalActor,
    };
  });

  return {
    rationaleSummary: postEsc
      ? `Mock candidates regenerated for turn ${turn} after human guidance: ${ctx.humanGuidance ?? "(no guidance)"}`
      : `Mock candidates for turn ${turn} drawn from de-escalation, limited-incident, and broad-escalation archetypes.`,
    candidates,
  };
}

function generateBriefing(req: LlmRequest): BriefingOutput {
  const ctx = (req.mockContext ?? {}) as Partial<MockBriefingContext>;
  const turn = ctx.turn ?? 1;
  const faction = ctx.faction ?? "FACTION";
  const summary = ctx.selectedSummary ?? "Outcome resolved.";
  const visibility = ctx.visibility ?? "full";

  if (visibility === "none") {
    return {
      headline: `Turn ${turn}: no new actionable intelligence`,
      body: `${faction} did not directly observe outcome of this turn. Standing posture maintained.`,
      bullets: ["No confirmed observations", "Standing orders unchanged"],
    };
  }
  const partialSuffix =
    visibility === "partial"
      ? " Partial observation only; full picture pending intelligence cycle."
      : "";
  return {
    headline: `Turn ${turn} brief for ${faction}`,
    body: `${summary}${partialSuffix}`,
    bullets: [
      `Resolution: ${summary}`,
      `Visibility level: ${visibility}`,
      "Recommend reviewing standing posture for next turn.",
    ],
  };
}
