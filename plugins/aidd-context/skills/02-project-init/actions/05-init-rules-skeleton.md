# 05 — Init rules skeleton

Create the `rules/` directory skeleton with 10 empty numbered subdirectories following the SDLC phase taxonomy.

## Inputs

- `project_root` (required) — absolute path to project root (current working directory)

## Outputs

```
rules/
  00-architecture/
  01-standards/
  02-context/
  03-plan/
  04-code/
  05-review/
  06-tests/
  07-documentation/
  08-deploy/
  09-other/
```

## Process

1. Check if `rules/` exists. If it does, list existing subdirectories.
2. Create each of the 10 directories if absent. Skip existing ones without error.
3. Print a summary: directories created vs skipped.
4. Suggest next step: use `aidd-context:01:generate_rules` to populate rules in the appropriate category.

## Test

`find rules -maxdepth 1 -type d | wc -l` returns `11` (the `rules/` directory itself plus 10 subdirectories).
