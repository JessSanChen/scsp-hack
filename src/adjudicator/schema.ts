/**
 * Zod schemas for LLM-produced structured outputs and the JSON schemas
 * we hand to OpenAI's `response_format: { type: "json_schema" }`.
 *
 * OpenAI strict mode requires every property to be in `required` and
 * `additionalProperties: false` on every object. We hand-write the JSON
 * schemas to avoid surprises, and use zod purely for runtime validation
 * after the response comes back.
 */

import { z } from "zod";

/* ---------------- StateDelta (LLM-facing) ---------------------------- */

const FactionPatchSchema = z
  .object({
    factionId: z.string().min(1),
    politicalWillDelta: z.number().nullable(),
    forceReadinessDelta: z.number().nullable(),
    casualtiesDelta: z.number().nullable(),
    postureSet: z.string().nullable(),
    statusFlagsAdd: z.array(z.string()),
    statusFlagsRemove: z.array(z.string()),
  })
  .strict();

const RegionPatchSchema = z
  .object({
    regionId: z.string().min(1),
    tensionLevelDelta: z.number().nullable(),
    setControllingFaction: z.string().nullable(),
    addPresentFactions: z.array(z.string()),
    removePresentFactions: z.array(z.string()),
    addIncidents: z.array(z.string()),
  })
  .strict();

const ForcePatchSchema = z
  .object({
    factionId: z.string().min(1),
    capabilityId: z.string().min(1),
    quantityDelta: z.number().nullable(),
    postureSet: z.enum(["garrison", "forward", "engaged", "attrited"]).nullable(),
    readinessDelta: z.number().nullable(),
  })
  .strict();

const KnowledgeAdditionSchema = z
  .object({
    scope: z.enum(["common", "secret"]),
    faction: z.string().nullable(),
    text: z.string().min(1),
    tag: z.string().nullable(),
  })
  .strict();

const StateDeltaSchema = z
  .object({
    narrativeAppend: z.string().min(1),
    escalationLevelDelta: z.number().nullable(),
    factionPatches: z.array(FactionPatchSchema),
    regionPatches: z.array(RegionPatchSchema),
    forcePatches: z.array(ForcePatchSchema),
    knowledgeAdditions: z.array(KnowledgeAdditionSchema),
  })
  .strict();

const VisibilityEntrySchema = z
  .object({
    faction: z.string().min(1),
    level: z.enum(["full", "partial", "none"]),
  })
  .strict();

const CandidateSchema = z
  .object({
    id: z.string().min(1),
    summary: z.string().min(1),
    rationale: z.string().min(1),
    probability: z.number().min(0).max(1),
    consequentiality: z.number().int().min(1).max(5),
    confidence: z.number().min(0).max(1),
    stateDelta: StateDeltaSchema,
    visibility: z.array(VisibilityEntrySchema),
    outcomeKinds: z.array(z.string()),
    capabilityCitations: z.array(z.string()),
    flagsExternalActor: z.string().nullable(),
  })
  .strict();

export const CandidateGenerationOutputSchema = z
  .object({
    rationaleSummary: z.string().min(1),
    candidates: z.array(CandidateSchema).min(2).max(6),
  })
  .strict();

export type CandidateGenerationOutput = z.infer<typeof CandidateGenerationOutputSchema>;

/* ---------------- Briefing -------------------------------------------- */

export const BriefingOutputSchema = z
  .object({
    headline: z.string().min(1),
    body: z.string().min(1),
    bullets: z.array(z.string()).min(1).max(8),
  })
  .strict();

export type BriefingOutput = z.infer<typeof BriefingOutputSchema>;

/* ---------------- Hand-written strict JSON schemas for OpenAI -------- */

