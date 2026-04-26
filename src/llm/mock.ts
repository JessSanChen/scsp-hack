/**
 * Deterministic mock LLM.
 *
 * Three call sites are supported:
 *   - "candidate-gen": 3 candidate outcomes spanning de-escalation,
 *     limited-incident, and broad-escalation archetypes, with typed
 *     stateDeltas, escalationLevelDelta, outcomeKinds, and
 *     capabilityCitations populated so offline runs exercise the
 *     campaign aggregator's mining paths end-to-end.
 *   - "player:<factionId>": faction-biased structured action set.
 *     USA / ROC trend toward deterrence/diplomacy, PRC trends toward
 *     pressure. Output varies with seed so Monte Carlo gets a real
 *     distribution rather than identical games.
 *   - "briefer:<factionId>": short per-faction briefing.
 *
 * Determinism: outputs are seeded by a hash of the request's
 * mockContext (turn, faction, etc.). Same context => same output.
 */

import seedrandom from "seedrandom";
import type { LlmClient, LlmRequest, LlmResponse } from "./types.js";
import type { CandidateGenerationOutput, BriefingOutput } from "../adjudicator/schema.js";
import type { PlayerDecisionOutput } from "../players/schema.js";

interface MockTurnContext {
  turn: number;
  factionIds: string[];
  regionIds: string[];
  capabilityIds: string[];
  outcomeKindIds: string[];
  actionSummaries: Record<string, string[]>;
  actionCapabilities: Record<string, string[]>;
  escalationLevel: number;
  factionForcesFingerprint: Record<string, string>;
}

interface MockBriefingContext {
  turn: number;
  faction: string;
  selectedSummary: string;
  visibility: "full" | "partial" | "none";
}

interface MockPlayerContext {
  factionId: string;
  factionShortName: string;
  turn: number;
  actionKinds: string[];
  ownCapabilityIds: string[];
  ownForcesFingerprint: string;
  escalationLevel: number;
  objectives: string[];
}

export interface MockClientOptions {
  /**
   * Extra entropy salted into the per-call seed. Game seed gets passed
   * through this so Monte Carlo arms with the same `mockContext` but
   * different game seeds produce different outputs.
   */
  globalSeed?: number;
}

export function createMockClient(options: MockClientOptions = {}): LlmClient {
  const globalSeed = options.globalSeed ?? 0;
  return {
    modelName: "mock-llm-v1",
    isMock: true,
    async complete<T>(
      req: LlmRequest,
      parse: (raw: unknown) => T,
    ): Promise<LlmResponse<T>> {
      let raw: unknown;
      if (req.call === "candidate-gen") {
        raw = generateCandidates(req, globalSeed);
      } else if (req.call.startsWith("player:")) {
        raw = generatePlayerDecision(req, globalSeed);
      } else if (req.call.startsWith("briefer:")) {
        raw = generateBriefing(req);
      } else {
        throw new Error(`Mock LLM has no handler for call '${req.call}'`);
      }
      return { parsed: parse(raw), raw, mock: true };
    },
  };
}

/* ---------------- Candidate generation ------------------------------- */

