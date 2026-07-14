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

- Every written file sits flat in `aidd_docs/memory/`, none under a subfolder.
- Every core destination in the table exists.
- No fact is defined in two files.
- A file on an older template shape is reported, never rewritten to the new one.
- A section left out because the project has nothing for it is not reported.
- The review ran, and its report names its reviewers.
