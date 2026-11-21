import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestEnv } from "../../shared/testing/cli-sandbox.builder.js";
import { runInProcess } from "../../shared/testing/in-process-cli.builder.js";
import { RECIPE } from "../testing/recipe-fixture.builder.js";

let project: string;
let home: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  ({ projectDir: project, fakeHome: home, cleanup } = await createTestEnv("validate-recipes"));
});

afterEach(async () => {
  await cleanup();
});

const aidd = (args: string[]) => runInProcess(args, { cwd: project, home });

describe("framework validate-recipes with a bundled directory", () => {
  it("includes project and explicitly supplied bundled recipes", async () => {
    const directory = join(project, "aidd_docs", "recipes");
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "project.md"), RECIPE);
    const bundled = join(project, "bundled");
    await mkdir(bundled);
    await writeFile(join(bundled, "bundled.md"), RECIPE);

    const result = await aidd(["framework", "validate-recipes", "--all", "--bundled", bundled]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("PASS: 2 recipe(s) validated.\n");
    expect(result.stderr).toBe("");
  });

  it("does not treat a missing explicit bundled directory as an empty scope", async () => {
    const result = await aidd(["framework", "validate-recipes", "--bundled", "missing"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("ENOENT");
    expect(result.stdout).not.toContain("PASS");
  });
});

describe("framework validate-recipes on a recipe path", () => {
  it("validates a recipe without changing it", async () => {
    const file = join(project, "recipe.md");
    await writeFile(file, RECIPE);

    const result = await aidd(["framework", "validate-recipes", "recipe.md"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(await readFile(file, "utf8")).toBe(RECIPE);
  });

  it("reports invalid JSON with its file, line, rule and a non-zero exit, leaving the file as it was", async () => {
    const invalid = RECIPE.replace(
      "```bash\nnode --version",
      '```json\n{"enabled": true <!-- remove me -->}'
    );
    await writeFile(join(project, "recipe.md"), invalid);

    const result = await aidd(["framework", "validate-recipes", "recipe.md"]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("| recipe.md | 9 | json-syntax |");
    expect(await readFile(join(project, "recipe.md"), "utf8")).toBe(invalid);
  });

  it("requires a target instead of reporting an empty successful run", async () => {
    const result = await aidd(["framework", "validate-recipes"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Pass at least one recipe path");
    expect(result.stdout).not.toContain("PASS");
  });
});
