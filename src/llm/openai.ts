/**
 * OpenAI-backed implementation of `LlmClient`.
 *
 * Uses Chat Completions with `response_format: { type: "json_schema",
 * json_schema: <strict> }`. The strict JSON schemas come from
 * `src/adjudicator/schema.ts`.
 */

import OpenAI from "openai";
import type { LlmClient, LlmRequest, LlmResponse } from "./types.js";

export interface OpenAiClientOptions {
  apiKey?: string;
  model?: string;
  /** Optional override base URL (proxy, Azure, etc.). */
  baseURL?: string;
}

export function createOpenAiClient(options: OpenAiClientOptions = {}): LlmClient {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OpenAI API key not provided. Set OPENAI_API_KEY or pass apiKey, or use --use-mock.",
    );
  }
  const model = options.model ?? "gpt-4o-mini";
  const client = new OpenAI({
    apiKey,
    baseURL: options.baseURL,
  });

  return {
    modelName: model,
    isMock: false,
    async complete<T>(
      req: LlmRequest,
      parse: (raw: unknown) => T,
    ): Promise<LlmResponse<T>> {
      const response = await client.chat.completions.create({
        model,
        temperature: req.temperature ?? 0.4,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: req.jsonSchema.name,
            strict: req.jsonSchema.strict,
            schema: req.jsonSchema.schema,
          },
        },
      });
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error(`OpenAI returned no content for call '${req.call}'`);
      }
      let raw: unknown;
      try {
        raw = JSON.parse(content);
      } catch (err) {
        throw new Error(
          `OpenAI returned non-JSON content for call '${req.call}': ${(err as Error).message}`,
        );
      }
      return {
        parsed: parse(raw),
        raw,
        mock: false,
      };
    },
  };
}
