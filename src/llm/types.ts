/**
 * LLM client abstraction. Both the OpenAI-backed and the deterministic
 * mock implementations satisfy this interface. The adjudicator and
 * briefer are written against this surface, never against an SDK.
 */

export interface LlmRequest {
  /** Logical name for the call site, used in JSONL traces. */
  call: string;
  /** System prompt; persistent across the call. */
  system: string;
  /** User prompt; specific to this call. */
  user: string;
  /** Strict JSON schema descriptor passed to OpenAI. */
  jsonSchema: {
    name: string;
    strict: true;
    schema: Record<string, unknown>;
  };
  /** Sampling temperature (0..2). */
  temperature?: number;
  /**
   * Optional, mock-only context. The OpenAI client ignores this; the
   * deterministic mock uses it to produce scenario-aware outputs without
   * having to re-parse the prompts.
   */
  mockContext?: Record<string, unknown>;
}

export interface LlmResponse<T> {
  parsed: T;
  raw: unknown;
  /** True if served by the mock (i.e. no network call). */
  mock: boolean;
}

export interface LlmClient {
  modelName: string;
  /** Whether this client is the deterministic mock. */
  isMock: boolean;
  complete<T>(req: LlmRequest, parse: (raw: unknown) => T): Promise<LlmResponse<T>>;
}
