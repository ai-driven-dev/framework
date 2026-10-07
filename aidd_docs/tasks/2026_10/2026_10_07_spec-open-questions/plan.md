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
| The home is the template's open questions section, required, and named in no other file | it mirrors `prd-template.md`, and the issue names it |
| Each gap is listed there once, and nowhere else | a gap written in both its eventual section and the list is the same non-determinism with an extra copy |
| Every section other than the open questions one carries resolved content only | a hard constraint that is undecided contradicts the validator's own definition of that section, and a copy under an optional section is the second of the two placements the issue measured |
| One noun, defined once: a gap is an unresolved decision a required section depends on | the template said `unresolved decision`, the reference said `gap` and the actions said `missing required field`. Three units in one skill, and the broadest of them now blocks validation |
| What no required section depends on is not a gap, and neither is an implementation detail | it excludes over-asking without inventing a subjective category: `SKILL.md`'s `Hold intent, never implementation` and the validator's `contains_implementation_details` are boundaries a drafter already applies |
| A residual question invalidates the spec through `hard_thresholds`, and the section is checked by a criterion carrying no weight | the required weights already total 90 against a `pass_threshold` of 90, so a weighted addition would need the threshold retuned; a zero weight checks the section's shape and leaves the arithmetic alone |
| `tbd-marker.md` states the home; the two actions link to it and `SKILL.md` is untouched | one fact, one home: a rule written in three places drifts in two of them. The guard would not have caught it, since `check-doc-duplication.js` scans only `docs`, the two memory banks and the READMEs |
