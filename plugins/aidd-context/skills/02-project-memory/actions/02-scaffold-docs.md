# 02 - Scaffold docs

Create the `aidd_docs/` structure: root docs, empty memory subdirectories, and the project recipe directory.

## Input

The project root.

## Output

`aidd_docs/` with `README.md`, `GUIDELINES.md`, `CONTRIBUTING.md`, `memory/README.md`, `memory/{internal,external}/.gitkeep`, and `recipes/.gitkeep`.

## Process

1. **Docs.** Write each of `README.md`, `GUIDELINES.md`, `CONTRIBUTING.md` from its `@../assets/` template if absent, else update in place preserving the user's edits.
2. **Memory dirs.** Ensure `aidd_docs/memory/internal/` and `aidd_docs/memory/external/` exist, each with a `.gitkeep`.
3. **Recipe dir.** Ensure `aidd_docs/recipes/` exists with a `.gitkeep`; recipe files created by cook live there.
4. **Memory readme.** Write `aidd_docs/memory/README.md` from `@../assets/templates/memory/README.md` if absent; leave an existing one.

## Test

- `aidd_docs/` holds the three docs, `memory/README.md`, both memory subdirectories with their `.gitkeep`, and `recipes/.gitkeep`.
