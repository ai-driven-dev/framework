---
objective: "One command checks all framework content through contracts and refreshes generated docs; tests only test code."
status: pending
---

# Plan: Framework checks unified behind contracts

Source: [`spec.md`](./spec.md) (#1149 rest, #1165)

## Phases

| # | Phase | PR | Gate |
| - | ----- | -- | ---- |
| 1 | Move to `scripts/check/`, `targets` in each contract, `baseline.json`, delete `validate.config.json`; no behavior change | #1149 | `run.cjs` exit 0, same baseline entry count, suite green |
| 2 | `run.cjs <files>` scoped to their artifacts, staleness scoped too; `--fix` runs generators | #1149 | staged run clean exits 0, new finding exits 1; tests |
| 3 | Rules replacing tests: SKILL name/description required, name = folder, no sibling plugin address, links stay inside the skill, SKILL-17 skips assets; HOOKS statusMessage; PLAN sections read by implement; REPORT contract; REPO severity scale, release coverage, SDLC demo | #1149 | per rule: silent today, one mutation exits 1 with its id, then the test is deleted |
| 4 | DOC and REPO contracts take the content scripts: links, referenced paths, local paths, context imports and form, mermaid names, duplication, JSON with embedded schemas | #1149 | each script's findings on today's tree equal its rule's; script stays wired until #1165 |
| 5 | Generators under `scripts/check/generators/`: catalogs, README counts merged into the README grid; COMPATIBILITY block split out as CLI-coupled | #1149 | `--fix` output equals today's generated files; stale file is a finding without `--fix` |
| 6 | lefthook and CI on `run.cjs`; old scripts, entries and replaced tests deleted; recipe check limited to recipe files; argument-hint check and agent branch deleted | #1165 (stacked) | pre-commit and CI green; spec done-when all true |

## Decisions

| Decision | Why |
| -------- | --- |
| Repo-wide rules use `unit: "file"` on an anchor file plus a custom check | `walk()` has no ignore list; no new unit kind |
| A script whose rule does not fit a contract stays a script, listed in the spec | no forced port |
| Old scripts stay wired through #1149 | no check disappears between the two PRs |
| Rule `fix` texts are not edited during the move | the baseline keys on them |
| YAML, COMPATIBILITY, recipes stay outside `run.cjs` | dependency or CLI coupling |
