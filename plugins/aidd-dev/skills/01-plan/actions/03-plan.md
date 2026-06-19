# 03 - Plan

Turn the gathered source into a plan and its phases, save them, and confirm with the user. Never code.

## Input

The gathered source from `01-gather`, plus any confirmed wireframe from `02-wireframe`.

## Output

A feature folder `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<feature-slug>/` holding `plan.md` from `@../assets/plan-template.md` and one `phase-<n>.md` per phase from `@../assets/phase-template.md`.

## Process

1. **Explore, no sub-agent.** Read the codebase here. Produce the architecture projection (files to modify, create, delete, each with a one-line reason), the implicit assumptions, the feasibility checks against official docs (keep each URL and what it settled), and the project rules that apply.
2. **Gate: projection and rules.** Show the projection and the applicable rules. Ask "Correct? Anything to add or remove?" Iterate until approved.
3. **Gate: phases.** Break the work into 3 to 6 phases, each a coherent chunk that ships and verifies on its own, sized for one implementer pass. Show them. Iterate until approved.
4. **Write.** Resolve the feature folder: reuse the one the source already lives in when it sits under `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<feature-slug>/`, otherwise create one from the current date and a short logical feature slug. Scaffold from the templates and fill every placeholder: `plan.md`, one `phase-<n>.md` per phase (phase 1 is `phase-1.md`), the projection sliced into each phase. Embed any confirmed wireframe in its phase. Display the paths.
5. **Gate: confidence and confirm.** Score the plan 0 to 10 with ✓ reasons and ✗ risks, and report it. Below 9, revise and rescore. At 9 or above, show the plan and its phases, challenge them with the user, and wait for approval. The score gates display, never written to the plan.

## Test

- `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<feature-slug>/plan.md` exists with one `phase-<n>.md` per phase next to it.
- No `{...}` placeholder is left in any written file.
- The phase projection slices together cover the validated modify, create, and delete lists.
- A confidence score of at least 9 was reported and written to no file.
