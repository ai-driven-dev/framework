# Recipes glossary

The language of the `recipes` context. A name in the code means what this page says.

| Term | Meaning | In the code |
| --- | --- | --- |
| Recipe | A markdown how-to sheet: a title, sections, numbered steps and examples | `inspectRecipe`, `RecipeInspection` |
| Finding | One broken rule, with the file, the line and the message that names it | `RecipeFinding` |
| Rule | What a recipe must hold: structure, step shape, example fences, links | `recipe-rules.ts` |
| Step | A numbered line of a recipe's procedure | `RecipeStep`, `checkSteps` |
| Anchor | The slug a heading gives for a link to land on | `headingAnchors`, `normalizedAnchor` |
| Local link | A link to another file or heading of the repository, the only kind checked | `recipeLinks`, `splitTarget` |
| Fence | A fenced code block, whose content no rule reads as prose | `scanFences`, `Fence` |
| Directory | A folder of recipes, required or optional, listed one level deep | `RecipeDirectory` |
| Bundled directory | The recipe folder a skill ships, passed with `--bundled` | the `--bundled` option |
| Validation | Reading each requested recipe and answering every finding, without writing anything | `ValidateRecipes`, `ValidateRecipesResult` |
