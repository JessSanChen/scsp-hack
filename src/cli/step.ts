import { Command } from "commander";
import { stepGame } from "../index.js";

export function stepCommand(): Command {
  const cmd = new Command("step");
  cmd
    .description("Advance one turn (exits with 'pending' if the adjudicator escalates)")
    .argument("<gameDir>", "Path to the game directory")
    .option("--use-mock", "Force mock LLM regardless of game config")
    .option("--all", "Keep stepping until the game completes or escalates", false)
    .action(async (gameDir: string, opts: { useMock?: boolean; all?: boolean }) => {
      while (true) {
        const result = await stepGame(gameDir, { useMock: opts.useMock });
        if (result.kind === "advanced") {
          console.log(
            `[turn ${result.turn}] selected '${result.selectedCandidateId}': ${result.summary}`,
          );
        } else if (result.kind === "pending") {
          console.log(
            `[turn ${result.turn}] ESCALATED to human. Run 'wargame answer ${gameDir} --text "..."' to resume.`,
          );
          console.log("Reasons:");
          for (const r of result.reasons) console.log(`  - ${r}`);
          break;
        } else if (result.kind === "complete") {
          console.log(`Game complete after turn ${result.finalTurn}.`);
          break;
        }
        if (!opts.all) break;
      }
    });
  return cmd;
}
