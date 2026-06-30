# 03 - Generate memory

Detect the project's capabilities, then fill the matching memory templates from the codebase.

## Input

The `aidd_docs/memory/` directory and the project root.

## Output

The `core/` memory files plus each detected capability's folder, filled and written flat to `aidd_docs/memory/`.

## Process

1. **Detect.** Find the project's capabilities (`@../references/capability-signals.md`): a capability holds when a concrete repo fact matches its definition, never an inferred domain. In a monorepo, scan every workspace.
2. **Confirm.** Show each capability with its evidence and the templates it selects. Ask the user to confirm, add, or drop one. Block on the answer.
3. **Select.** Take `core/` plus each confirmed capability's folder. On an existing `aidd_docs/memory/`: update a concern from current reality (keep the user's edits), create a missing one, leave-but-flag one whose capability is gone (never delete).
4. **Fill.** For each template, knowing what earlier ones captured (never repeat a fact, point to its file): capture the macro, non-derivable facts (exclude AIDD's scaffold, point to code over a copy), fill its sections, drop an empty one, strip the guidance comment, never copy verbatim.
5. **Write.** One file per template, named by its basename, flat in `aidd_docs/memory/`. Never nest, rename, or consolidate.

## Test

- `aidd_docs/memory/` holds the core files plus one file per confirmed capability's concern, each named after a template.
