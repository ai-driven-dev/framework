# 03 - Conclude

Produce the approved plan.

## Input

The explored source.

## Process

1. Split the work into phases, each shipping and verifying on its own, the first one a safety net when the findings say so.
2. Give each file to modify, create, or delete, and each impact, to the phase that owns it, losing none.
   - A phase that builds a screen layout (page, view, panel) draws its Wireframe per [wireframe conventions](../references/wireframe-conventions.md); other phases omit the section.
3. Write the feature folder in the project's `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<feature-slug>/`, or in the source's own folder:
   - `plan.md` from the [plan template](../assets/plan-template.md).
   - One `phase-<n>.md` per phase from the [phase template](../assets/phase-template.md).
4. From the project root, run the skill's `scripts/validate-plan.cjs` with node on the feature folder, and fix what it reports until it prints `VALID`.
5. Have a read-only subagent, independent of its author, check the plan against [plan-checks](../references/plan-checks.md), once.
6. Reply with only the folder path, the ✗ lines, and "Approve, correct, or explore more?".

## Output

The feature folder with `plan.md` and its phase files, then the ✗ lines.

## Rules

- Delete every comment.
