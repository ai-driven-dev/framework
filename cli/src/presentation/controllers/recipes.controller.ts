import { join, resolve } from "node:path";
import type { Command } from "commander";
import type { ValidateRecipes } from "../../contexts/recipes/application/validate-recipes.use-case.js";
import { recipeValidationReport } from "../presenters/recipes.presenter.js";
import { type ContainerFactory, parseGlobalOptions } from "./menu/global-options.controller.js";

/** What this command reads of the container. */
export interface RecipesContainer {
  recipes: { validateRecipes: Pick<ValidateRecipes, "execute"> };
}

export function registerRecipesCommand(
  toolConfig: Command,
  program: Command,
  containerOf: ContainerFactory<RecipesContainer>
): void {
  toolConfig
    .command("validate-recipes [paths...]")
    .description("Validate recipe structure, examples, and local links without changing files")
    .option("--all", "Include project recipes under aidd_docs/recipes", false)
    .option("--bundled <directory>", "Include recipes from this skill asset directory")
    .action(async (paths: string[], options: { all: boolean; bundled?: string }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const container = await containerOf(projectRoot, { verbose }, output);
      const directories = [];
      if (options.all)
        directories.push({ path: join(projectRoot, "aidd_docs", "recipes"), optional: true });
      if (options.bundled)
        directories.push({ path: resolve(projectRoot, options.bundled), optional: false });
      const result = container.recipes.validateRecipes.execute({
        files: paths.map((file) => resolve(projectRoot, file)),
        directories,
      });
      output.success(recipeValidationReport(result, projectRoot));
    });
}
