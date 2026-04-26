import { Command } from "commander";
import { inspectGame } from "../index.js";

export function inspectCommand(): Command {
  const cmd = new Command("inspect");
  cmd
    .description("Inspect a game's state, tree, and briefings")
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
        const view = await inspectGame(
          gameDir,
          opts.turn !== undefined ? { turn: opts.turn } : {},
        );
        if (opts.json) {
          console.log(JSON.stringify(view, null, 2));
          return;
        }

        const { config, tree, turnFocus } = view;
        console.log(`Game: ${gameDir}`);
        console.log(`Scenario: ${config.scenarioName} (${config.scenarioId})`);
        console.log(`Seed: ${config.seed}  LLM: ${config.llmModel}${config.useMock ? " (mock)" : ""}`);
        console.log(`Turns resolved: ${tree.turns.length}`);
        console.log(`Current state turn: ${tree.currentState.turn}`);
        console.log(`Global escalationLevel: ${tree.currentState.escalationLevel}`);
        if (tree.fork) {
          console.log(`Fork: from ${tree.fork.baseGameDir} at turn ${tree.fork.fromTurn}`);
        }
        if (tree.complete) {
          console.log(`Game COMPLETE`);
        }
        console.log("");

        console.log("Faction state:");
        for (const [id, fs] of Object.entries(tree.currentState.factions)) {
          console.log(
            `  ${id}: PW=${fs.politicalWill} FR=${fs.forceReadiness} cas=${fs.casualties} flags=[${fs.statusFlags.join(",")}]`,
          );
          for (const [capId, fl] of Object.entries(fs.forces)) {
            console.log(`    ${capId}: qty=${fl.quantity} posture=${fl.posture} readiness=${fl.readiness}`);
          }
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
            console.log(
              `Turn ${t.turn}: selected=${t.selectedCandidateId} roll=${t.rngRoll.toFixed(3)}`,
            );
            for (const c of t.candidates) {
              const mark = c.id === t.selectedCandidateId ? "*" : " ";
              const tags = c.outcomeKinds?.length ? ` kinds=[${c.outcomeKinds.join(",")}]` : "";
              const caps = c.capabilityCitations?.length ? ` caps=[${c.capabilityCitations.join(",")}]` : "";
              console.log(
                `  ${mark} ${c.id}: p=${c.probability.toFixed(2)} conseq=${c.consequentiality} conf=${c.confidence.toFixed(2)}${tags}${caps} :: ${c.summary}`,
              );
            }
          }
          console.log("");
        }

        if (turnFocus) {
          console.log(`=== Turn ${turnFocus.turn} focus ===`);
          console.log("Actions:");
          for (const [factionId, actions] of Object.entries(turnFocus.actions)) {
            const rat = turnFocus.playerRationales?.[factionId];
            console.log(`  ${factionId}:`);
            if (rat) console.log(`    rationale: ${rat}`);
            for (const a of actions) {
              console.log(`    - (${a.kind}) ${a.summary}  [uses: ${a.capabilitiesUsed.join(", ")}]`);
            }
          }
          console.log("Candidates:");
          for (const c of turnFocus.candidates) {
            const mark = c.id === turnFocus.selectedCandidateId ? "*" : " ";
            console.log(
              `  ${mark} ${c.id}: p=${c.probability.toFixed(2)} conseq=${c.consequentiality} :: ${c.summary}`,
            );
            console.log(`     rationale: ${c.rationale}`);
            if (c.outcomeKinds?.length) console.log(`     outcomeKinds: ${c.outcomeKinds.join(", ")}`);
            if (c.capabilityCitations?.length) {
              console.log(`     capabilityCitations: ${c.capabilityCitations.join(", ")}`);
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
