# 03 - Generate memory

Detect the project's capabilities, then fill the matching memory templates from the codebase.

## Input

The `aidd_docs/memory/` directory and the project root.

## Output

The `core/` memory files plus the folder of each detected capability, filled and written flat to `aidd_docs/memory/`.

## Process

1. **Gate.** Read one template (e.g. `@../assets/templates/memory/core/architecture.md`). If it cannot be read, stop: the templates are unreachable. Never invent content.
2. **Detect.** Find the project's capabilities (`@../references/capability-signals.md`). A capability holds when a concrete fact in the repo matches its definition, whether or not the fact is in the Evidence column. Never fire on an inferred domain. In a monorepo, scan every workspace, not the root manifest alone.
3. **Confirm.** Show each detected capability with the concrete evidence behind it and the templates it selects. Ask the user to confirm, add, or drop one. Block on the answer.
4. **Select.** Take every template in `core/`, plus every template in each confirmed capability's folder (`@../references/capability-signals.md`).
5. **Reconcile.** If `aidd_docs/memory/` already holds files:
   - A selected concern with an existing file: update it from current reality, preserving the user's edits.
   - A selected concern with no file: create it.
   - An existing file whose capability is no longer detected: leave it, flag it to the user, never delete.
6. **Fill.** For each selected template, in parallel:
   - Read its sections.
   - Capture the macro and non-derivable facts from the project, excluding AIDD's own scaffold. Prefer a pointer to the code over a copy.
   - Fill the sections. Drop a section with no content. Strip the guidance comment. Never copy a template verbatim, ask the user instead.
7. **Write.** One output per template, named by the template's basename, flat at `aidd_docs/memory/<basename>`. Never nest, never rename, never consolidate.
8. **Report.** A table: capability, concern, output file, status (created, updated, kept, or flagged).

## Test

- `aidd_docs/memory/` holds the core files plus one file per confirmed capability's concern, each named after a template.
