# 02 - Upsert recipe

Create a new recipe or update an existing one, scaffolded from the canonical template.

## Input

The recipe topic. Optionally the level, time estimate, prerequisites, steps, verification checks, and related links. Gather any missing field from the user before writing.

## Output

One recipe file at `recipes/<slug>.md` conforming to the canonical shape, plus a row added or refreshed in `recipes/README.md`.

## Process

1. **Resolve slug.** Derive a kebab-case slug from the topic. Map it to `recipes/<slug>.md`.
2. **Detect mode.** Check whether `recipes/<slug>.md` already exists.
   - If it exists, this is an update: read it and preserve content the user does not change.
   - If not, this is a create: ensure `recipes/` exists, then scaffold from `@assets/recipe-template.md`.
3. **Fill fields.** Replace every placeholder with real content per `references/recipe-authoring.md`. Keep prose tight, one idea per sentence.
   - Validate Level is one of Beginner, Intermediate, Advanced.
   - Validate Time is prefixed with `~`.
4. **Write.** Save `recipes/<slug>.md`.
5. **Index.** Add or refresh the recipe's row in `recipes/README.md`.
   - If `recipes/README.md` is absent, create it with a heading and a table holding this recipe's row.
6. **Confirm.** Report the written path and whether it was a create or an update.

## Test

- Run upsert for a new topic and confirm `recipes/<slug>.md` exists, instantiates every template section (Goal, Level, Time, Prerequisites, Why, Steps, Verify, Related), and has no remaining `<...>` placeholder.
- Run upsert again for the same slug with a changed field and confirm the file is updated in place (not duplicated) and the `recipes/README.md` row reflects the change.
