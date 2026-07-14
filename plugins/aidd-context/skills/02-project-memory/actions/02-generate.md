# 02 - Generate

Write the memory the project deserves, then have it reviewed.

## Input

The confirmed capabilities from `01-scan`.

## Output

The memory bank, flat in `aidd_docs/memory/`, reviewed.

## Process

1. **Scaffold.** Create `aidd_docs/` from `@../assets/`, keeping any edit the user already made.
   - `README.md`, `GUIDELINES.md`, `CONTRIBUTING.md`, and `memory/README.md`.
   - `memory/internal/` and `memory/external/`, each with a `.gitkeep`.
2. **Select.** Take the `core` rows of `@../references/memory-destinations.md`, plus the rows of each confirmed capability.
3. **Fill.** For each selected row, read the template and write its destination, against `@../references/memory-rules.md`.
   - The destination is the one the table names. Never derive a path.
   - Strip the guidance comment.
4. **Update.** On an existing memory bank, refresh a file from current reality and keep the user's edits.
   - A concern whose capability is gone stays, flagged. Never delete it.
   - A section the template has and the file lacks: report it when the project has something to put there, stay quiet otherwise. Never inject it.
5. **Review.** Run `@../references/review-protocol.md`. Apply the confirmed fixes.
6. **Report.** Say what was written, what was flagged, and whether the review had independent reviewers.

## Test

- `find aidd_docs/memory -mindepth 2 -name '*.md'` lists nothing outside `internal/` and `external/`.
- Every `core` destination in the table exists at that exact path.
- No `TODO` and no `<placeholder>` survives in a written file.
- The report names one reviewer per file, and each section it flagged as missing is still missing.
