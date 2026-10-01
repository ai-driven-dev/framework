# 02 - Upsert recipe

Create or update one project recipe at `aidd_docs/recipes/<slug>.md`, scaffolded from the recipe template and following the recipe contract.

## Input

The recipe topic and any verified results from `research`.

## Output

The recipe file at `aidd_docs/recipes/<slug>.md`, filled from the template.

## Process

1. **Research.** For a new recipe or any substantial update, draft only from verified `research` (03) results, running it on the topic when those results are not already available, never drafting from memory.
2. **Slug.** Derive a kebab-case `<slug>` from the topic.
3. **Resolve.** Resolve existing recipes with [recipe-locations.md](../references/recipe-locations.md).
   - The project recipe exists: update `aidd_docs/recipes/<slug>.md` in place.
   - Only a bundled recipe exists: ask whether to copy it into `aidd_docs/recipes/<slug>.md` or edit the bundled one. Edit a bundled recipe only when the user asks for that framework-source change.
4. **Ask.** Ask only for a missing decision that changes the recipe's outcome or scope.
5. **Dedup.** For a new recipe, run `list` and rate each near match in an overlap table `| Existing recipe | Source | Shared scope | Overlap |`, where `Overlap` is none, partial, or high.
   - On any `high`, recommend updating that recipe instead and ask update-or-create before scaffolding.
6. **Scaffold.** Use [recipe-template.md](../assets/recipe-template.md) when needed and apply [recipe-contract.md](../references/recipe-contract.md), preserving verified useful content on updates.
7. **Fill.** Fill every placeholder. Never maintain a separate recipe index; `list` reads the files directly.
8. **Validate.** Run `validate` (05) after the write.
   - On findings, return to Scaffold and Fill to repair the recipe, then rerun both checks until they pass; reuse verified research rather than restarting it for repairs.

## Test

| Case | Pass |
| --- | --- |
| New or substantially updated recipe | The draft uses verified research results rather than memory |
| Project recipe written | `aidd_docs/recipes/<slug>.md` exists and passes the recipe contract |
| Validation after writing | Both checks pass and no finding is silently waived |
| Bundled recipe selected | It is overwritten only on an explicit bundled/framework change request |
| High overlap with an existing recipe | An update-or-create prompt precedes scaffolding |
