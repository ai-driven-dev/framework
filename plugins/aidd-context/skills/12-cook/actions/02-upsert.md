# 02 - Upsert recipe

Create or update one recipe at `recipes/<slug>.md`, scaffolded from the recipe template and following the recipe contract:

```md
@assets/recipe-template.md
@references/recipe-contract.md
```

## Input

The recipe topic. Ask for any missing field (description, steps, verify, related) before writing.

## Process

1. **Research first.** For a new recipe or any substantial update, run `research` (03) on the topic and draft only from its verified results — never from memory.
2. Derive a kebab-case `<slug>` from the topic → `recipes/<slug>.md`.
3. If `recipes/<slug>.md` is new, run `list` and rate each near match in an overlap table `| Existing recipe | Shared scope | Overlap |`, where `Overlap` is none, partial, or high. On any `high`, recommend updating that recipe instead, and ask update-or-create before scaffolding.
4. If it exists, update in place; else scaffold from the template. Apply the contract to every section.
5. Fill every placeholder, then add or refresh the recipe's row in the `recipes/README.md` index. The index table is `| Recipe | Description |`: link the title to `<slug>.md` (relative) and copy the one-sentence description. Same columns `list` emits.

## Test

- A new or substantially-updated recipe is drafted from `research` results, not from memory.
- `recipes/<slug>.md` exists and follows the recipe contract: opens with a one-sentence description (no Goal label, no table), each step a `#### N)` emoji heading with a real example, no `<...>` placeholder left.
- A new recipe that highly overlaps an existing one triggers an update-or-create prompt before scaffolding.
