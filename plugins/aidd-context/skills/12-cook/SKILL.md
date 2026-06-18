---
name: 12-cook
description: Manage the project's recipes/ how-to sheets: list them as a table, create or update one from the canonical template, research modern alternatives for a recipe, or apply a recipe to the project. Use for "list recipes", "new recipe", "update a recipe", "cook a recipe", "research a recipe", "modernize a recipe", "apply a recipe", "run a recipe".
---

# Cook

Maintains the project's `recipes/` how-to sheets, the short runbooks that live at the project root.

## Actions

| #   | Action     | Role                                                         | Input                 |
| --- | ---------- | ----------------------------------------------------------- | --------------------- |
| 01  | `list`     | List every recipe as a table                                | none                  |
| 02  | `upsert`   | Create or update one recipe from the template               | recipe topic + fields |
| 03  | `research` | Survey modern alternatives, gaps, and counter-intuitive wins | recipe or topic      |
| 04  | `apply`    | Execute a recipe on the project as a confirmed todo list    | recipe                |

Run `list` to survey recipes, `research` to gather insights, `upsert` to author one, `apply` to run an existing one against the project. Always run `research` before authoring or substantially updating a recipe — never draft from memory alone. Run `list` first when the user names no recipe.

## References

- `references/research-playbook.md`: the scouting angles and per-candidate criteria `research` applies (freshness, community signal, tips).

## Assets

- `assets/recipe-template.md`: the canonical recipe scaffold `upsert` renders from, and the shape `list` parses. Its header comment carries the field rules.
- `assets/refine-goal-checklist.md`: the checklist `research` fills with the user to define the target recipe.
- `assets/research-checklist.md`: the done-when gate `research` clears before drafting.
