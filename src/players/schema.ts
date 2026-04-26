/**
 * Zod schema and OpenAI strict JSON schema for the per-faction player
 * agent. Each faction's LLM call returns a structured set of actions
 * for the upcoming turn plus a short rationale.
 */

import { z } from "zod";

const PlayerActionSchema = z
  .object({
    id: z.string().min(1),
    summary: z.string().min(1),
    details: z.string().nullable(),
    kind: z.string().min(1),
    capabilitiesUsed: z.array(z.string()),
  })
  .strict();

export const PlayerDecisionOutputSchema = z
  .object({
    rationale: z.string().min(1),
    actions: z.array(PlayerActionSchema).min(1).max(6),
  })
  .strict();

export type PlayerDecisionOutput = z.infer<typeof PlayerDecisionOutputSchema>;

export const playerDecisionJsonSchema = {
  name: "player_decision",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["rationale", "actions"],
    properties: {
      rationale: { type: "string" },
      actions: {
        type: "array",
        minItems: 1,
        maxItems: 6,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "summary", "details", "kind", "capabilitiesUsed"],
          properties: {
            id: { type: "string" },
            summary: { type: "string" },
            details: { type: ["string", "null"] },
            kind: {
              type: "string",
              description:
                "One of scenario.actionKinds, e.g. 'military-deter', 'diplomatic', 'cyber'.",
            },
            capabilitiesUsed: {
              type: "array",
              items: { type: "string" },
              description:
                "Capability ids belonging to this faction that this action employs.",
            },
          },
        },
      },
    },
  },
} as const;
