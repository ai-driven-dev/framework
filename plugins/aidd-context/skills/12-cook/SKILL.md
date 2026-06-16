---
name: 12-cook
description: Manage the framework's recipe how-to sheets under recipes/ - list every recipe as a table, or create and update a recipe scaffolded from the canonical template. Use when the user says "list recipes", "show the recipes", "what recipes do we have", "new recipe", "add a recipe", "create a recipe", "write a recipe for X", "update the recipe", "edit a recipe", "cook a recipe", or invokes aidd-context:12-cook. Do NOT use to generate a context artifact like a skill, rule, agent, command, or hook (use the matching generator), or to read project memory.
---

# Cook

Maintains the repository's `recipes/` how-to sheets: lists them as a table, or creates and updates one from the canonical recipe template.

## Actions

| #   | Action   | Role                                            | Input               |
| --- | -------- | ----------------------------------------------- | ------------------- |
| 01  | `list`   | List every recipe as a title/goal/level table   | none                |
| 02  | `upsert` | Create or update one recipe from the template   | recipe topic + fields |

These actions are independent. The router runs `list` to survey recipes, or `upsert` to author one. Run `list` first when the user wants to update a recipe but has not named which.

## References

- `references/recipe-authoring.md`: the recipe contract (location, canonical shape, field rules, how to parse a recipe).

## Assets

- `assets/recipe-template.md`: the canonical recipe scaffold that `upsert` renders from.
