import { Command } from "commander";
import { runGameToCompletion } from "../index.js";

export function runCommand(): Command {
  const cmd = new Command("run");
  cmd
    .description("Run an autonomous game to completion")
    .argument("<gameDir>", "Path to the game directory")
    .option("--use-mock", "Force mock LLM regardless of game config")
    .action(async (gameDir: string, opts: { useMock?: boolean }) => {
      const summary = await runGameToCompletion(
        gameDir,
        opts.useMock ? { useMock: true } : {},
      );
      console.log(
        `Game complete: turn ${summary.finalTurn}, ${summary.turnsRun} turns run.`,
      );
    });
  return cmd;
}