function generateCandidates(req: LlmRequest, globalSeed: number): CandidateGenerationOutput {
  const ctx = (req.mockContext ?? {}) as Partial<MockTurnContext>;
  const turn = ctx.turn ?? 1;
  const factions = ctx.factionIds ?? [];
  const regions = ctx.regionIds ?? [];
  const capabilityIds = ctx.capabilityIds ?? [];
  const outcomeKinds = ctx.outcomeKindIds ?? [];
  const actionCaps = ctx.actionCapabilities ?? {};
  const escalationLevel = ctx.escalationLevel ?? 0;
  const forcesFp = ctx.factionForcesFingerprint ?? {};
  const forcesFpKey = factions.map((f) => `${f}=${forcesFp[f] ?? ""}`).join(";");

  const seedKey = `mock::candidates::g=${globalSeed}::turn=${turn}::esc=${escalationLevel}::factions=${factions.join(",")}::caps=${Object.values(actionCaps).flat().join("|")}::forces=${forcesFpKey}`;
  const rng = seedrandom(seedKey);

  // Map a desired tag to the closest scenario outcome-kind id; the
  // mock tries to reuse the canonical scenario vocabulary.
  const pickKind = (preferred: string[]): string[] => {
    const out: string[] = [];
    for (const p of preferred) {
      const hit = outcomeKinds.find((k) => k === p)
        ?? outcomeKinds.find((k) => k.includes(p) || p.includes(k));
      if (hit && !out.includes(hit)) out.push(hit);
    }
    if (out.length === 0 && outcomeKinds.length > 0) out.push(outcomeKinds[0]!);
    return out.slice(0, 3);
  };

  // Capabilities cited by all factions' submitted actions become the
  // "in-play" capability set for this turn. The mock reliably echoes
  // those into capabilityCitations on every candidate so the campaign
  // aggregator has signal to mine.
  const inPlayCaps = Array.from(new Set(Object.values(actionCaps).flat()));
  const fallbackCaps = capabilityIds.slice(0, Math.min(3, capabilityIds.length));

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
    escalationLevelDelta: number;
    statusFlag: string;
    outcomeKindHints: string[];
    forcePatchKind: "none" | "light-attrition" | "heavy-attrition";
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
      escalationLevelDelta: -1,
      statusFlag: "deconfliction-active",
      outcomeKindHints: ["de-escalation", "diplomatic-resolution", "status-quo"],
      forcePatchKind: "none",
    },
    {
      suffix: "limited-incident",
      summary: "Low-level kinetic incident with limited casualties; political fallout dominant.",
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
      escalationLevelDelta: 1,
      statusFlag: "alert-level-2",
      outcomeKindHints: ["limited-incident", "kinetic-exchange"],
      forcePatchKind: "light-attrition",
    },
    {
      suffix: "broad-escalation",
      summary: "Broader escalation: PRC widens kinetic action; allies forced off the fence.",
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
      escalationLevelDelta: 2,
      statusFlag: "alert-level-3",
      outcomeKindHints: ["broad-escalation", "kinetic-exchange", "ally-mobilisation"],
      forcePatchKind: "heavy-attrition",
    },
  ];

  // Bias weights forward over turns so later turns are riskier.
  const turnBias = Math.min(turn, 4);
  archetypes[1]!.weight += 0.1 * turnBias;
  archetypes[2]!.weight += 0.15 * turnBias;
  // Higher escalation level draws probability mass toward escalation.
  if (escalationLevel >= 4) {
    archetypes[2]!.weight += 0.5;
    archetypes[0]!.weight = Math.max(0.2, archetypes[0]!.weight - 0.3);
  }
  // Per-seed jitter (varies with globalSeed) so Monte Carlo seeds diverge.
  for (const a of archetypes) a.weight = Math.max(0.05, a.weight + (rng() - 0.5) * 0.5);

  const totalWeight = archetypes.reduce((a, b) => a + b.weight, 0);

  const candidates = archetypes.map((arc, i) => {
    const probability = arc.weight / totalWeight;
    const factionPatches = factions.map((f) => ({
      factionId: f,
      politicalWillDelta: arc.politicalWillBias + Math.round((rng() - 0.5) * 4),
      forceReadinessDelta: arc.forceReadinessBias + Math.round((rng() - 0.5) * 3),
      casualtiesDelta:
        arc.casualtyBias > 0 ? Math.round(arc.casualtyBias * (0.6 + rng() * 0.6)) : 0,
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
      addIncidents:
        i === 1 ? ["Maritime militia and CSG vessels exchanged warnings."] : ([] as string[]),
    }));

    // Pick a couple of capabilities to attrite for the kinetic arcs.
    const candCaps = inPlayCaps.length > 0 ? inPlayCaps : fallbackCaps;
    const capPick = (n: number) => {
      const out: string[] = [];
      for (let k = 0; k < n && k < candCaps.length; k++) {
        const idx = Math.floor(rng() * candCaps.length);
        const cid = candCaps[idx]!;
        if (!out.includes(cid)) out.push(cid);
      }
      return out;
    };
    const forcePatches: Array<{
      factionId: string;
      capabilityId: string;
      quantityDelta: number | null;
      postureSet: "garrison" | "forward" | "engaged" | "attrited" | null;
      readinessDelta: number | null;
    }> = [];
    if (arc.forcePatchKind !== "none" && factions.length > 0 && capabilityIds.length > 0) {
      const damaged = arc.forcePatchKind === "light-attrition" ? capPick(1) : capPick(2);
      for (const cid of damaged) {
        const fid = factions[Math.floor(rng() * factions.length)]!;
        forcePatches.push({
          factionId: fid,
          capabilityId: cid,
          quantityDelta:
            arc.forcePatchKind === "heavy-attrition" ? -2 : -1,
          postureSet: arc.forcePatchKind === "heavy-attrition" ? "attrited" : null,
          readinessDelta: arc.forcePatchKind === "heavy-attrition" ? -10 : -5,
        });
      }
    }

    const visibility = factions.map((f) => ({
      faction: f,
      level: "full" as const,
    }));
    const cited = Array.from(new Set([...inPlayCaps, ...capPick(2)]));
    return {
      id: `t${turn}-${arc.suffix}`,
      summary: arc.summary,
      rationale: arc.rationale,
      probability,
      consequentiality: arc.consequentiality,
      confidence: arc.confidence,
      stateDelta: {
        narrativeAppend: `Turn ${turn}: ${arc.summary}`,
        escalationLevelDelta: arc.escalationLevelDelta,
        factionPatches,
        regionPatches,
        forcePatches,
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
      outcomeKinds: pickKind(arc.outcomeKindHints),
      capabilityCitations: cited,
      flagsExternalActor: arc.flagsExternalActor,
    };
  });

  return {
    rationaleSummary: `Mock candidates for turn ${turn} drawn from de-escalation, limited-incident, and broad-escalation archetypes (escLevel=${escalationLevel}).`,
    candidates,
  };
}

