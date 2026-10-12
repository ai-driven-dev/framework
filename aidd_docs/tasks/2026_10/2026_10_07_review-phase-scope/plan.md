---
objective: "A review appends one round per run and scores it over the whole plan, so three models produce one report."
status: implemented
---

# Plan: a review appends a round and scores the whole plan
## Overview
| Field | Value |
| --- | --- |
| **Goal** | `05-review` says what happens to a phase outside the diff, how the count is computed, and where a past round lives, so three models produce one report. |
| **Source** | [ai-driven-dev/framework#858](https://github.com/ai-driven-dev/framework/issues/858) |

## Phases
| # | Phase | File |
| --- | --- | --- |
| 1 | The round section and the phase scope | [`phase-1.md`](./phase-1.md) |
| 2 | The score and the statuses | [`phase-2.md`](./phase-2.md) |

## Resources
| Source | Verified |
| --- | --- |
| [#858](https://github.com/ai-driven-dev/framework/issues/858) | Three models, one diff, three reports: `100% (6/6)` on 7 blocks, `100% (6/6)` on 1 block, `53% (16/34)` where 16/34 is 47%. |

## Decisions
| Decision | Why |
| --- | --- |
| A round is a section, appended, and an earlier one is never read | the Check zone re-enters after every candidate, so rounds are the norm, and the artifact held one. Rewriting the report shows a state and never a progression, which is why nobody could read what a round had fixed. A section whose criterion text repeats from round to round makes the fix readable by eye, and makes copying easy: measured on a fixture whose round 1 claims `6/6 met` with citations on files the diff never touched, 9 runs out of 9 scored `1/6 met, 1 unmet, 4 out of the diff` and left round 1 untouched. |
| The score counts over the plan's whole total, in three numbers that sum to it | two fractions with different denominators cannot be read. `100% (4/4)` on a plan covered at a third was the defect, and one denominator removes it: `1/6 met, 1 unmet, 4 out of the diff`. |
| An unmet criterion stays in `Criteria`, a finding is keyed on a `file:line` | only the functional axis owns criteria; `01-review-code` and `03-review-relevancy` emit findings keyed on a changed `file:line`. Two line types, one key each, told apart by the first token, so no sub-section is needed. Measured: before the rule, 1 run of 3 wrote the same unmet criterion in both lists. |
| `review.md` records no model name | the only use found was comparing models, a framework-development need. `architecture.md` gives observation its own layer and `aidd-telemetry` already journals the tool by hook, verifiably. Measured: the field self-declared three different spellings of one model, and a false one under another. The human name comes from `git config user.name`. |
| The diff has one home, in `report-contract.md` | the three actions each resolved it, and "a git ref range, defaulting to the default branch" gave `main` while the work targets `next`: measured, a two-dot `git diff origin/next` showed 88 files against the change's 13, so two runs on one change traced two diffs. One reference row, `<base>...HEAD` plus the working tree, replaces five copies, and `01-prepare` resolves it once for the three axes. |
| Only a finding blocks, never a criterion | a `Criteria` line carries no severity, and the plan template gives a criterion none, so "an unchecked criterion the plan words as critical" was a signal no file holds: two models split `blocked` from `changes-requested` on one diff. An unchecked criterion already forces `changes-requested`, so nothing is lost. |
| The skill is written to `skill-authoring.md` | `04-skill-generate` carries the contract every generated skill satisfies, and 05-review broke R6, R8, R13 and R18: no flow, an `| # | Action | Axis |` table, three `## Test` lists, and `## References` and `## Assets` blocks. Reshaped, the five known fixtures reproduce their values to the word, so the format cost no behaviour. |
| The template owns the forms, the action owns the rules | `SKILL.md` already makes the template the rendering source. A rule naming `{{pct}}` couples a rule file to a rendering, and the guard refuses a placeholder inside a rule. |
| The guard lives in `scripts/__tests__/` | a plugin ships no tests of its own: `hooks/` copies recursively into user projects. The pre-commit `scripts-tests` job globs `{scripts,plugins,cli/src}/**`, so editing this skill runs the guard. |
| Every run is measured with `claude --plugin-dir "$PWD/plugins/aidd-dev"` | without it the Skill tool resolves `~/.claude/plugins/cache/aidd-framework/aidd-dev/2.6.0`, byte-identical to this branch until the first edit. Measured: the flag makes the skill answer `BASE=plugins/aidd-dev/skills/05-review`. |
