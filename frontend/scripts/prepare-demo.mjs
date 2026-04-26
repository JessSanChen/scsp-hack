#!/usr/bin/env node
/**
 * Copies pre-recorded demo runs from the engine's games/ directory into
 * frontend/public/demo/ so the UI can fetch them as static assets.
 *
 *   games/demo-auto/        -> public/demo/baseline/
 *   games/demo-fork-strike/ -> public/demo/fork/
 *
 * Also writes public/demo/manifest.json describing which run is the
 * baseline and which is the recommended counterfactual.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(FRONTEND_ROOT, "..");

const SOURCES = [
  {
    src: path.join(REPO_ROOT, "games", "demo-auto"),
    dst: path.join(FRONTEND_ROOT, "public", "demo", "baseline"),
    label: "baseline",
  },
  {
    src: path.join(REPO_ROOT, "games", "demo-fork-strike"),
    dst: path.join(FRONTEND_ROOT, "public", "demo", "fork"),
    label: "fork",
  },
];

const MANIFEST = {
  baseline: {
    id: "baseline",
    title: "Taiwan Strait 2026 - autonomous baseline",
    events: "/demo/baseline/events.jsonl",
  },
  forks: [
    {
      id: "force-strike-turn2",
      title: "USA forces a pre-emptive strike (T2)",
      description:
        "Counterfactual: at turn 2 the USA authorises a long-range strike against PRC staging launchers instead of its default action set. Same seed, different decision.",
      fromTurn: 2,
      events: "/demo/fork/events.jsonl",
    },
  ],
};

async function copyDir(src, dst) {
  await fs.mkdir(dst, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      await copyDir(s, d);
    } else if (entry.isFile()) {
      await fs.copyFile(s, d);
    }
  }
}

async function rmDir(p) {
  await fs.rm(p, { recursive: true, force: true });
}

async function main() {
  for (const { src, dst, label } of SOURCES) {
    try {
      const stat = await fs.stat(src);
      if (!stat.isDirectory()) {
        throw new Error(`${src} is not a directory`);
      }
    } catch (err) {
      console.warn(
        `[prepare-demo] WARN: skipping ${label} - ${src} not found. ` +
          `Run the wargame CLI to generate it (see README).`,
      );
      continue;
    }
    await rmDir(dst);
    await copyDir(src, dst);
    console.log(`[prepare-demo] copied ${label}: ${src} -> ${dst}`);
  }

  const manifestPath = path.join(
    FRONTEND_ROOT,
    "public",
    "demo",
    "manifest.json",
  );
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(
    manifestPath,
    JSON.stringify(MANIFEST, null, 2) + "\n",
    "utf8",
  );
  console.log(`[prepare-demo] wrote ${manifestPath}`);
}

main().catch((err) => {
  console.error("[prepare-demo] FAILED:", err);
  process.exit(1);
});
