import { Command } from "commander";
import { startGame } from "../index.js";

export function newCommand(): Command {
  const cmd = new Command("new");
  cmd
    .description("Create a new game from a scenario")
    .requiredOption("-s, --scenario <name>", "Scenario name (folder under scenarios/)")
    .requiredOption("-o, --out <dir>", "Game directory to create")
    .option("--seed <n>", "Deterministic RNG seed", (v) => Number.parseInt(v, 10))
    .option("--use-mock", "Use the deterministic mock LLM (no network)", false)
    .option("--llm-model <name>", "OpenAI model name", "gpt-4o-mini")
    .action(async (opts: {
      scenario: string;
      out: string;
      seed?: number;
      useMock?: boolean;
      llmModel: string;
    }) => {
      const handle = await startGame({
        scenario: opts.scenario,
        out: opts.out,
        ...(opts.seed !== undefined ? { seed: opts.seed } : {}),
        ...(opts.useMock ? { useMock: true } : {}),
        llmModel: opts.llmModel,
      });
      console.log(`Game started: ${handle.gameDir}`);
      console.log(`Scenario: ${handle.config.scenarioName}`);
      console.log(`Seed: ${handle.config.seed}`);
      console.log(`LLM: ${handle.config.llmModel}${handle.config.useMock ? " (mock)" : ""}`);
    });
  return cmd;
}
