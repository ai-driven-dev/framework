import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { RecipeFilesAdapter } from "../../../../src/contexts/recipes/infrastructure/recipe-files-adapter.js";
import { InMemoryRecipeFiles } from "../testing/in-memory-recipe-files.js";
import { describeRecipeFilesContract } from "../testing/recipe-files-contract.js";

describeRecipeFilesContract("the in-memory files", async () => {
  const files = new InMemoryRecipeFiles();
  const root = "/recipes";
  return {
    files,
    root,
    put: async (relative, content) => void files.addFile(`${root}/${relative}`, content),
    makeDirectory: async (relative) => void files.addDirectory(`${root}/${relative}`),
    dispose: async () => undefined,
  };
});

describeRecipeFilesContract("RecipeFilesAdapter over a directory", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "aidd-recipe-files-")));
  return {
    files: new RecipeFilesAdapter(),
    root,
    put: async (relative, content) => {
      await mkdir(dirname(join(root, relative)), { recursive: true });
      await writeFile(join(root, relative), content);
    },
    makeDirectory: async (relative) =>
      void (await mkdir(join(root, relative), { recursive: true })),
    dispose: () => rm(root, { recursive: true, force: true }),
  };
});
