# 01 - List recipes

List project recipes and bundled recipes as one table.

## Output

A numbered table of project and bundled recipes, or `No recipes yet.`

```md
| # | Recipe | Source | Description |
| ---: | --- | --- | --- |
| <n> | [<title>](<path>) | project \| bundled | <description> |
```

## Process

1. **Read.** Read every recipe in both homes of [recipe-locations.md](../references/recipe-locations.md).
   - Exclude `README.md`.
2. **Title.** Pull the H1 title and the one-sentence description right below it.
3. **Shadow.** Mark matching-slug project rows active and their bundled twins shadowed.
4. **Number.** Sort by source then file name and assign contiguous numbers from 1 to N.
5. **Render.** Render one row per recipe file using the table above.
   - If both homes are absent or empty, return `No recipes yet.` without an error.

## Test

| Case | Pass |
| --- | --- |
| Project and bundled recipe files | Each file has one row with number, title, source, and description |
| Matching project and bundled slugs | The project copy is active and the bundled copy is shadowed |
| Numbered rows | Numbers are contiguous from 1 and follow source then file name order |
| Both homes absent or empty | `No recipes yet.` is returned without an error |
