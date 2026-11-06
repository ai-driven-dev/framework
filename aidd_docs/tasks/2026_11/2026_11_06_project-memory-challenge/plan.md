---
objective: "A small model's memory uses file names a reader understands, keeps every line nobody approved removing, and reads the files that define a convention."
status: pending
---

# Plan: Project memory, after the independent challenge

Source: the independent challenge of the lean project-memory skill, reduced by the owner to what serves the goal. Stacked on the branch `refactor/lean-project-memory-text`.

## Rules for every phase

| Rule | How |
| --- | --- |
| One commit per phase | its code, its tests and its phase file reaching `done` |
| Test first | each new test fails on the parent commit for the reason it names, then passes |
| Mutation | break what the test is named for and watch that test go red |
| Gates | the full scripts suite, `pnpm exec lefthook run pre-commit --all-files`, and `check .` and `check cli` on this repository's banks |
| Behaviour eval | on the real repositories of the lean slice's measurement first (two setup repositories, one refresh repository with injected drifts); a synthetic fixture only for a narrow case, its every memory claim checked true against its own code before any run. Haiku, three runs per case; phase 2 also runs Qwen on the deterministic numbers |
| Words | the commit message states the skill's word delta |
| Team content | no phase may delete, move or rewrite a line or a file the person did not approve |
| Names by intention | the skill names a category of file, never a tool; tool names appear only in test fixtures |

## Phases

| # | Phase | Depends on |
| --- | --- | --- |
| 1 | Each memory file is named by what it holds | none |
| 2 | Nothing a person did not approve leaves the bank | 1 |
| 3 | The scan reads the files that define a convention | none |

## Decisions

| Decision | Why |
| --- | --- |
| The merged names go: `contract.md` becomes `api.md`, `cli.md` or `package.md` by what the project exposes; `native.md` becomes `mobile.md` or `desktop.md`; `async.md` becomes `messaging.md` or `realtime.md`; the data store goes back to `database.md`, apart from `data.md`, which keeps datasets, pipelines and models as it did before the lean slice; `codebase-map.md` is written again on its own | on a host that loads memory as links, the file name alone decides whether a file is opened; a merged name told a reader nothing |
| `ui.md` keeps its name and always holds the macro: styling method, routing, accessibility bar, how to see a change. When `aidd_docs/ui/` exists it also points there for the detail and the design system, and copies none of it | the detail and the design system belong to the UI plugin's own artifacts |
| Names a bank already holds from an older version (`design.md`, `forms.md`, `navigation.md`, `infra.md`, `integration.md`) are accepted for their capability: kept, reviewed, written into, never offered a merge | merging them builds files over the 400-word limit, and a team's file is never moved or removed |
| The outside services `integration.md` used to hold belong to the ecosystem capability | one fact, one home |
| `contract.md`, `native.md` and `async.md` were never released, so no bank holds them and none is accepted | nothing to protect; `data.md` was released and keeps its meaning |
| Deferred: a rule that a cited command exists, the engine printing the structure and format blocks, file names by contract surface beyond the above, read-only subagents per area, Kilo wiring | each is taken up only if the final measurement shows the need |

## Eval spend

| Phase | Runs | Estimate |
| --- | --- | --- |
| 1, 2, 3 | one or two cases, three Haiku runs each; phase 2 plus three Qwen runs | about 1 USD |
| After phase 3 | blind graded setup and refresh on Haiku, and recall of old against new templates | about 5 to 6 USD |
