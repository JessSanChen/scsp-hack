# Wargame Adjudicator

An autonomous wargaming engine. Each faction is driven by an LLM player
agent that emits a structured action set + rationale per turn. An LLM
adjudicator generates probabilistic outcome candidates, samples one with
a seeded RNG, and applies a typed state delta to a persistent world
model. The world includes first-class force-structure modelling
(quantities, postures, readiness per capability), so counterfactual
"what if we had +4 SSNs?" runs produce meaningfully different histories.

Every decision is written to an append-only JSONL log so games are
queryable, replayable, and forkable. A React/Vite frontend reads those
logs back as a static demo.

## Quick start (engine)

```bash
npm install

# Run a 4-turn baseline game with the deterministic mock LLM.
npm run wargame -- new --scenario taiwan-2026 --out games/demo-auto --seed 42 --use-mock
npm run wargame -- run games/demo-auto

# Fork at turn 2 and force the USA to authorise a long-range strike.
npm run wargame -- fork games/demo-auto \
  --out games/demo-fork-strike \
  --from-turn 2 \
  --force-actions games/fork-inputs/force-strike-turn2.json \
  --use-mock

# Inspect any turn (state, forces, candidates, fork lineage).
npm run wargame -- inspect games/demo-auto --turn 2 --tree

# Run a Monte Carlo campaign of N seeds across multiple force-structure arms.
npm run wargame -- campaign run path/to/manifest.json
npm run wargame -- campaign aggregate path/to/campaign-dir
```

To use the real OpenAI backend drop `--use-mock` and set `OPENAI_API_KEY`.

## Quick start (UI demo)

The UI is a pure replay viewer over pre-recorded JSONL events. It does
**not** call any LLM — it consumes whatever runs you've dropped into
`games/`. The `prepare-demo` script copies the two reference runs above
into `frontend/public/demo/` and emits a `manifest.json` describing the
recommended counterfactual.

```bash
# Make sure games/demo-auto and games/demo-fork-strike exist (above).
cd frontend
npm install
npm run dev      # runs prepare-demo automatically, then starts Vite
```

Open the URL Vite prints, click **START SIMULATION**, and watch the
4-turn baseline play out (~15 s). Once the run completes, the
recommended T2 decision node pulses; click it (or the suggestion banner)
to launch the side-by-side counterfactual.

## Layout

- `src/engine/` — world state, JSONL event log, RNG, turn loop, fork helpers.
- `src/adjudicator/` — candidate-generating agent, LLM schemas, prompts.
- `src/players/` — per-faction LLM player agent.
- `src/comms/` — per-faction briefing generator (visibility-scoped).
- `src/fork/` — counterfactual fork-and-replay machinery.
- `src/campaign/` — Monte Carlo orchestration + aggregation.
- `src/llm/` — OpenAI client, deterministic mock, factory.
- `src/scenario/` — scenario loader and types.
- `src/cli/` — thin CLI wrappers around the public API.
- `scenarios/taiwan-2026/` — bundled US/ROC/PRC scenario; see References.
- `games/<game-id>/` — per-game output (gitignored): `events.jsonl`,
  `state/turn-N.json`, `briefings/turn-N/<faction>.json`, `config.json`.
- `frontend/` — React/Vite replay viewer.

## Public API

`src/index.ts` exports the same surface the CLI uses:

```ts
startGame({ scenario, out, seed?, useMock? })
stepGame(gameDir)
runGameToCompletion(gameDir)
forkGame(baseGameDir, { out, fromTurn, perturbations?, override?, useMock? })
runCampaign(manifestPath)
aggregateCampaign(campaignDir)
inspectGame(gameDir, { turn? })
```

## References

The bundled `taiwan-2026` scenario is inspired by the wargame design and
fictional U.S.-China crisis examined in:

- Lamparth, M., et al. *Human vs. Machine: Behavioral Differences Between
  Expert Humans and Language Models in Wargame Simulations.* arXiv:2403.03407
  (2024). [PDF](https://arxiv.org/pdf/2403.03407) ·
  [abs](https://arxiv.org/abs/2403.03407)
