import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RECIPE } from "../presentation/testing/recipe-fixture.builder.js";
import { createTestEnv, FRAMEWORK_PATH, runCli } from "../shared/testing/cli-sandbox.builder.js";

const CURSOR_ONLY = ["--ai", "cursor", "--plugins", "none", "--yes"];

describe("framework through the built binary", () => {
  let test: Awaited<ReturnType<typeof createTestEnv>>;
  const run = (...args: string[]) => runCli(["framework", ...args], test.projectDir, test.fakeHome);

  beforeAll(async () => {
    test = await createTestEnv("framework");
    const setup = await runCli(
      ["setup", "--source", "local", "--path", FRAMEWORK_PATH, ...CURSOR_ONLY],
      test.projectDir,
      test.fakeHome
    );
    expect(setup.exitCode, setup.stderr).toBe(0);
  });
  afterAll(() => test.cleanup());

  it("update refreshes the installed tool", async () => {
    const { exitCode, stdout } = await run("update");

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Updated cursor (1 files)");
  });

  it("rules lists the rules a project holds", async () => {
    const rules = join(test.projectDir, ".claude", "rules");
    await mkdir(rules, { recursive: true });
    await writeFile(join(rules, "1-naming.md"), "---\ndescription: Names files\n---\n\n# Naming\n");

    const { exitCode, stdout } = await run("rules");

    expect(exitCode).toBe(0);
    expect(stdout).toContain("1-naming");
  });

  it("validate-recipes passes a recipe the validator accepts", async () => {
    await writeFile(join(test.projectDir, "recipe.md"), RECIPE);

    const { exitCode, stdout } = await run("validate-recipes", "recipe.md");

    expect(exitCode).toBe(0);
    expect(stdout).toContain("PASS: 1 recipe(s) validated.");
  });

  it("remove deletes the tool's files", async () => {
    const { exitCode, stdout } = await run("remove", "--tool", "cursor");

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Removed cursor (1 files removed)");
  });
});