/* ---------------- Player decision ------------------------------------ */

const FACTION_BIAS: Record<string, { aggressive: number; restraint: number; preferred: string[] }> = {
  USA: {
    aggressive: 0.3,
    restraint: 0.5,
    preferred: ["military-deter", "diplomatic", "info-ops", "cyber"],
  },
  ROC: {
    aggressive: 0.15,
    restraint: 0.7,
    preferred: ["military-defend", "diplomatic", "mobilisation", "info-ops"],
  },
  PRC: {
    aggressive: 0.55,
    restraint: 0.25,
    preferred: ["military-deter", "info-ops", "economic", "cyber", "military-strike"],
  },
};

function generatePlayerDecision(req: LlmRequest, globalSeed: number): PlayerDecisionOutput {
  const ctx = (req.mockContext ?? {}) as Partial<MockPlayerContext>;
  const factionId = ctx.factionId ?? "FACTION";
  const turn = ctx.turn ?? 1;
  const actionKinds = ctx.actionKinds ?? [];
  const ownCaps = ctx.ownCapabilityIds ?? [];
  const escalationLevel = ctx.escalationLevel ?? 0;
  const forcesFp = ctx.ownForcesFingerprint ?? "";

  const seedKey = `mock::player::g=${globalSeed}::faction=${factionId}::turn=${turn}::esc=${escalationLevel}::forces=${forcesFp}`;
  const rng = seedrandom(seedKey);

  const bias = FACTION_BIAS[factionId] ?? { aggressive: 0.4, restraint: 0.4, preferred: actionKinds };
  // Pick action count: 2-3 typical, biased upward at higher escalation.
  const actionCount = Math.min(4, Math.max(2, 2 + Math.floor((rng() + escalationLevel / 10) * 2)));

  const usedKinds = new Set<string>();
  const actions = [];
  for (let i = 0; i < actionCount; i++) {
    // Pick kind: roll against bias; with some probability pick from preferred.
    const r = rng();
    let kind: string;
    if (r < 0.7 && bias.preferred.length > 0) {
      const candidates = bias.preferred.filter((k) => !usedKinds.has(k) && actionKinds.includes(k));
      kind = candidates.length > 0
        ? candidates[Math.floor(rng() * candidates.length)]!
        : actionKinds[Math.floor(rng() * actionKinds.length)] ?? "diplomatic";
    } else {
      kind = actionKinds[Math.floor(rng() * actionKinds.length)] ?? "diplomatic";
    }
    usedKinds.add(kind);

    // Pick capabilities: 1-2 from ownCaps biased by kind.
    const isMilitary = kind.startsWith("military") || kind === "mobilisation";
    const isCyber = kind === "cyber";
    const isInfoOps = kind === "info-ops";
    const useCount = isMilitary ? 1 + Math.round(rng()) : isCyber ? 1 : isInfoOps ? 0 : 1;
    const capsForKind = ownCaps.filter((c) => {
      if (isCyber) return c.includes("cyber");
      if (isMilitary) return !c.includes("cyber");
      return true;
    });
    const useCaps: string[] = [];
    for (let k = 0; k < useCount && capsForKind.length > 0; k++) {
      const cid = capsForKind[Math.floor(rng() * capsForKind.length)]!;
      if (!useCaps.includes(cid)) useCaps.push(cid);
    }

    const summaries = SUMMARY_LIBRARY[kind] ?? [
      `${factionId} executes a ${kind} action.`,
    ];
    const summary = summaries[Math.floor(rng() * summaries.length)]!;
    actions.push({
      id: `t${turn}-${factionId}-${i + 1}`,
      summary,
      details: null as string | null,
      kind,
      capabilitiesUsed: useCaps,
    });
  }

  const rationale = buildRationale(factionId, escalationLevel, bias, rng);

  return { rationale, actions };
}

