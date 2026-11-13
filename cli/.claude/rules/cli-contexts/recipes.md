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

- `RecipeFiles`: reads one recipe and lists the recipes of a directory. Its contract kit runs on the in-memory fake and on the disk adapter, so a test over the fake can be trusted. This departs from target 02 section 9 ("no contract test", for a context with no real external boundary): the application tests run over the fake, and only a contract run on both the fake and the adapter keeps that fake honest, as `reference-context.md` sections 5 and 7 require for a port.

## Suppliers

- `kernel/`: `InputRequiredError` (migration state M3 of the reference).
- Nothing from `shared/` or another context: the context reads the disk through its own port.

## Never

- Read the disk in `application/` or `domain/`: the files arrive through `RecipeFiles`.
- Import `framework/`: recipes and framework do not know each other.
- Change a finding's `fix` text or the report layout: the domain tests (`recipe-rules.unit.test.ts`, `recipe-rules-findings.unit.test.ts`), `validate-recipes.unit.test.ts` and the e2e `validate-recipes.e2e.test.ts` freeze the findings; the display test freezes the table. The goldens hold help text only.
