# recipes

What makes a recipe sheet valid: its structure, examples and local links. Language: `src/contexts/recipes/glossary.md`.

## Ports

- `RecipeFiles`: reads one recipe and lists a directory's recipes. Its contract kit runs on the in-memory fake and the disk adapter.
- No `contract/`: presentation reads `ValidateRecipes` and `ValidateRecipesResult` from `application/validate-recipes.use-case.ts`.

## Suppliers

- `shared/domain/shared.error.ts` (`InputRequiredError`). Nothing else.

## Never

- Read the disk in `application/` or `domain/`: files arrive through `RecipeFiles`.
- Import another context.
- Change a finding's `fix` text or the report layout: the domain tests, `validate-recipes.use-case.unit.test.ts`, `tests/presentation/controllers/tools/tool-config-validate-recipes.integration.test.ts` and `tool-config.presenter.recipes.unit.test.ts` freeze them.
