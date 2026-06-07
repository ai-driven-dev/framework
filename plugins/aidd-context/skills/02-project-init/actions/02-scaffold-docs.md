# 02 - Scaffold docs

Create the `aidd_docs/` directory structure with root documentation files and empty memory subdirectories.

## Inputs

- `project_root` (required) - absolute path to project root (current working directory)

## Outputs

```
aidd_docs/
  README.md
  GUIDELINES.md
  CONTRIBUTING.md
  review-checklist.md
  memory/
    internal/.gitkeep
    external/.gitkeep
```

## Process

1. If `aidd_docs/README.md` is absent -> write from `@../assets/README.md`. If present -> update it but take care to preserve any user customizations.
2. If `aidd_docs/GUIDELINES.md` is absent -> write from `@../assets/GUIDELINES.md`. If present -> update it but take care to preserve any user customizations.
3. If `aidd_docs/CONTRIBUTING.md` is absent -> write from `@../assets/CONTRIBUTING.md`. If present -> update it but take care to preserve any user customizations.
4. If `aidd_docs/review-checklist.md` is absent -> write from `@../assets/review-checklist.md`. If present -> preserve any user customizations.
5. If `aidd_docs/memory/internal/` is absent -> create it. Always ensure `aidd_docs/memory/internal/.gitkeep` exists.
6. If `aidd_docs/memory/external/` is absent -> create it. Always ensure `aidd_docs/memory/external/.gitkeep` exists.
7. Print a summary table: `path | action taken (created | updated | skipped)`.

## Test

`test -f aidd_docs/README.md && test -f aidd_docs/GUIDELINES.md && test -f aidd_docs/CONTRIBUTING.md && test -f aidd_docs/review-checklist.md && test -f aidd_docs/memory/internal/.gitkeep && test -f aidd_docs/memory/external/.gitkeep && echo ok` prints `ok`.
