# 04 - Plan

Turn the explored source into a plan and its phases, save them, then review the whole before handoff. Never code.

## Input

The explore output from `02-explore` (projection, rules, feasibility, risks), plus any confirmed wireframe from `03-wireframe`.

## Output

A feature folder, always at `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<feature-slug>/`, holding `plan.md` from [plan-template.md](../assets/plan-template.md) and one `phase-<n>.md` per phase from [phase-template.md](../assets/phase-template.md).

## Process

1. **Phases.** Break the work into phases, each a coherent unit of work that ships and verifies on its own, sized for one executor pass. Let the work decide how many.
   - Prefer independent phases without splitting inseparable work.
   - Identify prerequisites from each phase's file projection, shared contracts, and validation resources.
   - Order phases that need another phase's output or would interfere through shared file changes or mutable validation resources.
   - Preserve ordering when independence cannot be established.
2. **Folder.** Reuse the feature folder the source already lives in, or create one. When creating one and `01-gather`'s own source reference names a backlog item — a ticket id or URL, or a file path naming its Markdown artefact, never raw text — with no `backlog-link.json` there yet, declare it the same way the skill that writes a spec does:

   ```json
   {
     "backlog": "owner/repo#123",
     "written_at": "2026-08-21T09:00:00Z",
     "written_by": "aidd-dev:01-plan"
   }
   ```

   `backlog` is the one field, on whatever support the item lives - a forge reference or a project-relative Markdown path, never both. When the source names none, write nothing. When `backlog-link.json` already exists, leave it untouched - it is correctable by hand, and a later run must never overwrite a correction.
3. **Fill.** Fill the plan and each phase from their templates, following the inline contracts, and record prerequisites in the phase table.
   - Slice the projection across the phases.
4. **Show.** Display the written paths.
5. **Review.** Check the declared dependencies against the phase scopes, then score the complete plan and its phases from 0 to 10, with ✓ reasons and ✗ risks.
   - In interactive mode, show them and revise until approved.
   - Under an autonomous orchestrator, revise against the source without waiting for approval; ask only when a product decision cannot be resolved from the source.
   - Never write the score to the plan.

## Test

| Case | Pass |
| --- | --- |
| The plan is written | The feature folder holds `plan.md` and one `phase-<n>.md` per phase. |
| Written files are read back | Each satisfies its template's inline contract with no `{...}` placeholder left. |
| Phase projections are combined | They cover the modify, create, and delete lists. |
| Dependencies are reviewed | Every prerequisite names an existing earlier phase; no phase depends on itself. |
| Phases share a required output, conflicting file changes, or mutable validation resources | Their ordering is recorded in the phase table. |
| Phase independence is uncertain | The plan preserves ordering. |
| The plan is scored | A confidence score was reported and written to no file. |
| The run is autonomous | It waits only for a product decision that the source cannot resolve. |
| A new folder's source names a ticket | `backlog-link.json` names it; reusing a folder never overwrites an existing link. |