const SUMMARY_LIBRARY: Record<string, string[]> = {
  "military-deter": [
    "Conduct a freedom-of-navigation transit through the Strait under public ROE.",
    "Hold combined exercises with allies in adjacent waters as a visible deterrent.",
    "Forward-deploy additional surface combatants to a high-visibility station.",
  ],
  "military-defend": [
    "Activate coastal anti-ship batteries and air-defense alert posture.",
    "Disperse fighter aircraft to hardened sites; raise civil defense alert.",
    "Reinforce key infrastructure with mobile SAM batteries.",
  ],
  "military-strike": [
    "Authorise pre-emptive long-range strike against staging launchers.",
    "Conduct a punitive standoff strike against a high-signature target.",
  ],
  "diplomatic": [
    "Open back-channel communications via a neutral third party to avoid a misstep.",
    "Issue a measured public statement reaffirming policy red lines.",
    "Convene an allied ministerial to align on signaling.",
  ],
  "economic": [
    "Announce targeted export controls on dual-use components.",
    "Move to freeze designated assets under existing sanctions authorities.",
  ],
  "cyber": [
    "Posture cyber teams to disrupt adversary C2 if a kinetic threshold is crossed.",
    "Execute a defensive hunt-forward operation on partner networks.",
  ],
  "info-ops": [
    "Publicly release ISR imagery framing adversary movements as provocative.",
    "Coordinate messaging with allied governments on the legality of activity.",
  ],
  "clandestine": [
    "Insert a small intelligence team to verify reported deployments.",
    "Run a covert influence campaign against adversary domestic narrative.",
  ],
  "mobilisation": [
    "Activate reserve units for civil defense and rear-area security.",
    "Begin partial mobilisation while emphasising defensive intent in public.",
  ],
};

function buildRationale(
  factionId: string,
  escalationLevel: number,
  bias: { aggressive: number; restraint: number },
  rng: seedrandom.PRNG,
): string {
  const phraseRoll = rng();
  if (escalationLevel <= 2) {
    return phraseRoll < 0.5
      ? `${factionId}: Tension is contained; we keep escalation reversible while signalling resolve and preserving optionality.`
      : `${factionId}: We prioritise deterrence by demonstration over kinetic action; restraint preserves coalition cohesion.`;
  }
  if (escalationLevel >= 5 && bias.aggressive > 0.4) {
    return `${factionId}: Escalation has crossed the inflection point; we accept higher kinetic risk to deny the adversary a fait accompli.`;
  }
  if (escalationLevel >= 5) {
    return `${factionId}: Crisis is acute; we couple defensive hardening with a high-credibility off-ramp to recover deterrence.`;
  }
  return `${factionId}: We tighten coordination with partners and preserve option space, expecting the next 24-48h to be decisive.`;
}

/* ---------------- Briefing ------------------------------------------ */

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
