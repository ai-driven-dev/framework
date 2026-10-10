# 02 - Upsert recipe

Create or update one recipe from verified research.

## Input

The recipe topic and any verified results from `research`.

## Output

The recipe file at `aidd_docs/recipes/<slug>.md`, filled from the template.

## Process

1. **Evidence.** Use verified research results for a new recipe or any substantial update.
   - Never draft those changes from memory.
2. **Slug.** Derive a kebab-case `<slug>` from the topic.
3. **Resolve.** Resolve existing recipes with [recipe-locations.md](../references/recipe-locations.md).
   - The project recipe exists: update `aidd_docs/recipes/<slug>.md` in place.
   - If only a bundled recipe exists, ask whether to copy it into `aidd_docs/recipes/<slug>.md` or edit the bundled one.
   - Edit a bundled recipe only on an explicit framework-source change request.
4. **Ask.** Ask only for a missing decision that changes the recipe's outcome or scope.
5. **Dedup.** Compare a new recipe with each near match in the current recipe list using `| Existing recipe | Source | Shared scope | Overlap |`.
   - Compare before scaffolding.
   - Use none, partial, or high for `Overlap`.
   - On any `high`, recommend updating that recipe instead and ask update-or-create before scaffolding.
6. **Scaffold.** Use [recipe-template.md](../assets/recipe-template.md) when needed and apply [recipe-contract.md](../references/recipe-contract.md).
   - Preserve verified useful content on updates.
7. **Fill.** Fill every placeholder and save the recipe.
   - On validation findings, resume at Scaffold and Fill, reusing verified research until both checks pass.

## Test

| Case | Pass |
| --- | --- |
| New or substantially updated recipe | The draft uses verified research results rather than memory |
| Project recipe written | `aidd_docs/recipes/<slug>.md` exists and passes the recipe contract |
| Update or validation repair | Verified useful content and research results are preserved |
| Validation after writing | Both checks pass and no finding is silently waived |
| Bundled recipe selected | It is overwritten only on an explicit bundled/framework change request |
| High overlap with an existing recipe | An update-or-create prompt precedes scaffolding |
