#!/usr/bin/env node
/**
 * CLI entry point. Each subcommand is a thin wrapper around the public
 * API in `src/index.ts`. Adding a UI later means calling those same
 * functions, not these handlers.
 */

import { Command } from "commander";
import { newCommand } from "./new.js";
import { stepCommand } from "./step.js";
import { runCommand } from "./run.js";
import { inspectCommand } from "./inspect.js";
import { forkCommand } from "./fork.js";
import { campaignCommand } from "./campaign.js";

const program = new Command();
program
  .name("wargame")
  .description("Autonomous LLM-vs-LLM wargame adjudicator with force-structure counterfactuals")
  .version("0.2.0");

program.addCommand(newCommand());
program.addCommand(stepCommand());
program.addCommand(runCommand());
program.addCommand(inspectCommand());
program.addCommand(forkCommand());
program.addCommand(campaignCommand());

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
