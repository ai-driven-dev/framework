# Plan

## Input

Exploration findings and any wireframes.

## Output

`plan.md` and `phase-<n>.md` files in the source's feature folder or `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<feature-slug>/`.

## Process

1. **Slice.** Prefer independent phases, each coherent, verifiable, and sized for one executor pass.
2. **Write.** Fill [plan-template.md](../assets/plan-template.md) and [phase-template.md](../assets/phase-template.md), covering the full projection without placeholders.
3. **Link.** For a new folder whose source reference names a backlog item, create `backlog-link.json`:

   ```json
   {"backlog": "<reference>", "written_at": "<UTC timestamp>", "written_by": "aidd-dev:01-plan"}
   ```

4. **Challenge.** Check source coverage, phase boundaries, acceptance criteria, and dependencies; revise gaps, using an available challenge capability when useful.
   - **Interactive.** Show paths and obtain approval.
   - **Autonomous.** Ask only for product decisions the source cannot resolve.
5. **Finish.** Emit the completion marker once the files are written and challenged.

   ```shell
   echo "aidd:step-end aidd-dev:01-plan"
   ```

## Rules

- **Dependencies.** Record earlier phase numbers in `Depends on` for required outputs, conflicting file changes, or shared mutable validation resources; preserve ordering when independence is uncertain.
- **Link preservation.** Never overwrite an existing backlog link; `backlog` holds one forge reference or project-relative Markdown path, never both or inferred from raw text.
- **Lifecycle.** Follow [plan-status.md](../references/plan-status.md).
