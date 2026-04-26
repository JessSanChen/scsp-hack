import { Command } from "commander";
import { inspectGame } from "../index.js";

export function inspectCommand(): Command {
  const cmd = new Command("inspect");
  cmd
    .description("Inspect a game's state, tree, briefings, and escalations")
    .argument("<gameDir>", "Path to the game directory")
    .option("-t, --turn <n>", "Focus on a specific turn", (v) => Number.parseInt(v, 10))
    .option("--tree", "Print the full candidate tree (all turns)", false)
    .option("--briefings", "Print briefings for the focused turn", false)
    .option("--json", "Print machine-readable JSON instead of human format", false)
    .action(
      async (
        gameDir: string,
        opts: { turn?: number; tree?: boolean; briefings?: boolean; json?: boolean },
      ) => {
        const view = await inspectGame(gameDir, opts.turn !== undefined ? { turn: opts.turn } : {});
        if (opts.json) {
          console.log(JSON.stringify(view, null, 2));
          return;
        }

        const { config, tree, pending, turnFocus } = view;
        console.log(`Game: ${gameDir}`);
        console.log(`Scenario: ${config.scenarioName} (${config.scenarioId})`);
        console.log(`Seed: ${config.seed}  LLM: ${config.llmModel}${config.useMock ? " (mock)" : ""}`);
        console.log(`Turns resolved: ${tree.turns.length}`);
        console.log(`Current state turn: ${tree.currentState.turn}`);
        if (pending) {
          console.log(`PENDING: turn ${pending.turn} awaiting human answer`);
        }
        console.log("");

        console.log("Faction state:");
        for (const [id, fs] of Object.entries(tree.currentState.factions)) {
          console.log(
            `  ${id}: PW=${fs.politicalWill} FR=${fs.forceReadiness} cas=${fs.casualties} flags=[${fs.statusFlags.join(",")}]`,
          );
        }
        console.log("Region state:");
        for (const [id, rs] of Object.entries(tree.currentState.regions)) {
          console.log(
            `  ${id}: tension=${rs.tensionLevel} control=${rs.controllingFaction ?? "contested"}`,
          );
        }
        console.log("");

        if (opts.tree) {
          console.log("=== Tree (all resolved turns) ===");
          for (const t of tree.turns) {
            console.log(`Turn ${t.turn}: selected=${t.selectedCandidateId} roll=${t.rngRoll.toFixed(3)}`);
            for (const c of t.candidates) {
              const mark = c.id === t.selectedCandidateId ? "*" : " ";
              console.log(
                `  ${mark} ${c.id}: p=${c.probability.toFixed(2)} conseq=${c.consequentiality} conf=${c.confidence.toFixed(2)} :: ${c.summary}`,
              );
            }
            if (t.escalation) {
              console.log(
                `  ESCALATION: ${t.escalation.reasons.join("; ")} | answer="${t.escalation.humanResponseText ?? "(candidate)"}"`,
              );
            }
          }
          console.log("");
        }

        if (turnFocus) {
          console.log(`=== Turn ${turnFocus.turn} focus ===`);
          console.log("Actions:");
          for (const [factionId, actions] of Object.entries(turnFocus.actions)) {
            console.log(`  ${factionId}:`);
            for (const a of actions) console.log(`    - ${a.summary}`);
          }
          console.log("Candidates:");
          for (const c of turnFocus.candidates) {
            const mark = c.id === turnFocus.selectedCandidateId ? "*" : " ";
            console.log(
              `  ${mark} ${c.id}: p=${c.probability.toFixed(2)} conseq=${c.consequentiality} :: ${c.summary}`,
            );
            console.log(`     rationale: ${c.rationale}`);
          }
          if (turnFocus.escalation) {
            console.log("Escalation:");
            console.log(`  reasons: ${turnFocus.escalation.reasons.join("; ")}`);
            if (turnFocus.escalation.humanResponseText) {
              console.log(`  human guidance: ${turnFocus.escalation.humanResponseText}`);
            }
            if (turnFocus.escalation.humanChoseCandidateId) {
              console.log(`  human chose: ${turnFocus.escalation.humanChoseCandidateId}`);
            }
          }
          if (opts.briefings) {
            console.log("Briefings:");
            for (const [k, v] of Object.entries(turnFocus.briefings)) {
              const [, faction] = k.split(":");
              console.log(`  ${faction}: ${v.headline}`);
              console.log(`    ${v.body}`);
              for (const b of v.bullets) console.log(`    - ${b}`);
            }
          }
        }
      },
    );
  return cmd;
}
