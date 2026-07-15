<!-- Cited by list, upsert, research, and apply. Defines where recipes live and how name resolution works. -->

# Recipe locations

Recipes have two homes:

- **Project recipes**: `aidd_docs/recipes/<slug>.md`. These belong to the current project and are the default write target for `upsert`.
- **Bundled recipes**: `assets/recipes/<slug>.md` inside this skill. These ship with AIDD and are read-only during normal project use.

## Resolution

When a user names a recipe, resolve in this order:

1. Number from the latest `list` table in the current conversation.
2. Exact slug in `aidd_docs/recipes/`.
3. Exact slug in `assets/recipes/`.
4. Title or topic match across both homes, showing candidates when more than one match is plausible.

Numbers are display shortcuts only. They are scoped to the latest rendered `list` table and must not be stored in recipe files. If the user gives a number and no current numbered list is available, rerun `list` and ask the user to pick a number from the new table.

If a project recipe and a bundled recipe share a slug, the project recipe overrides the bundled one. List both homes, but mark the project copy as the active one.

## Writes

`upsert` writes to `aidd_docs/recipes/` by default.

Only write a bundled recipe when the user explicitly asks to change a bundled/framework recipe while working in the AIDD framework source. In that case, write to `plugins/aidd-context/skills/12-cook/assets/recipes/<slug>.md`.
