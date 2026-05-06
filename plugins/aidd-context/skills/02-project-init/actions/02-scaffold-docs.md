# 02 — Scaffold docs

Create the `aidd_docs/` directory structure with root documentation files and empty memory subdirectories.

## Inputs

- `project_root` (required) — absolute path to project root (current working directory)

## Outputs

```
aidd_docs/
  README.md
  GUIDELINES.md
  memory/
    internal/
    external/
```

## Process

1. If `aidd_docs/README.md` is absent → write from `@assets/README.md`. If present → update it but take care to preserve any user customizations.
2. If `aidd_docs/GUIDELINES.md` is absent → write from `@assets/GUIDELINES.md`. If present → update it but take care to preserve any user customizations.
3. If `aidd_docs/memory/internal/` is absent → create it with a `.gitkeep` file.
4. If `aidd_docs/memory/external/` is absent → create it with a `.gitkeep` file.
5. Print a summary table: `path | action taken (created | skipped)`.

## Test

`test -f aidd_docs/README.md && test -f aidd_docs/GUIDELINES.md && test -d aidd_docs/memory/internal && test -d aidd_docs/memory/external && echo ok` prints `ok`.
