# 02 - Scaffold docs

Create the `aidd_docs/` structure with its root docs and empty memory subdirectories.

## Input

The project root.

## Output

`aidd_docs/` with `README.md`, `GUIDELINES.md`, `CONTRIBUTING.md`, `review-checklist.md`, `memory/README.md`, and `memory/{internal,external}/.gitkeep`.

## Process

1. **Docs.** For each of `README.md`, `GUIDELINES.md`, `CONTRIBUTING.md`, `review-checklist.md`: write it from the matching `@../assets/` template if absent, or update it in place while preserving the user's customizations.
2. **Memory dirs.** Ensure `aidd_docs/memory/internal/` and `aidd_docs/memory/external/` exist, each with a `.gitkeep`.
3. **Memory readme.** Write `aidd_docs/memory/README.md` from `@../assets/templates/memory/README.md` if absent, leaving an existing one untouched.
4. **Report.** Print a table: path, action taken (created, updated, or skipped).

## Test

- `aidd_docs/` holds the four docs, `memory/README.md`, and both memory subdirectories with their `.gitkeep`.