export const candidateGenerationJsonSchema = {
  name: "candidate_generation",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["rationaleSummary", "candidates"],
    properties: {
      rationaleSummary: { type: "string" },
      candidates: {
        type: "array",
        minItems: 2,
        maxItems: 6,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "id",
            "summary",
            "rationale",
            "probability",
            "consequentiality",
            "confidence",
            "stateDelta",
            "visibility",
            "outcomeKinds",
            "capabilityCitations",
            "flagsExternalActor",
          ],
          properties: {
            id: { type: "string" },
            summary: { type: "string" },
            rationale: { type: "string" },
            probability: { type: "number", minimum: 0, maximum: 1 },
            consequentiality: {
              type: "integer",
              minimum: 1,
              maximum: 5,
            },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            flagsExternalActor: {
              type: ["string", "null"],
              description:
                "Name of an actor outside the modelled factions (e.g. 'Japan', 'Russia') whose reaction this branch hinges on, or null.",
            },
            outcomeKinds: {
              type: "array",
              items: { type: "string" },
              description:
                "One or more tags drawn from scenario.outcomeKinds, e.g. 'kinetic-exchange', 'de-escalation'.",
            },
            capabilityCitations: {
              type: "array",
              items: { type: "string" },
              description:
                "Capability ids that materially affected this outcome (used for capability-effect mining across Monte Carlo).",
            },
            stateDelta: {
              type: "object",
              additionalProperties: false,
              required: [
                "narrativeAppend",
                "escalationLevelDelta",
                "factionPatches",
                "regionPatches",
                "forcePatches",
                "knowledgeAdditions",
              ],
              properties: {
                narrativeAppend: { type: "string" },
                escalationLevelDelta: {
                  type: ["number", "null"],
                  description:
                    "Increment / decrement to global escalationLevel (0..10). Typically -3..+3.",
                },
                factionPatches: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: [
                      "factionId",
                      "politicalWillDelta",
                      "forceReadinessDelta",
                      "casualtiesDelta",
                      "postureSet",
                      "statusFlagsAdd",
                      "statusFlagsRemove",
                    ],
                    properties: {
                      factionId: { type: "string" },
                      politicalWillDelta: { type: ["number", "null"] },
                      forceReadinessDelta: { type: ["number", "null"] },
                      casualtiesDelta: { type: ["number", "null"] },
                      postureSet: { type: ["string", "null"] },
                      statusFlagsAdd: {
                        type: "array",
                        items: { type: "string" },
                      },
                      statusFlagsRemove: {
                        type: "array",
                        items: { type: "string" },
                      },
                    },
                  },
                },
                regionPatches: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: [
                      "regionId",
                      "tensionLevelDelta",
                      "setControllingFaction",
                      "addPresentFactions",
                      "removePresentFactions",
                      "addIncidents",
                    ],
                    properties: {
                      regionId: { type: "string" },
                      tensionLevelDelta: { type: ["number", "null"] },
                      setControllingFaction: { type: ["string", "null"] },
                      addPresentFactions: {
                        type: "array",
                        items: { type: "string" },
                      },
                      removePresentFactions: {
                        type: "array",
                        items: { type: "string" },
                      },
                      addIncidents: {
                        type: "array",
                        items: { type: "string" },
                      },
                    },
                  },
                },
                forcePatches: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: [
                      "factionId",
                      "capabilityId",
                      "quantityDelta",
                      "postureSet",
                      "readinessDelta",
                    ],
                    properties: {
                      factionId: { type: "string" },
                      capabilityId: { type: "string" },
                      quantityDelta: { type: ["number", "null"] },
                      postureSet: {
                        type: ["string", "null"],
                        enum: ["garrison", "forward", "engaged", "attrited", null],
                      },
                      readinessDelta: { type: ["number", "null"] },
                    },
                  },
                },
                knowledgeAdditions: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["scope", "faction", "text", "tag"],
                    properties: {
                      scope: { type: "string", enum: ["common", "secret"] },
                      faction: { type: ["string", "null"] },
                      text: { type: "string" },
                      tag: { type: ["string", "null"] },
                    },
                  },
                },
              },
            },
            visibility: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["faction", "level"],
                properties: {
                  faction: { type: "string" },
                  level: {
                    type: "string",
                    enum: ["full", "partial", "none"],
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

export const briefingJsonSchema = {
  name: "faction_briefing",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["headline", "body", "bullets"],
    properties: {
      headline: { type: "string" },
      body: { type: "string" },
      bullets: {
        type: "array",
        minItems: 1,
        maxItems: 8,
        items: { type: "string" },
      },
    },
  },
} as const;
