import { promises as fs } from "node:fs";
import { Command } from "commander";
import { forkGame } from "../index.js";
import type { ForkPerturbation } from "../fork/index.js";
import type { Action, FactionId } from "../scenario/types.js";

export function forkCommand(): Command {
  const cmd = new Command("fork");
  cmd
    .description("Fork a game from turn N with optional perturbations / overrides")
    .argument("<baseGameDir>", "Base game directory to fork from")
    .requiredOption("--from-turn <n>", "Turn at which the fork takes effect (>= 1)", (v) =>
      Number.parseInt(v, 10),
    )
    .requiredOption("-o, --out <dir>", "Forked game directory to create")
    .option(
      "--force-perturbation <expr...>",
      "Force-structure perturbation, repeatable. Form: faction.capability.field=value. " +
        "Field is one of quantityDelta | postureSet | readinessDelta. " +
        "E.g. --force-perturbation USA.ssn-pacific.quantityDelta=+4",
    )
    .option(
      "--force-actions <file>",
      "JSON file with shape { factionId: Action[] } overriding the fork-turn actions",
    )
    .option("--pin-candidate <id>", "Force-select a specific candidate id from the base candidate set")
    .option("--seed <n>", "Override the forked game's seed", (v) => Number.parseInt(v, 10))
    .option("--use-mock", "Force mock LLM regardless of base config")
    .option("--no-resume", "Write seam only; do not run remaining turns")
    .action(async (
      baseGameDir: string,
      opts: {
        fromTurn: number;
        out: string;
        forcePerturbation?: string[];
        forceActions?: string;
        pinCandidate?: string;
        seed?: number;
        useMock?: boolean;
        resume?: boolean;
      },
    ) => {
      if (opts.forceActions && opts.pinCandidate) {
        throw new Error("--force-actions and --pin-candidate are mutually exclusive");
      }
      const perturbations: ForkPerturbation[] = parsePerturbations(
        opts.forcePerturbation ?? [],
      );

      const overrideOpts =
        opts.forceActions
          ? {
              kind: "force-actions" as const,
              actions: await parseActionsFile(opts.forceActions),
            }
          : opts.pinCandidate
            ? { kind: "pin-candidate" as const, candidateId: opts.pinCandidate }
            : undefined;

      const r = await forkGame(baseGameDir, {
        out: opts.out,
        fromTurn: opts.fromTurn,
        ...(perturbations.length > 0 ? { perturbations } : {}),
        ...(overrideOpts ? { override: overrideOpts } : {}),
        ...(opts.seed !== undefined ? { seed: opts.seed } : {}),
        ...(opts.useMock ? { useMock: true } : {}),
        ...(opts.resume === false ? { resume: false } : {}),
      });
      console.log(`Forked game written to: ${r.forkDir}`);
      console.log(`  base: ${r.baseGameDir}`);
      console.log(`  from-turn: ${r.fromTurn}`);
      if (r.finalTurn !== undefined) {
        console.log(`  final-turn: ${r.finalTurn} (${r.turnsRun} turns run)`);
      } else {
        console.log(`  seam written; remaining turns NOT run (--no-resume).`);
      }
    });
  return cmd;
}

function parsePerturbations(exprs: string[]): ForkPerturbation[] {
  const out: ForkPerturbation[] = [];
  for (const expr of exprs) {
    const eq = expr.indexOf("=");
    if (eq < 0) {
      throw new Error(`--force-perturbation expects 'faction.capability.field=value'; got '${expr}'`);
    }
    const lhs = expr.slice(0, eq);
    const rhs = expr.slice(eq + 1);
    const parts = lhs.split(".");
    if (parts.length !== 3) {
      throw new Error(
        `--force-perturbation expects 'faction.capability.field=value'; got LHS='${lhs}'`,
      );
    }
    const [factionId, capabilityId, field] = parts as [string, string, string];
    const patch: ForkPerturbation = { factionId, capabilityId };
    if (field === "quantityDelta") {
      patch.quantityDelta = Number(rhs);
      if (!Number.isFinite(patch.quantityDelta)) {
        throw new Error(`Invalid quantityDelta '${rhs}'`);
      }
    } else if (field === "readinessDelta") {
      patch.readinessDelta = Number(rhs);
      if (!Number.isFinite(patch.readinessDelta)) {
        throw new Error(`Invalid readinessDelta '${rhs}'`);
      }
    } else if (field === "postureSet") {
      const valid = ["garrison", "forward", "engaged", "attrited"];
      if (!valid.includes(rhs)) {
        throw new Error(`postureSet must be one of ${valid.join("|")}; got '${rhs}'`);
      }
      patch.postureSet = rhs as ForkPerturbation["postureSet"];
    } else {
      throw new Error(
        `Unknown field '${field}' in perturbation '${expr}'; expected quantityDelta | postureSet | readinessDelta`,
      );
    }
    out.push(patch);
  }
  return out;
}

async function parseActionsFile(filePath: string): Promise<Record<FactionId, Action[]>> {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as Record<FactionId, Action[]>;
  // Best-effort shape check.
  for (const [fid, arr] of Object.entries(parsed)) {
    if (!Array.isArray(arr)) {
      throw new Error(`force-actions: ${fid} should map to an array of Actions`);
    }
    for (const a of arr) {
      if (!a.id || !a.summary || !a.kind || !Array.isArray(a.capabilitiesUsed)) {
        throw new Error(
          `force-actions: each action requires id, summary, kind, capabilitiesUsed[]`,
        );
      }
    }
  }
  return parsed;
}
