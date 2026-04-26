/**
 * Helpers used by `forkGame` to slice a base game's event log up to a
 * given turn and apply force-structure perturbations to the snapshot.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { applyForcePatches, type WorldState, type ForcePatch } from "../engine/state.js";
import {
  appendEvent,
  readEvents,
  writeStateSnapshot,
  type GameTree,
} from "../engine/tree.js";
import type { GameEvent, ForkOverride } from "../engine/events.js";
import { reconstructTree } from "../engine/tree.js";

/**
 * Take the prefix of a base game's events that fully covers turns
 * [0, fromTurn-1] and write them verbatim into the new fork directory,
 * preserving sequence numbers. Returns the post-prefix WorldState and
 * the count of events copied.
 */
export async function copyBasePrefix(
  baseGameDir: string,
  fromTurn: number,
  forkDir: string,
): Promise<{ stateAfterPrefix: WorldState; eventsCopied: number; baseTree: GameTree }> {
  if (fromTurn < 1) {
    throw new Error(`fromTurn must be >= 1 (got ${fromTurn})`);
  }
  const baseEvents = await readEvents(baseGameDir);
  if (baseEvents.length === 0) {
    throw new Error(`Base game directory '${baseGameDir}' has no events`);
  }
  const baseTree = reconstructTree(baseEvents);

  // We want everything up to (and including) the STATE_SNAPSHOT for turn
  // (fromTurn - 1). Equivalently: drop everything from TURN_START of
  // `fromTurn` onward.
  const sliceUpTo = baseEvents.findIndex(
    (e) => e.kind === "TURN_START" && e.turn === fromTurn,
  );
  let prefixEvents: GameEvent[];
  if (sliceUpTo < 0) {
    // The base game never reached this turn. We accept this iff the base
    // is at least at turn fromTurn-1.
    if (baseTree.currentState.turn < fromTurn - 1) {
      throw new Error(
        `Base game is only at turn ${baseTree.currentState.turn}; cannot fork from turn ${fromTurn}`,
      );
    }
    prefixEvents = baseEvents.filter((e) => e.kind !== "GAME_COMPLETE");
  } else {
    prefixEvents = baseEvents.slice(0, sliceUpTo);
  }

  const stateAfterPrefix = lastSnapshot(prefixEvents) ?? prefixEvents[0]!.kind === "GAME_STARTED"
    ? extractStartingOrLastSnapshot(prefixEvents, fromTurn - 1)
    : null;
  if (!stateAfterPrefix) {
    throw new Error(
      `Could not find a STATE_SNAPSHOT for turn ${fromTurn - 1} in base game`,
    );
  }

  await fs.mkdir(forkDir, { recursive: true });
  // Copy raw event lines verbatim to preserve seq numbers.
  const filePath = path.join(forkDir, "events.jsonl");
  const lines = prefixEvents.map((e) => JSON.stringify(e)).join("\n") + "\n";
  await fs.writeFile(filePath, lines, "utf8");

  // Copy state snapshots for all turns up to fromTurn-1.
  const stateDir = path.join(baseGameDir, "state");
  try {
    const entries = await fs.readdir(stateDir);
    const targetDir = path.join(forkDir, "state");
    await fs.mkdir(targetDir, { recursive: true });
    for (const ent of entries) {
      const m = /^turn-(\d+)\.json$/.exec(ent);
      if (!m) continue;
      const t = Number(m[1]);
      if (t > fromTurn - 1) continue;
      const src = await fs.readFile(path.join(stateDir, ent), "utf8");
      await fs.writeFile(path.join(targetDir, ent), src, "utf8");
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }

  // Copy briefings up to fromTurn-1.
  const briefDir = path.join(baseGameDir, "briefings");
  try {
    const entries = await fs.readdir(briefDir);
    for (const ent of entries) {
      const m = /^turn-(\d+)$/.exec(ent);
      if (!m) continue;
      const t = Number(m[1]);
      if (t > fromTurn - 1) continue;
      const src = path.join(briefDir, ent);
      const dst = path.join(forkDir, "briefings", ent);
      await fs.mkdir(dst, { recursive: true });
      const files = await fs.readdir(src);
      for (const f of files) {
        const buf = await fs.readFile(path.join(src, f), "utf8");
        await fs.writeFile(path.join(dst, f), buf, "utf8");
      }
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }

  return { stateAfterPrefix, eventsCopied: prefixEvents.length, baseTree };
}

function extractStartingOrLastSnapshot(
  events: GameEvent[],
  turn: number,
): WorldState | null {
  // First, look for the most recent STATE_SNAPSHOT at the requested turn.
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]!;
    if (e.kind === "STATE_SNAPSHOT" && e.turn === turn) return e.state;
  }
  // For turn 0, use the GAME_STARTED initial state directly.
  if (turn === 0) {
    const start = events.find((e) => e.kind === "GAME_STARTED");
    if (start && start.kind === "GAME_STARTED") return start.initialState;
  }
  return null;
}

function lastSnapshot(events: GameEvent[]): WorldState | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]!;
    if (e.kind === "STATE_SNAPSHOT") return e.state;
  }
  return null;
}

/**
 * Append the synthetic FORK_FROM event followed by a perturbed
 * STATE_SNAPSHOT, both written into the fork directory.
 */
export async function writeForkSeam(
  forkDir: string,
  args: {
    baseGameDir: string;
    fromTurn: number;
    perturbations: ForcePatch[];
    overrides?: ForkOverride;
    stateBefore: WorldState;
  },
): Promise<WorldState> {
  await appendEvent(forkDir, {
    kind: "FORK_FROM",
    baseGameDir: args.baseGameDir,
    fromTurn: args.fromTurn,
    perturbations: args.perturbations,
    ...(args.overrides ? { overrides: args.overrides } : {}),
  });
  const perturbed = args.perturbations.length > 0
    ? applyForcePatches(args.stateBefore, args.perturbations)
    : args.stateBefore;
  if (args.perturbations.length > 0) {
    await writeStateSnapshot(forkDir, perturbed);
    await appendEvent(forkDir, {
      kind: "STATE_SNAPSHOT",
      turn: perturbed.turn,
      state: perturbed,
      origin: "fork-perturbed",
    });
  }
  return perturbed;
}
