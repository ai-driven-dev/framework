# 01 - List recipes

Survey every recipe under `recipes/` and present them as a table of title, goal, and level.

## Output

A markdown table with one row per recipe (Title, Goal, Level, Path), or a clear "no recipes yet" message when the directory is absent or empty.

## Process

1. **Locate.** Look for the `recipes/` directory at the repository root.
   - If it is absent or holds no markdown file besides `README.md`, report that no recipes exist yet and stop.
2. **Collect.** List every `recipes/*.md` file, excluding `README.md` (the index).
3. **Parse.** For each file, extract the title, goal, and level per `references/recipe-authoring.md`.
   - If a file is missing the title, goal, or level, flag it as malformed in its row rather than dropping it.
4. **Render.** Emit one markdown table sorted by file name, with columns Title, Goal, Level, and the relative path.

## Test

- Run on a repo with at least one recipe and confirm the table has one row per `recipes/*.md` file (excluding `README.md`), each row carrying a non-empty title, goal, and level.
- Run on a repo with no `recipes/` directory and confirm the action reports "no recipes yet" instead of erroring.
