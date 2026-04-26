import { promises as fs } from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { runCampaign, aggregateCampaign } from "../index.js";

export function campaignCommand(): Command {
  const cmd = new Command("campaign");
  cmd.description("Manage Monte Carlo campaigns: new | run | report");

  const newCmd = new Command("new");
  newCmd
    .description("Create a campaign directory with a manifest")
    .argument("<campaignDir>", "Campaign directory to create")
    .requiredOption("-m, --manifest <file>", "Path to a manifest.json")
    .action(async (campaignDir: string, opts: { manifest: string }) => {
      const dir = path.resolve(campaignDir);
      await fs.mkdir(dir, { recursive: true });
      const raw = await fs.readFile(opts.manifest, "utf8");
      // Validate by re-parsing through the runner's loader.
      JSON.parse(raw);
      await fs.writeFile(path.join(dir, "manifest.json"), raw, "utf8");
      console.log(`Campaign initialised at ${dir}`);
    });
  cmd.addCommand(newCmd);

  const runCmd = new Command("run");
  runCmd
    .description("Run all arms x seeds in a campaign")
    .argument("<campaignDir>", "Campaign directory")
    .option("--parallelism <n>", "Override manifest parallelism", (v) => Number.parseInt(v, 10))
    .option("--use-mock", "Force mock LLM regardless of manifest")
    .action(async (campaignDir: string, opts: { parallelism?: number; useMock?: boolean }) => {
      const dir = path.resolve(campaignDir);
      const manifestPath = path.join(dir, "manifest.json");
      const summary = await runCampaign({
        manifestPath,
        campaignDir: dir,
        ...(opts.parallelism !== undefined ? { parallelism: opts.parallelism } : {}),
        ...(opts.useMock ? { useMock: true } : {}),
      });
      console.log(
        `Campaign done: ${summary.succeeded}/${summary.total} games succeeded (${summary.failed} failed).`,
      );
      if (summary.failures.length > 0) {
        console.log("Failures:");
        for (const f of summary.failures) {
          console.log(`  - [${f.arm}/${f.seed}] ${f.error}`);
        }
      }
    });
  cmd.addCommand(runCmd);

  const reportCmd = new Command("report");
  reportCmd
    .description("Aggregate a finished campaign and print or write a report")
    .argument("<campaignDir>", "Campaign directory")
    .option("--baseline <armId>", "Baseline arm id (defaults to first arm)")
    .option("--json", "Print report as JSON instead of a human summary", false)
    .option("-o, --out <file>", "Write report JSON to a file")
    .action(async (campaignDir: string, opts: { baseline?: string; json?: boolean; out?: string }) => {
      const report = await aggregateCampaign({
        campaignDir,
        ...(opts.baseline ? { baseline: opts.baseline } : {}),
      });
      if (opts.out) {
        await fs.writeFile(path.resolve(opts.out), JSON.stringify(report, null, 2), "utf8");
        console.log(`Report written to ${opts.out}`);
      }
      if (opts.json) {
        console.log(JSON.stringify(report, null, 2));
        return;
      }
      printHumanReport(report);
    });
  cmd.addCommand(reportCmd);

  return cmd;
}

function printHumanReport(report: Awaited<ReturnType<typeof aggregateCampaign>>): void {
  console.log(`Campaign: ${report.campaignDir}`);
  console.log(`Baseline arm: ${report.baselineArmId}`);
  console.log(`Total games observed: ${report.gamesTotal}`);
  console.log("");
  for (const arm of report.arms) {
    console.log(`== arm: ${arm.armId}${arm.armId === report.baselineArmId ? " (baseline)" : ""} ==`);
    if (arm.description) console.log(`   ${arm.description}`);
    if (arm.perturbations.length > 0) {
      console.log("   perturbations:");
      for (const p of arm.perturbations) {
        const dq = p.quantityDelta !== undefined ? ` qty=${p.quantityDelta >= 0 ? "+" : ""}${p.quantityDelta}` : "";
        console.log(`     - ${p.faction}.${p.capability}${dq}`);
      }
    }
    console.log(`   games: ${arm.gamesObserved}`);
    const e = arm.finalEscalationLevel;
    console.log(
      `   final escalationLevel: mean=${e.mean.toFixed(2)} std=${e.std.toFixed(2)} p25=${e.p25.toFixed(1)} p50=${e.p50.toFixed(1)} p75=${e.p75.toFixed(1)} min=${e.min} max=${e.max}`,
    );
    const histLine = arm.finalEscalationDistribution.bins
      .map((b, i) => `${b}:${arm.finalEscalationDistribution.counts[i]}`)
      .join(" ");
    console.log(`   distribution: ${histLine}`);
    const topOutcomes = topK(arm.outcomeKindFrequency, 5);
    if (topOutcomes.length > 0) {
      console.log(`   top outcomeKinds: ${topOutcomes.map(([k, v]) => `${k}=${v.toFixed(2)}`).join(", ")}`);
    }
    const topCaps = topK(arm.capabilityCitationFrequency, 6);
    if (topCaps.length > 0) {
      console.log(`   top capabilityCitations: ${topCaps.map(([k, v]) => `${k}=${v.toFixed(2)}`).join(", ")}`);
    }
    for (const [fid, fs] of Object.entries(arm.factionFinalState)) {
      console.log(
        `   ${fid}: PW mean=${fs.politicalWill.mean.toFixed(1)} cas mean=${fs.casualties.mean.toFixed(1)} FR mean=${fs.forceReadiness.mean.toFixed(1)}`,
      );
    }
    if (arm.vsBaseline) {
      const d = arm.vsBaseline.finalEscalationDelta;
      console.log(
        `   vs ${arm.vsBaseline.baselineArmId}: escDelta mean=${d.mean.toFixed(2)} ci95=[${d.ci95[0].toFixed(2)}, ${d.ci95[1].toFixed(2)}]`,
      );
      for (const [fid, dd] of Object.entries(arm.vsBaseline.casualtiesDeltaByFaction)) {
        console.log(
          `      ${fid} casualtiesDelta mean=${dd.mean.toFixed(1)} ci95=[${dd.ci95[0].toFixed(1)}, ${dd.ci95[1].toFixed(1)}]`,
        );
      }
    }
    console.log("");
  }
}

function topK(rec: Record<string, number>, k: number): Array<[string, number]> {
  return Object.entries(rec)
    .sort(([, a], [, b]) => b - a)
    .slice(0, k);
}
