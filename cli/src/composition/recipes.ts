import { ValidateRecipes } from "../contexts/recipes/application/validate-recipes.js";
import { RecipeFilesAdapter } from "../contexts/recipes/infrastructure/recipe-files-adapter.js";

export interface RecipesDeps {
  validateRecipes: ValidateRecipes;
}

export function wireRecipes(): RecipesDeps {
  return { validateRecipes: new ValidateRecipes(new RecipeFilesAdapter()) };
}
