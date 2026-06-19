---
name: 12-cook
description: Manage the project's recipes/ how-to sheets: list them as a table, or create and update one from the canonical template. Use for "list recipes", "new recipe", "update a recipe", "cook a recipe".
argument-hint: list | upsert
---

# Cook

Maintains the project's `recipes/` how-to sheets, the short runbooks that live at the project root.

## Actions

| #   | Action   | Role                                          | Input                 |
| --- | -------- | --------------------------------------------- | --------------------- |
| 01  | `list`   | List every recipe as a table                  | none                  |
| 02  | `upsert` | Create or update one recipe from the template | recipe topic + fields |

Run `list` to survey recipes, `upsert` to author one. Run `list` first when the user wants to update a recipe but hasn't named which.

## Assets

- `assets/recipe-template.md`: the canonical recipe scaffold `upsert` renders from, and the shape `list` parses. Its header comment carries the field rules.
