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
    .option(
      "--max-turns-between-asks <n>",
      "Tunable: max quiet turns before forcing a human ask",
      (v) => Number.parseInt(v, 10),
    )
    .option(
      "--consequentiality-threshold <n>",
      "Tunable: escalate when any candidate consequentiality >= this",
      (v) => Number.parseInt(v, 10),
    )
    .option(
      "--min-top-probability <n>",
      "Tunable: escalate when no candidate has at least this probability",
      (v) => Number.parseFloat(v),
    )
    .option(
      "--no-ask-on-external-actor",
      "Disable the heuristic that escalates when a candidate flags an external actor",
    )
    .action(async (opts: {
      scenario: string;
      out: string;
      seed?: number;
      useMock?: boolean;
      llmModel: string;
      maxTurnsBetweenAsks?: number;
      consequentialityThreshold?: number;
      minTopProbability?: number;
      askOnExternalActor: boolean;
    }) => {
      const heuristics: Record<string, unknown> = {};
      if (opts.maxTurnsBetweenAsks !== undefined) {
        heuristics.maxTurnsBetweenAsks = opts.maxTurnsBetweenAsks;
      }
      if (opts.consequentialityThreshold !== undefined) {
        heuristics.consequentialityThreshold = opts.consequentialityThreshold;
      }
      if (opts.minTopProbability !== undefined) {
        heuristics.minTopProbability = opts.minTopProbability;
      }
      if (opts.askOnExternalActor === false) {
        heuristics.askOnExternalActorMention = false;
      }
      const handle = await startGame({
        scenario: opts.scenario,
        out: opts.out,
        seed: opts.seed,
        useMock: opts.useMock,
        llmModel: opts.llmModel,
        heuristics,
      });
      console.log(`Game started: ${handle.gameDir}`);
      console.log(`Scenario: ${handle.config.scenarioName}`);
      console.log(`Seed: ${handle.config.seed}`);
      console.log(`LLM: ${handle.config.llmModel}${handle.config.useMock ? " (mock)" : ""}`);
      console.log(
        `Heuristics: ${JSON.stringify(handle.config.heuristics)}`,
      );
    });
  return cmd;
}
