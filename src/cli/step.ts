import { Command } from "commander";
import { stepGame } from "../index.js";

export function stepCommand(): Command {
  const cmd = new Command("step");
  cmd
    .description("Advance one turn (debug; for full runs, prefer `wargame run`)")
    .argument("<gameDir>", "Path to the game directory")
    .option("--use-mock", "Force mock LLM regardless of game config")
    .option("--all", "Keep stepping until the game completes", false)
    .action(async (gameDir: string, opts: { useMock?: boolean; all?: boolean }) => {
      while (true) {
        const result = await stepGame(gameDir, opts.useMock ? { useMock: true } : {});
        if (result.kind === "advanced") {
          console.log(
            `[turn ${result.turn}] selected '${result.selectedCandidateId}': ${result.summary}`,
          );
        } else if (result.kind === "complete") {
          console.log(`Game complete after turn ${result.finalTurn}.`);
          break;
        }
        if (!opts.all) break;
      }
    });
  return cmd;
}
