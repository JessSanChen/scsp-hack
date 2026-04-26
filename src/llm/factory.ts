/**
 * Shared LLM client factory used by both the public API surface
 * (`src/index.ts`) and lower-level orchestrators (fork, campaign).
 *
 * Factored out to avoid a circular import between `src/index.ts` and
 * `src/fork/index.ts`.
 */

import type { LlmClient } from "./types.js";
import { createMockClient } from "./mock.js";
import { createOpenAiClient } from "./openai.js";
import type { GameConfigFile } from "../engine/runGame.js";

export interface MakeClientOptions {
  useMock?: boolean;
  openAiApiKey?: string;
  /** Override globalSeed handed to the mock client (defaults to config.seed). */
  mockGlobalSeed?: number;
}

export function makeClient(
  config: GameConfigFile,
  opts: MakeClientOptions = {},
): LlmClient {
  const useMock = opts.useMock ?? config.useMock;
  if (useMock) {
    return createMockClient({ globalSeed: opts.mockGlobalSeed ?? config.seed });
  }
  return createOpenAiClient({
    apiKey: opts.openAiApiKey,
    model: config.llmModel,
  });
}
