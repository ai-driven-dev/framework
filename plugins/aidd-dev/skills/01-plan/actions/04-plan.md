# 04 - Plan

Turn the explored source into a plan and its phases, save them, then review the whole until approved. Never code.

## Input

The explore output from `02-explore` (projection, rules, feasibility, risks), plus any confirmed wireframe from `03-wireframe`.

## Output

A feature folder `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<feature-slug>/` holding `plan.md` from `@../assets/plan-template.md` and one `phase-<n>.md` per phase from `@../assets/phase-template.md`.

## Process

1. **Phases.** Break the work into phases, each a coherent unit of work that ships and verifies on its own, sized for one executor pass. Let the work decide how many.
2. **Write.** Resolve the feature folder: reuse the one the source already lives in, otherwise create it. Scaffold from the templates and fill the placeholders. Fill only the sections the template defines, add nothing it does not, and omit any section that stays empty (for example resources when nothing was consulted). Slice the projection into each phase, put the resources consulted (docs or in-repo files) in the resources table, and embed any wireframe in its phase's Wireframe section. Display the paths.
3. **Review.** Show the complete plan and its phases with a confidence score (0 to 10, ✓ reasons and ✗ risks). Take feedback, revise the files, and re-show until approved. The score is never written to the plan.

## Test

- `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<feature-slug>/plan.md` exists with one `phase-<n>.md` per phase next to it.
- No `{...}` placeholder is left in any written file.
- The phase projection slices together cover the modify, create, and delete lists.
- A confidence score was reported and written to no file.
