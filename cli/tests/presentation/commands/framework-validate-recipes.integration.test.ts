import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestEnv } from "../../e2e/helpers.js";
import { runInProcess } from "../../helpers/in-process-cli.js";
import { RECIPE } from "../../helpers/recipe-fixture.js";

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
