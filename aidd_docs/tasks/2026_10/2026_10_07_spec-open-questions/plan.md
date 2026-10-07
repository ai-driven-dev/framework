---
objective: "Every gap a spec still carries is listed once under its own section, so two runs on the same feature place it identically."
status: implemented
---

# Plan: a spec declares its open questions
## Overview
| Field | Value |
| --- | --- |
| **Goal** | give the `TBD:` marker one deterministic home in a spec, and make a residual one invalidate the spec |
| **Source** | ai-driven-dev/framework#626 |

## Phases
| # | Phase | File |
| --- | --- | --- |
| 1 | the marker has a home | [`phase-1.md`](./phase-1.md) |

## Resources
| Source | Verified |
| --- | --- |
| `plugins/aidd-pm/skills/04-spec/references/tbd-marker.md` | the marker's only definition is its form, `TBD: <precise question>` — no home is stated anywhere |
| `plugins/aidd-pm/skills/04-spec/actions/01-build.md` | step 3 replaces "any missing required field" with the marker, which is what leaves placement to the drafting agent |
| `plugins/aidd-pm/skills/04-spec/actions/02-refine.md` | step 4 says the same for a field still unanswered |
| `plugins/aidd-pm/skills/04-spec/SKILL.md` | its transversal rule says to mark every gap and names no home, so it needs no change |
| `plugins/aidd-pm/skills/04-spec/assets/spec-validator.yml` | required criteria weigh 90 of 100, so a new weighted criterion would move `pass_threshold` |
| `cli/tests/golden/` | holds no copy of the spec template, so no snapshot is coupled to this change |

## Decisions
| Decision | Why |
| --- | --- |
| The home is `## Open Questions`, a required section of the template | it mirrors `prd-template.md`, and the issue names it |
| Each gap is listed there once, and nowhere else | a gap written in both its eventual section and the list is the same non-determinism with an extra copy |
| The template's required sections carry resolved content only | a hard constraint that is undecided contradicts the validator's own definition of that section |
| A residual question invalidates the spec through `hard_thresholds`, and the section is checked by a criterion carrying no weight | the required weights already total 90 against a `pass_threshold` of 90, so a weighted addition would need the threshold retuned; a zero weight checks the section's shape and leaves the arithmetic alone |
| `tbd-marker.md` states the home; the two actions link to it and `SKILL.md` is untouched | one fact, one home — and `check-doc-duplication.js` fails a sentence written in two documents |
