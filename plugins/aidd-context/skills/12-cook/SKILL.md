---
name: 12-cook
description: Manage the project's recipes/ how-to sheets: list, create or update, research, or apply a recipe. Use for "recipe", "cook", "/cook", "list/new/update/research/apply a recipe".
argument-hint: list | upsert | research | apply
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
Before running an action, read its file in `actions/`, not only the table or assets.

## References

- `references/recipe-contract.md`: the rules every recipe file follows; `upsert` writes to it.
- `references/research-playbook.md`: the scouting angles and per-candidate criteria `research` applies (freshness, community signal, tips).

## Assets

- `assets/recipe-template.md`: the canonical recipe scaffold `upsert` renders from, and the shape `list` parses.
- `assets/refine-goal-checklist.md`: the checklist `research` fills with the user to define the target recipe.
- `assets/research-checklist.md`: the done-when gate `research` clears before drafting.
