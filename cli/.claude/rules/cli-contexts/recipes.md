---
description: Apply when recipe sheets are checked for structure, examples and local links; the recipes context owns the rules, and nothing else reads a recipe.
paths:
  - "src/contexts/recipes/**/*.ts"
  - "src/composition/recipes.ts"
  - "tests/contexts/recipes/**/*.ts"
---

# Recipes

## Reason to change

- What makes a recipe sheet valid: its structure, its examples, its local links.
- Its language is `src/contexts/recipes/glossary.md`.
- Its shape follows `reference-context.md`, beside this page.

## Ports

- `RecipeFiles`: reads one recipe and lists the recipes of a directory.
- Its contract kit runs on the in-memory fake and on the disk adapter, so a test over the fake can be trusted.
- The context has no `contract/`: presentation reads `ValidateRecipes` and `ValidateRecipesResult` from `application/validate-recipes.use-case.ts`.

## Suppliers

- `shared/domain/shared.error.ts`: `InputRequiredError`.
- Nothing else: the disk is reached through its own port.

## Never

- Read the disk in `application/` or `domain/`: files arrive through `RecipeFiles`.
- Import another context: recipes knows none.
- Change a finding's `fix` text or the report layout: the domain tests, `validate-recipes.use-case.unit.test.ts` and `tests/presentation/controllers/tool-config-validate-recipes.integration.test.ts` freeze the findings, the display test freezes the table and the goldens hold help text only.
