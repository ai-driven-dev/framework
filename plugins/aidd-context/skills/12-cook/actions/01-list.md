# 01 - List recipes

List every recipe under `recipes/` at the project root as a table, excluding `README.md`.

## Output

```md
| Recipe | Description |
| --- | --- |
| [<title>](recipes/<file>) | <description> |
```

One row per `recipes/*.md`, sorted by file name. If `recipes/` is absent or empty: `No recipes yet.`

## Process

1. Read each `recipes/*.md` except `README.md`.
2. Pull the H1 title and the one-sentence description right below it.
3. Render the table above.

## Test

- One row per recipe file, each with title and description.
- Absent/empty `recipes/` → `No recipes yet`, no error.
