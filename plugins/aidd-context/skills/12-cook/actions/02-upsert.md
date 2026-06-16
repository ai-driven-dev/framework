# 02 - Upsert recipe

Create or update one recipe at `recipes/<slug>.md`, scaffolded from `@assets/recipe-template.md`.

## Input

The recipe topic. Ask for any missing field (level, time, prerequisites, steps, verify, related) before writing.

## Process

1. Derive a kebab-case `<slug>` from the topic → `recipes/<slug>.md`.
2. If it exists, update in place; else scaffold from the template.
3. Fill every placeholder, then add or refresh the recipe's row in `recipes/README.md`.

## Test

- `recipes/<slug>.md` exists and matches the template — every section present, no `<...>` placeholder left.
