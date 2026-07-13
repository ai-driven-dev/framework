---
status: pending
---

<!-- Fill or omit these sections; never add, rename, or reorder one. -->

# Instruction: Generate with forced paths

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
plugins/aidd-context/skills/02-project-memory/
├── actions/
│   └── 02-generate.md                    ✅ scaffold aidd_docs/, fill memory to forced flat paths, review
└── references/
    ├── memory-destinations.md            ✅ template path -> exact flat output path
    └── review-protocol.md                ✅ independent checker fan-out, fresh-context degrade
```

## Tasks to do

### `1)` Write actions/02-generate.md

> One action: scaffold, fill, review. Small file, each step one line pointing at a ref.

1. Scaffold: create `aidd_docs/` with its three docs and `memory/{internal,external}` from `@../assets/`, preserving user edits.
2. Select: take `core/` plus each confirmed capability's folder from scan.
3. Fill: for each template, write to its forced path in `references/memory-destinations.md`, capturing the macro and non-derivable facts, never repeating a fact, pointing to code over a copy.
4. Enforce: every core file lands flat in `aidd_docs/memory/`, never under `core/`, `internal/`, or any subfolder.
5. Review: run `references/review-protocol.md`, apply confirmed fixes.
6. Output: the memory bank, flat, plus the review report.

### `2)` Write references/memory-destinations.md

> The table that kills the nesting bug. Data, not inference.

1. One row per template: source `templates/memory/<folder>/<file>.md`, destination `aidd_docs/memory/<file>.md`.
2. State the invariant: the template folder is a capability gate only, never part of the output path.
3. State that `internal/` and `external/` hold user notes, never a generated core file.

### `3)` Write references/review-protocol.md

> Independent review that works, with a stated fallback.

1. Fan out one `aidd-dev:checker` subagent per memory file (or per small group), each verifying cross-file consistency, duplication, and accuracy against the code.
2. Collect findings, apply the safe confirmed fixes, flag the rest for a human.
3. Degrade: where the host cannot spawn subagents, run a single fresh-context review pass over all files, and say so in the report.

## Test acceptance criteria

<!-- Each criterion is an observable behavior, not a command. -->

| Task | Acceptance criteria                                                                        |
| ---- | ------------------------------------------------------------------------------------------ |
| 1    | generate scaffolds the docs, fills the selected templates, and ends with a review, in one action file. |
| 2    | memory-destinations.md maps every template to a flat `aidd_docs/memory/<file>.md` path with no subfolder. |
| 3    | review-protocol.md fans out to independent checkers and names the fresh-context fallback.   |
| 4    | A generate run writes every core file flat, none under `core/` or `internal/`.              |
