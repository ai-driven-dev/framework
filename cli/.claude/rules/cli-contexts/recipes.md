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
- Its language is `src/contexts/recipes/glossary.md`; a name in the code means what that page says.
- Its shape is the strict reference: `reference-context.md`, beside this page.

## Ports

- `RecipeFiles`: reads one recipe and lists the recipes of a directory. Its contract kit runs on the in-memory fake and on the disk adapter, so a test over the fake can be trusted.

## Suppliers

- `kernel/`: `InputRequiredError` (migration state M3 of the reference).
- Nothing from `shared/` or another context: the context reads the disk through its own port.

## Never

- Read the disk in `application/` or `domain/`: the files arrive through `RecipeFiles`.
- Import `framework/`: recipes and framework do not know each other.
- Change a finding's message or the report layout: the goldens and the display test freeze them.
