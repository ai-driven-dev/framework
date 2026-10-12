import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPOSITORY_ROOT } from "../helpers/repository-root.js";
import { createTestEnv, runCli } from "./helpers.js";

const RECIPE = [
  "# Check the runtime",
  "",
  "Check one observable result.",
  "",
  "## Steps to check the runtime",
  "",
  "### 1) ✅ Run the check",
  "",
  "```bash",
  "node --version",
  "```",
  "",
].join("\n");

describe("recipe validation through the built CLI", () => {
  it("validates a recipe without changing it", async () => {
    const env = await createTestEnv("recipe-valid");
    try {
      const file = join(env.projectDir, "recipe.md");
      await writeFile(file, RECIPE);
      const result = await runCli(
        ["framework", "validate-recipes", "recipe.md"],
        env.projectDir,
        env.fakeHome
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("PASS: 1 recipe(s) validated.\n");
      expect(result.stderr).toBe("");
      expect(await readFile(file, "utf8")).toBe(RECIPE);
    } finally {
      await env.cleanup();
    }
  });

  it("includes project and explicitly supplied bundled recipes", async () => {
    const env = await createTestEnv("recipe-all");
    try {
      const directory = join(env.projectDir, "aidd_docs", "recipes");
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, "project.md"), RECIPE);
      const bundled = join(REPOSITORY_ROOT, "plugins/aidd-context/skills/12-cook/assets/recipes");
      const result = await runCli(
        ["framework", "validate-recipes", "--all", "--bundled", bundled],
        env.projectDir,
        env.fakeHome
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("PASS: 4 recipe(s) validated.\n");
      expect(result.stderr).toBe("");
    } finally {
      await env.cleanup();
    }
  });

  it("reports invalid JSON with its file, line, rule, and non-zero exit", async () => {
    const env = await createTestEnv("recipe-json");
    try {
      const invalid = RECIPE.replace(
        "```bash\nnode --version",
        '```json\n{"enabled": true <!-- remove me -->}'
      );
      await writeFile(join(env.projectDir, "recipe.md"), invalid);
      const result = await runCli(
        ["framework", "validate-recipes", "recipe.md"],
        env.projectDir,
        env.fakeHome
      );
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("| recipe.md | 9 | json-syntax |");
      expect(await readFile(join(env.projectDir, "recipe.md"), "utf8")).toBe(invalid);
    } finally {
      await env.cleanup();
    }
  });

  it("requires a target instead of reporting an empty successful run", async () => {
    const env = await createTestEnv("recipe-empty");
    try {
      const result = await runCli(["framework", "validate-recipes"], env.projectDir, env.fakeHome);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Pass at least one recipe path");
      expect(result.stdout).not.toContain("PASS");
    } finally {
      await env.cleanup();
    }
  });

  it("does not treat a missing explicit bundled directory as an empty scope", async () => {
    const env = await createTestEnv("recipe-missing-directory");
    try {
      const result = await runCli(
        ["framework", "validate-recipes", "--bundled", "missing"],
        env.projectDir,
        env.fakeHome
      );
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("ENOENT");
      expect(result.stdout).not.toContain("PASS");
    } finally {
      await env.cleanup();
    }
  });

  it("exposes help that an installed skill can use to check CLI compatibility", async () => {
    const env = await createTestEnv("recipe-help");
    try {
      const result = await runCli(
        ["framework", "validate-recipes", "--help"],
        env.projectDir,
        env.fakeHome
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("validate-recipes [options] [paths...]");
      expect(result.stdout).toContain("--bundled <directory>");
    } finally {
      await env.cleanup();
    }
  });
});
