# Wargame Adjudicator

An agent-driven wargaming adjudicator. Players (pre-scripted in this demo)
submit actions per turn; the adjudicator generates probabilistic outcome
candidates with an LLM, applies a typed state delta to a persistent world
model, and escalates to a human expert when heuristics demand. Every
decision is written to an append-only JSONL log so games are queryable
and replayable.

## Quick start

```bash
npm install

# Start a new game from the bundled scenario.
# Use --use-mock to run fully offline with the deterministic stub LLM.
npm run wargame -- new --scenario taiwan-2026 --out games/g1 --seed 42 --use-mock

# Advance one turn. Exits early with a pending question if the
# adjudicator escalates to the human expert.
npm run wargame -- step games/g1

# Resume after the human answers an escalation.
npm run wargame -- answer games/g1 --text "Consider how Japan's response shifts US risk tolerance."

# Inspect game state and the candidate tree.
npm run wargame -- inspect games/g1 --turn 2 --tree
```

To use the real OpenAI backend, drop `--use-mock` and set `OPENAI_API_KEY`.

## Layout

- `src/engine/` - world state, JSONL tree store, RNG, turn orchestration.
- `src/adjudicator/` - candidate-generating agent, escalation heuristics, LLM schemas and prompts.
- `src/comms/` - per-faction briefing generator (visibility-scoped).
- `src/llm/` - OpenAI client + deterministic mock.
- `src/scenario/` - scenario loader and types.
- `src/cli/` - thin CLI wrappers around the public API in `src/index.ts`.
- `scenarios/taiwan-2026/` - bundled US/ROC/PRC scenario; see References below.
- `games/<game-id>/` - per-game output (gitignored): `events.jsonl`,
  `state/turn-N.json`, `briefings/turn-N/<faction>.json`, optional
  `pending.json` when the engine is awaiting a human answer.

## Public API

`src/index.ts` exports the same surface the CLI uses:

```ts
startGame({ scenario, out, seed?, heuristics?, useMock? })
stepGame(gameDir)
getPending(gameDir)
answerEscalation(gameDir, { text?, chooseCandidateId? })
inspectGame(gameDir, { turn? })
```

A future UI can call these directly without going through the CLI.

## References

The bundled `taiwan-2026` scenario is inspired by the wargame design and
fictional U.S.-China crisis examined in:

- Lamparth, M., et al. *Human vs. Machine: Behavioral Differences Between
  Expert Humans and Language Models in Wargame Simulations.* arXiv:2403.03407
  (2024). [PDF](https://arxiv.org/pdf/2403.03407) ·
  [abs](https://arxiv.org/abs/2403.03407)
