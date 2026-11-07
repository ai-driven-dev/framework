---
objective: "A small model builds and updates the project's macro memory the way a person would: facts with sources, shown once before writing, an update that starts from what changed, and no line of a team's leaving without a yes."
status: pending
---

# Plan: Project memory, built like a person would build it

Source: [design.md](./design.md). Stacked on the branch `refactor/lean-project-memory-text`.

## Phases

| #   | Phase | File | Depends on |
| --- | ----- | ---- | ---------- |
| 1   | Each memory file is named by what it holds | [`phase-1.md`](./phase-1.md) | none |
| 2   | Facts go through one sheet before any write | [`phase-2.md`](./phase-2.md) | 1 |
| 3   | A fact comes from the file that defines it | [`phase-3.md`](./phase-3.md) | 2 |
| 4   | An update starts from what changed | [`phase-4.md`](./phase-4.md) | 2 |
| 5   | The brief carries the functional macro; rules keep the coding detail; the load is measured | [`phase-5.md`](./phase-5.md) | 2 |

## External sources

| URL | What it settled |
| --- | --------------- |
| none | none |

## Impact

| Category | Verdict and evidence | Handled in |
| -------- | -------------------- | ---------- |
| documentation | the skill text, templates and references of `plugins/aidd-context/skills/02-project-memory` change: names, fact sheet, reading order, brief sections | 1, 2, 3, 4, 5 |
| runtime | the engine `plugins/aidd-context/hooks/memory.cjs` gains the `facts` and `changes` commands, and `check` reports the words every session loads | 2, 4, 5 |
| regression | a team's content is never dropped; the existing `memory-*.test.js` suites in `scripts/__tests__` guard it | 1, 2, 3, 4, 5 |

## Rules

| Rule | Why it applies |
| ---- | -------------- |
| One commit per phase: its code, its tests and its phase file reaching `done` | each phase lands whole and can be reverted alone |
| Test first: each new test fails on the parent commit for the reason it names, then passes | a test that never failed proves nothing |
| Mutation: break what the test is named for and watch that test go red | a guard nothing fails for is not a guard |
| Gates: the full scripts suite, `pnpm exec lefthook run pre-commit --all-files`, and `check .` and `check cli` on this repository's banks | done means every gate green |
| Behaviour eval: on the real repositories of the lean slice's measurement (two create repositories, one update repository with injected drifts); a synthetic fixture only for a narrow case, its every memory claim checked true against its own code before any run. Haiku, three runs per case; Qwen on the deterministic numbers | the skill is judged on what a small model writes |
| Words: the commit message states the skill's word delta | the load every session pays is the cost of the skill |
| Team content: no phase may delete, move or rewrite a line or a file the person did not approve | a team's content is the one loss that cannot be undone |
| Names by intention: the skill names a category of file, never a tool; tool names appear only in test fixtures | project convention, and the skill must work on any stack |
| Eval spend, phases 2 to 5: one or two cases, three Haiku runs each, plus Qwen where named, about 1 USD each | keeps the measurement inside budget |
| Merge gate: on the update repository and on a real project's own history (its bank at the bank's last commit, its code at a later commit), the Haiku and Qwen refreshes catch at least as many drifts as the skill on `origin/next` run the same day, six runs each, and change no team line without a yes. It runs once, in the final measurement before merge; a phase that misses it there is reverted and its design reopened | the fact sheet must not buy its safety with fewer catches; one skill ranges from zero to four of four drifts between runs, so three runs decide nothing |
| Eval spend, after phase 5: old against new, graded blind, create and update, Haiku and Qwen, about 5 to 6 USD | the final measurement decides what the plan delivered |

## Decisions

| Decision | Why |
| -------- | --- |
| The merged names go: `contract.md` becomes `api.md`, `cli.md` or `package.md` by what the project exposes; `native.md` becomes `mobile.md` or `desktop.md`; `async.md` becomes `messaging.md` or `realtime.md`; the data store goes back to `database.md`, apart from `data.md`, which keeps datasets, pipelines and models; `codebase-map.md` is written again on its own | on a host that loads memory as links, the file name alone decides whether a file is opened |
| `ui.md` keeps its name and always holds the macro; when `aidd_docs/ui/` exists it points there for the detail and the design system, and copies none of it | the detail and the design system belong to the UI plugin's own artifacts |
| Names a bank already holds from an older version (`design.md`, `forms.md`, `navigation.md`, `infra.md`, `integration.md`) are accepted for their capability, never offered a merge | a team's file is never moved or removed |
| Silence is consent, except for a removal | asking for an answer on every line costs the person more than it protects; a removal is the one change that loses a team's content |
| The engine computes an update's base; no fingerprint file | a small model improvises version-control commands badly; a fingerprint conflicts between branches and goes stale |
| A detailed coding convention goes to a rule, never to memory | rules are loaded by each tool on their own, scoped to the files they govern |
| From scratch, with no code, belongs to `01-bootstrap` | there is nothing to read |
| Deferred: read-only subagents per area, Kilo wiring | taken up only if the final measurement shows the need |
