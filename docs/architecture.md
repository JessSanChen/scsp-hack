# Wargame Architecture

Two visual tours of how the system works:

1. **System overview** — what every game looks like, end to end.
2. **Monte Carlo** — how many games combine into a campaign and an
   apples-to-apples force-structure comparison.

All diagrams are [Mermaid](https://mermaid.js.org/) and render natively in
GitHub, GitLab, Obsidian, Cursor's markdown preview, etc. Pre-rendered
SVGs and 2x PNGs also live in [`diagrams/`](diagrams/) for embedding
elsewhere (slides, papers, posters):

| Diagram                              | Source                                          | SVG                                             | PNG                                             |
| ------------------------------------ | ----------------------------------------------- | ----------------------------------------------- | ----------------------------------------------- |
| System overview (component flow)     | [`.mmd`](diagrams/system-overview.mmd)          | [`.svg`](diagrams/system-overview.svg)          | [`.png`](diagrams/system-overview.png)          |
| Per-turn sequence                    | [`.mmd`](diagrams/turn-sequence.mmd)            | [`.svg`](diagrams/turn-sequence.svg)            | [`.png`](diagrams/turn-sequence.png)            |
| Counterfactual fork & replay         | [`.mmd`](diagrams/fork-replay.mmd)              | [`.svg`](diagrams/fork-replay.svg)              | [`.png`](diagrams/fork-replay.png)              |
| Monte Carlo campaign pipeline        | [`.mmd`](diagrams/campaign-pipeline.mmd)        | [`.svg`](diagrams/campaign-pipeline.svg)        | [`.png`](diagrams/campaign-pipeline.png)        |
| Monte Carlo aggregation & bootstrap  | [`.mmd`](diagrams/aggregation.mmd)              | [`.svg`](diagrams/aggregation.svg)              | [`.png`](diagrams/aggregation.png)              |

> The exported `.mmd` files set `flowchart: { htmlLabels: false }` so
> text is rendered as native SVG `<text>` (works in every viewer; the
> default `htmlLabels: true` only renders inside browsers because it
> uses `<foreignObject>` HTML).

Re-render after edits with:

```bash
# SVG (vector, scales infinitely)
npx -p @mermaid-js/mermaid-cli mmdc \
  -i docs/diagrams/<name>.mmd \
  -o docs/diagrams/<name>.svg \
  -b "#0b1220"

# PNG (raster, 2x scale for retina)
npx -p @mermaid-js/mermaid-cli mmdc \
  -i docs/diagrams/<name>.mmd \
  -o docs/diagrams/<name>.png \
  -b "#0b1220" -s 2
```

---

## 1. System overview

The engine is a pure function of `(scenario, seed, world_state, llm)`.
Each turn three player LLMs decide actions in parallel; an adjudicator
LLM proposes weighted outcome candidates; a seeded RNG samples one;
the typed delta is applied to the persistent `WorldState`; per-faction
briefings are produced. Every step is appended to a JSONL log so games
are queryable, replayable, and forkable.

### High-level data flow

```mermaid
%%{init: {'theme':'dark', 'flowchart': {'curve':'basis', 'nodeSpacing': 30, 'rankSpacing': 50}}}%%
flowchart TB
    classDef scen   fill:#1e293b,stroke:#64748b,color:#e2e8f0
    classDef world  fill:#0f172a,stroke:#38bdf8,color:#e2e8f0,stroke-width:2px
    classDef player fill:#172554,stroke:#3b82f6,color:#dbeafe
    classDef adj    fill:#3b0764,stroke:#a855f7,color:#f3e8ff
    classDef rng    fill:#422006,stroke:#f59e0b,color:#fef3c7
    classDef io     fill:#052e16,stroke:#22c55e,color:#dcfce7
    classDef log    fill:#020617,stroke:#94a3b8,color:#e2e8f0,stroke-dasharray:4 3
    classDef ui     fill:#1e1b4b,stroke:#818cf8,color:#e0e7ff

    SCEN["<b>Scenario</b> · taiwan-2026<br/>factions · regions · capabilities · actions"]:::scen

    W["<b>WorldState</b> (persistent)<br/>turn · escalationLevel · factions { forces, will, readiness, casualties }<br/>regions { tension, incidents } · commonKnowledge[]"]:::world

    subgraph PLAYERS["1. Player agents · parallel · one LLM call per faction"]
      direction LR
      PUSA["USA LLM"]:::player
      PPRC["PRC LLM"]:::player
      PROC["ROC LLM"]:::player
    end

    ADJ["<b>2. Adjudicator LLM</b><br/>generates K outcome candidates · each with<br/>probability · consequentiality · typed state delta ·<br/>capability citations · outcome-kind tags · narrative"]:::adj

    RNG["<b>3. Seeded RNG</b><br/>weighted sample over candidates<br/>seedrandom(scenario, turn)"]:::rng

    APPLY["<b>4. Apply delta</b> → new WorldState"]:::io

    BRIEF["<b>5. Briefer</b> · per-faction visibility filter<br/>→ JSON briefing for next turn"]:::io

    LOG[("<b>events.jsonl</b> (append-only)<br/>GAME_STARTED · TURN_START · PLAYER_DECISION x3<br/>ACTIONS_SUBMITTED · CANDIDATES_GENERATED · OUTCOME_SELECTED<br/>STATE_SNAPSHOT · BRIEFING_DELIVERED x3<br/>FORK_FROM (forks only) · GAME_COMPLETE")]:::log

    subgraph CONSUMERS["Consumers (post-hoc, no LLM calls)"]
      direction LR
      UI["React replay<br/>(baseline ↔ fork)"]:::ui
      INSP["CLI inspect"]:::ui
      FORK["Fork & replay"]:::ui
      MC["Monte Carlo<br/>(see §2)"]:::ui
    end

    SCEN --> W
    W -- "state" --> PLAYERS
    PLAYERS -- "actions + rationale" --> ADJ
    W -. "state" .-> ADJ
    ADJ -- "candidates[]" --> RNG
    RNG -- "selected" --> APPLY
    APPLY -- "WorldState'" --> W
    APPLY --> BRIEF
    BRIEF -. "next-turn briefings" .-> PLAYERS

    PLAYERS  -. event .-> LOG
    ADJ      -. event .-> LOG
    RNG      -. event .-> LOG
    APPLY    -. event .-> LOG
    BRIEF    -. event .-> LOG

    LOG --> CONSUMERS
```

### What happens inside a single turn

```mermaid
%%{init: {'theme':'dark'}}%%
sequenceDiagram
    autonumber
    participant W as WorldState
    participant PUSA as USA player LLM
    participant PPRC as PRC player LLM
    participant PROC as ROC player LLM
    participant ADJ as Adjudicator LLM
    participant RNG as Seeded RNG
    participant L as events.jsonl
    participant B as Briefer

    Note over W,L: turn N has just settled

    L->>L: TURN_START turn=N+1

    par USA
      W-->>PUSA: state + USA briefing(N)
      PUSA->>L: PLAYER_DECISION (USA)<br/>actions[] + rationale
    and PRC
      W-->>PPRC: state + PRC briefing(N)
      PPRC->>L: PLAYER_DECISION (PRC)<br/>actions[] + rationale
    and ROC
      W-->>PROC: state + ROC briefing(N)
      PROC->>L: PLAYER_DECISION (ROC)<br/>actions[] + rationale
    end

    L->>L: ACTIONS_SUBMITTED
    PUSA-->>ADJ: actions
    PPRC-->>ADJ: actions
    PROC-->>ADJ: actions
    W-->>ADJ: state
    ADJ->>L: CANDIDATES_GENERATED<br/>K candidates with p, conseq, delta

    ADJ-->>RNG: candidates + probabilities
    RNG->>L: OUTCOME_SELECTED<br/>(deterministic for fixed seed)

    RNG-->>W: applyDelta(selected.delta)
    W->>L: STATE_SNAPSHOT turn=N+1

    par per faction
      W-->>B: state + visibility filter
      B->>L: BRIEFING_DELIVERED (faction)
    end

    Note over W,L: ready for turn N+2
```

### Counterfactual fork & replay

A fork is just a new game whose `WorldState` is seeded from a baseline
snapshot at turn `T`, plus an optional override (`force-actions`,
`pin-candidate`, or initial-conditions perturbations such as
`+4 SSNs`). The same seed is used so any divergence between the two
runs is fully attributable to the override.

```mermaid
%%{init: {'theme':'dark', 'flowchart': {'curve':'basis'}}}%%
flowchart LR
    classDef snap fill:#0f172a,stroke:#38bdf8,color:#e2e8f0
    classDef ev   fill:#1e293b,stroke:#64748b,color:#e2e8f0
    classDef base fill:#172554,stroke:#3b82f6,color:#dbeafe
    classDef fork fill:#422006,stroke:#f59e0b,color:#fef3c7
    classDef ovr  fill:#3b0764,stroke:#a855f7,color:#f3e8ff

    B0["state @ T0"]:::snap
    B1["state @ T1"]:::snap
    B2["state @ T2"]:::snap
    B3["state @ T3"]:::snap
    B4["state @ T4"]:::snap

    B0 -- "turn 1<br/>(baseline)" --> B1
    B1 -- "turn 2" --> B2
    B2 -- "turn 3" --> B3
    B3 -- "turn 4" --> B4

    OVR["FORK_FROM<br/>fromTurn=2<br/>override = force-actions<br/>(USA pre-emptive strike)"]:::ovr
    B2 -. "snapshot copy" .-> F2
    OVR --> F2

    F2["state @ T2'"]:::fork
    F3["state @ T3'"]:::fork
    F4["state @ T4'"]:::fork

    F2 -- "turn 3 (replay,<br/>same seed)" --> F3
    F3 -- "turn 4" --> F4

    BASE["events.jsonl<br/>(baseline)"]:::base
    FORKLOG["events.jsonl<br/>(fork)"]:::fork

    B4 --> BASE
    F4 --> FORKLOG

    BASE -- "side-by-side<br/>compare in UI" --> CMP["UI replay:<br/>baseline ↔ fork"]:::ev
    FORKLOG --> CMP
```

---

## 2. Monte Carlo campaigns

A single game with a single seed is an anecdote. Monte Carlo turns it
into evidence: pin a question (e.g. *"does +4 Pacific SSNs lower
expected escalation?"*), enumerate counterfactual **arms**, sweep many
**seeds** per arm, and aggregate the resulting distributions with
bootstrap confidence intervals against a chosen baseline arm.

### Campaign run pipeline

```mermaid
%%{init: {'theme':'dark', 'flowchart': {'curve':'basis'}}}%%
flowchart TB
    classDef man     fill:#1e1b4b,stroke:#818cf8,color:#e0e7ff,stroke-width:2px
    classDef seedbox fill:#172554,stroke:#3b82f6,color:#dbeafe
    classDef armbox  fill:#422006,stroke:#f59e0b,color:#fef3c7
    classDef game    fill:#0f172a,stroke:#64748b,color:#cbd5e1
    classDef agg     fill:#052e16,stroke:#22c55e,color:#dcfce7
    classDef report  fill:#3b0764,stroke:#a855f7,color:#f3e8ff,stroke-width:2px
    classDef pool    fill:#020617,stroke:#94a3b8,color:#e2e8f0,stroke-dasharray:4 3

    M["manifest.json<br/>baseScenario · seeds[S] · arms[A]<br/>parallelism · useMock · llmModel"]:::man

    POOL["Worker pool · capped at parallelism<br/>(p = 2..N concurrent games)"]:::pool

    subgraph PHASE1["Phase 1 · Baselines (1 game per seed)"]
      direction LR
      BS1["seed = 1<br/>baseline game"]:::seedbox
      BS2["seed = 2<br/>baseline game"]:::seedbox
      BSd["⋮"]:::seedbox
      BSN["seed = S<br/>baseline game"]:::seedbox
    end

    subgraph PHASE2["Phase 2 · Counterfactual arms (each arm × each seed)"]
      direction TB
      subgraph ARM1["arm: plus-4-ssn  (USA +4 Pacific SSN @ T0)"]
        direction LR
        F11["fork(seed=1)"]:::armbox
        F12["fork(seed=2)"]:::armbox
        F1d["⋮"]:::armbox
        F1N["fork(seed=S)"]:::armbox
      end
      subgraph ARM2["arm: minus-1-csg  (USA −1 CSG @ T0)"]
        direction LR
        F21["fork(seed=1)"]:::armbox
        F22["fork(seed=2)"]:::armbox
        F2d["⋮"]:::armbox
        F2N["fork(seed=S)"]:::armbox
      end
      subgraph ARMK["arm: …  (any number of arms)"]
        direction LR
        FK1["fork(seed=1)"]:::armbox
        FKd["⋮"]:::armbox
        FKN["fork(seed=S)"]:::armbox
      end
    end

    subgraph GAMES["Per-game outputs"]
      direction LR
      G1["events.jsonl<br/>(arm/seed/)"]:::game
      G2["state/turn-*.json"]:::game
      G3["briefings/turn-*/<faction>.json"]:::game
    end

    subgraph AGG["aggregateCampaign — streams every events.jsonl"]
      direction TB
      A1["Per-arm finalEscalation<br/>distribution (histogram + summary)"]:::agg
      A2["Per-arm meanEscalationByTurn"]:::agg
      A3["outcomeKind frequency<br/>(per arm)"]:::agg
      A4["capability-citation frequency<br/>(per arm)"]:::agg
      A5["per-faction { will, readiness,<br/>casualties } summaries"]:::agg
      A6["per-faction force-quantity<br/>summaries"]:::agg
      A7["bootstrap 95% CI vs baseline arm<br/>(2000 iters, seeded)"]:::agg
    end

    REPORT["CampaignReport JSON<br/>arms[] · vsBaseline deltas · CIs"]:::report

    M --> POOL
    POOL --> PHASE1
    PHASE1 -. "snapshot @ arm.fromTurn (default T0)<br/>+ ForcePatches from arm.perturbations" .-> PHASE2
    POOL --> PHASE2

    PHASE1 --> GAMES
    PHASE2 --> GAMES

    GAMES --> AGG
    AGG --> REPORT
```

### What each arm contributes

For every arm × seed combination the engine produces a complete game.
The aggregator streams the JSONL log of each game and reduces it into
per-arm distributions. Bootstrap resampling then gives confidence
intervals on the *difference* between any non-baseline arm and the
baseline arm.

```mermaid
%%{init: {'theme':'dark'}}%%
flowchart LR
    classDef game fill:#0f172a,stroke:#64748b,color:#cbd5e1
    classDef bin  fill:#172554,stroke:#3b82f6,color:#dbeafe
    classDef boot fill:#422006,stroke:#f59e0b,color:#fef3c7
    classDef out  fill:#3b0764,stroke:#a855f7,color:#f3e8ff,stroke-width:2px

    subgraph SAMP["Per-arm sample (S = seeds in manifest)"]
      direction LR
      S1["game(arm, seed=1)<br/>finalEscalation = e₁<br/>casualties = c₁,..."]:::game
      S2["game(arm, seed=2)<br/>finalEscalation = e₂"]:::game
      Sd["⋮"]:::game
      Sn["game(arm, seed=S)<br/>finalEscalation = e_S"]:::game
    end

    subgraph DIST["Per-arm metric distributions"]
      direction TB
      D1["finalEscalation histogram<br/>(bins 0..10)"]:::bin
      D2["meanEscalationByTurn"]:::bin
      D3["outcomeKind freq · capability-citation freq"]:::bin
      D4["per-faction will / readiness / casualties<br/>(n, mean, std, p25/p50/p75, min/max)"]:::bin
    end

    BOOT["Bootstrap (2000 × resample-with-replacement)<br/>Δ = mean(arm) − mean(baseline)<br/>→ 95% CI on Δ"]:::boot

    REPORT["CampaignReport.arms[i].vsBaseline<br/>{ finalEscalationDelta, politicalWillDeltaByFaction,<br/>casualtiesDeltaByFaction } each with mean + ci95"]:::out

    SAMP --> DIST
    DIST --> BOOT
    BOOT --> REPORT
```

### Concrete example: the bundled `campaigns/demo`

The repo ships with a working demo manifest at `campaigns/demo/manifest.json`:

| arm           | perturbation                                     |
| ------------- | ------------------------------------------------ |
| `baseline`    | none                                             |
| `plus-4-ssn`  | `USA.ssn-pacific.quantityDelta = +4` at T0       |
| `minus-1-csg` | `USA.csg.quantityDelta = −1` at T0               |

With `seeds = 1..30` and `arms = 3` the runner produces **90 games**:

- **30** baseline games (Phase 1)
- **30** `plus-4-ssn` games (Phase 2, fork from each baseline)
- **30** `minus-1-csg` games (Phase 2, fork from each baseline)

After `npm run wargame -- campaign aggregate campaigns/demo` you get a
`report.json` whose `arms[i].vsBaseline` block answers the strategic
question with a CI:

```text
plus-4-ssn  vsBaseline.finalEscalationDelta = -0.43 (95% CI: -0.71 .. -0.18)
minus-1-csg vsBaseline.finalEscalationDelta = +0.62 (95% CI:  0.30 ..  0.95)
```

(Numbers are illustrative; actual values come from the run.)

---

## File map (where each component lives)

```
src/
├── engine/        # WorldState, JSONL log, RNG, turn loop, fork helpers
├── adjudicator/   # candidate-generating LLM agent + schemas + prompts
├── players/       # per-faction LLM player agent
├── comms/         # per-faction visibility-scoped briefer
├── fork/          # fork-and-replay machinery (snapshot + override)
├── campaign/      # Monte Carlo orchestration + aggregation
├── llm/           # OpenAI client, deterministic mock, factory
├── scenario/      # scenario loader and types
└── cli/           # thin CLI wrappers (new / run / fork / campaign / inspect)

scenarios/taiwan-2026/   # bundled scenario
games/<game-id>/         # per-game output (events.jsonl, state/, briefings/)
campaigns/<campaign-id>/ # per-campaign output (manifest.json, games/, report.json)
frontend/                # React/Vite replay viewer (consumes events.jsonl)
```
