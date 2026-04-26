#!/usr/bin/env node
/**
 * CLI entry point. Each subcommand is a thin wrapper around the public
 * API in `src/index.ts`. Adding a UI later means calling those same
 * functions, not these handlers.
 */

import { Command } from "commander";
import { newCommand } from "./new.js";
import { stepCommand } from "./step.js";
import { answerCommand } from "./answer.js";
import { inspectCommand } from "./inspect.js";

const program = new Command();
program
  .name("wargame")
  .description("Agent-driven wargame adjudicator")
  .version("0.1.0");

program.addCommand(newCommand());
program.addCommand(stepCommand());
program.addCommand(answerCommand());
program.addCommand(inspectCommand());

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
