import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { ValidateRecipes } from "../../../../src/contexts/recipes/application/validate-recipes.use-case.js";
import { RecipeFilesAdapter } from "../../../../src/contexts/recipes/infrastructure/recipe-files-adapter.js";
import { REPOSITORY_ROOT } from "../../../shared/testing/repository-root.builder.js";

const bundled = path.join(
  REPOSITORY_ROOT,
  "plugins",
  "aidd-context",
  "skills",
  "12-cook",
  "assets",
  "recipes"
);
const planted = fs.mkdtempSync(path.join(os.tmpdir(), "aidd-bundled-recipes-"));

afterAll(() => {
  fs.rmSync(planted, { recursive: true, force: true });
});

function validate(directory: string) {
  return new ValidateRecipes(new RecipeFilesAdapter()).execute({
    files: [],
    directories: [{ path: directory, optional: false }],
  });
}

describe("when the recipes the cook skill ships are validated", () => {
  it("every one of them holds the recipe rules", () => {
    const result = validate(bundled);
    expect(result.fileCount).toBeGreaterThan(0);
    expect(result.findings).toEqual([]);
  });

  it("a recipe whose link points nowhere is reported, so the check can fail", () => {
    fs.copyFileSync(path.join(bundled, "token-optimization.md"), path.join(planted, "recipe.md"));
    fs.appendFileSync(path.join(planted, "recipe.md"), "\nSee [missing](missing.md).\n");
    expect(validate(planted).findings.map(({ rule }) => rule)).toContain("link-target");
  });
});
