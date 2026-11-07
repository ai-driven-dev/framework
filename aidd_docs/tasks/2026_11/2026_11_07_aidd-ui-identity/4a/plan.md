---
objective: "The plugin runs as 01-journeys, 02-brand, 03-foundations, 04-components with `organism` in place of `composition`, and a manual pilot gives the same result on the three pilots as before."
status: pending
---

# Plan: aidd-ui 4a, restructuration

Source: [spec.md](../spec.md), slice 4a; brief [brainstorm.md](../brainstorm.md)

## Phases

| #   | Phase        | File                         | Depends on |
| --- | ------------ | ---------------------------- | ---------- |
| 1   | Pilot script, its checks, the baseline on today's skills | [`phase-1.md`](./phase-1.md) | none |
| 2   | Engine: `composition` becomes `organism` | [`phase-2.md`](./phase-2.md) | 1 |
| 3   | Skills: split `01-system`, rename `02-journeys` | [`phase-3.md`](./phase-3.md) | 2 |
| 4   | Docs, pilot rerun against the baseline, gates | [`phase-4.md`](./phase-4.md) | 3 |

## External sources

| URL   | What it settled   |
| ----- | ----------------- |
| none | none |

## Impact

| Category | Verdict and evidence | Handled in |
| --- | --- | --- |
| regression | medium: `composition` sits in `model.cjs:14,24`, `records.cjs:32`, the fixture (`project.js:189,339`), `records.test.js:191,772,773,799`, `validate.test.js:372-397` (an edit to `kind: composition` provoking R6, which would silently test R2 once renamed), `skill.test.js:41`; `skill.test.js` pins `01-system`, `02-journeys` and the manifest list (222-223); the existing suite and the phase 1 baseline are the safety net | 1, 2, 3 |
| architecture | one skill per record kind: `brand` to `02-brand`; `system`, tokens, context files to `03-foundations`; components and assets to `04-components`; journeys and wireframes stay in `01-journeys`. Skills relay by files: foundations stops without `brand.md`, components without `system.md` | 3 |
| runtime | `claude -p --model haiku --plugin-dir --setting-sources local` with `Bash(node:*)` observed in the earlier pilot runs: the skills loaded and called the engine; `--no-session-persistence` (flag listed by `claude --help`, its effect unverified until the first run); sources copied by `git -C <src> archive HEAD`, which writes nothing in them; earlier pilot copies were git repositories and a run added nothing outside `aidd_docs/ui/` and `.git/` (observed on their trees) | 1, 4 |
| documentation | plugin README (start, diagram), `docs/CATALOG.md` aidd-ui table (hand-written, already stale: lists `01-system` alone), global spec tree and records lines (`2026_10_30_aidd-ui-rework/spec.md:25,47,58,68`); plugin `CATALOG.md` and README counts regenerate on commit | 4 |

## Rules

| Rule | Why it applies |
| --- | --- |
| test first, each guard with the mutation that turns its own test red | the rename, the pilot checks and the structure tests are guards |
| no code for an input never observed | the pilot excludes only what a run was seen to add; anything else is a limit |
| a skill never names another skill nor links outside its folder | foundations and components stop by naming the missing file, not its author |
| lean router format | each new skill: `SKILL.md` with the mermaid flow of its actions, one action per file, short transversal rules |
| no dates, ticket or run IDs, no machine path in tracked text | `check-no-local-paths.js` runs on commit: the pilot takes its sources as arguments |
| scripts suite always wrapped | `node scripts/check-tests-leave-git-alone.js -- node --test 'scripts/__tests__/**/*.test.js'` |
| after every CLI test of an AI agent, delete the chat | the pilot runs `claude -p` |

## Decisions

| Decision | Why |
| --- | --- |
| The pilot lives in `scripts/aidd-ui-pilot.cjs`, its pure checks exported and tested in `scripts/__tests__/aidd-ui/pilot.test.js`; nothing calls it from lefthook or CI | `scripts/` holds the repository's runnable checks, `check-claude-tokens-end-to-end.cjs` being the manual precedent; a plugin holds no test |
| A pilot's result is the `validate` verdict (`VALID` or its sorted rule ids), each journey step naming a wireframe, and code untouched; 4a is done when each pilot's result equals its baseline | the real-code pilots were never observed reaching `VALID`, `01-system` leaving code errors (C4, C6, C10) by design |
| The chain's requests are split once into journeys, brand, foundations and components parts; the baseline sends the last three joined to `01-system`, the restructured chain one per skill | the same words reach the model before and after, so a difference is the restructuration's |
| `02-brand` writes `brand.md` only when absent; an existing one stops it | `01-system` never changed a brand; evolving it comes with the variants |
| The "brand and tokens first" line of `cases.md` and its test are deleted, not ported | the amended contract: the order reads in the numbering |
