# 02 - Upsert recipe

Create or update one recipe at `recipes/<slug>.md`, scaffolded from `@../assets/recipe-template.md`.

## Input

The recipe topic. Ask for any missing field (level, time, prerequisites, steps, verify, related) before writing.

## Output

The recipe file at `recipes/<slug>.md`, filled from the template, with its row added or refreshed in `recipes/README.md`.

## Process

1. Derive a kebab-case `<slug>` from the topic → `recipes/<slug>.md`.
2. If `recipes/<slug>.md` is new, run `list` and rate each near match in an overlap table `| Existing recipe | Shared scope | Overlap |`, where `Overlap` is none, partial, or high. On any `high`, recommend updating that recipe instead, and ask update-or-create before scaffolding.
3. If it exists, update in place; else scaffold from the template.
4. Fill every placeholder, then add or refresh the recipe's row in the `recipes/README.md` index. The index table is `| Recipe | Goal | Level |`: link the title to `<slug>.md` (relative), copy the `> **Goal:**` text, and copy the **Level**. Same columns `list` emits.

## Test

- `recipes/<slug>.md` exists and matches the template, every section present, no `<...>` placeholder left.
- `recipes/README.md` carries a row for `<slug>`: its title linked, plus the goal and level.
- A new recipe that highly overlaps an existing one triggers an update-or-create prompt before scaffolding.
