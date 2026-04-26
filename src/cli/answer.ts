import { Command } from "commander";
import { answerEscalation, getPending } from "../index.js";

export function answerCommand(): Command {
  const cmd = new Command("answer");
  cmd
    .description("Answer a pending escalation and resume the turn")
    .argument("<gameDir>", "Path to the game directory")
    .option("--text <s>", "Free-form guidance to add to the regeneration prompt")
    .option("--candidate <id>", "Force-select a specific candidate by id")
    .option("--show", "Print the pending question and exit without answering", false)
    .option("--use-mock", "Force mock LLM regardless of game config")
    .action(
      async (
        gameDir: string,
        opts: {
          text?: string;
          candidate?: string;
          show?: boolean;
          useMock?: boolean;
        },
      ) => {
        if (opts.show) {
          const pending = await getPending(gameDir);
          if (!pending) {
            console.log("No pending escalation.");
            return;
          }
          console.log(pending.question);
          console.log("");
          console.log("Candidates:");
          for (const c of pending.candidates) {
            console.log(
              `  ${c.id}: p=${c.probability.toFixed(2)} conseq=${c.consequentiality} :: ${c.summary}`,
            );
          }
          return;
        }
        if (!opts.text && !opts.candidate) {
          throw new Error("Provide either --text or --candidate");
        }
        const result = await answerEscalation(
          gameDir,
          {
            ...(opts.text ? { text: opts.text } : {}),
            ...(opts.candidate ? { chooseCandidateId: opts.candidate } : {}),
          },
          { useMock: opts.useMock },
        );
        if (result.kind === "advanced") {
          console.log(
            `[turn ${result.turn}] resolved with candidate '${result.selectedCandidateId}': ${result.summary}`,
          );
        } else if (result.kind === "pending") {
          console.log(`[turn ${result.turn}] still pending. Reasons:`);
          for (const r of result.reasons) console.log(`  - ${r}`);
        } else if (result.kind === "complete") {
          console.log(`Game complete after turn ${result.finalTurn}.`);
        }
      },
    );
  return cmd;
}
