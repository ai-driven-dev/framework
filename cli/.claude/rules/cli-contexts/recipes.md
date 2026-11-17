---
description: Apply when recipe sheets are checked for structure, examples and local links. The recipes context owns the rules, and nothing else reads a recipe.
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
- The context has no `contract/`: nothing outside it imports its types.

## Suppliers

- `shared/domain/errors.ts`: `InputRequiredError`.
- Nothing else: the disk is reached through its own port.

## Never

- Read the disk in `application/` or `domain/`: files arrive through `RecipeFiles`.
- Import another context: recipes knows none.
- Change a finding's `fix` text or the report layout.
- The domain tests, `validate-recipes.unit.test.ts` and `tests/e2e/validate-recipes.e2e.test.ts` freeze the findings.
- The display test freezes the table, and the goldens hold help text only.
- Name an exception or a settled ambiguity here: they live in `reference-context.md`.
