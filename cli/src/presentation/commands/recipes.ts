import { join, resolve } from "node:path";
import type { Command } from "commander";
import type { DepsSliceFactory } from "../../orchestration/deps.js";
import { renderRecipeValidation } from "../display/tool-config-display.js";
import { failCommand } from "../errors/error-translator.js";
import { parseGlobalOptions } from "./global-options.js";

/** What this command reads of the graph. */
export type RecipesKeys = "validateRecipes";

export function registerRecipesCommand(
  toolConfig: Command,
  program: Command,
  createDeps: DepsSliceFactory<RecipesKeys>
): void {
  toolConfig
    .command("validate-recipes [paths...]")
    .description("Validate recipe structure, examples, and local links without changing files")
    .option("--all", "Include project recipes under aidd_docs/recipes", false)
    .option("--bundled <directory>", "Include recipes from this skill asset directory")
    .action(async (paths: string[], options: { all: boolean; bundled?: string }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      try {
        const deps = await createDeps(projectRoot, { verbose }, output);
        const directories = [];
        if (options.all)
          directories.push({ path: join(projectRoot, "aidd_docs", "recipes"), optional: true });
        if (options.bundled)
          directories.push({ path: resolve(projectRoot, options.bundled), optional: false });
        const result = deps.validateRecipes.execute({
          files: paths.map((file) => resolve(projectRoot, file)),
          directories,
        });
        const report = renderRecipeValidation(result, projectRoot);
        if (result.findings.length === 0) output.success(report);
        else {
          output.error(`\n${report}`);
          process.exitCode = 1;
        }
      } catch (error) {
        failCommand(output, error);
      }
    });
}
