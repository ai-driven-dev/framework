import { join, resolve } from "node:path";
import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const validate = vi.fn();
const createDeps = vi.fn(async () => ({ validateRecipes: { execute: validate } }));

const { registerRecipesCommand } = await import("../../../src/presentation/commands/recipes.js");

const PROJECT_ROOT = process.cwd();

let written: string[] = [];
let errors: string[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  written = [];
  errors = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    written.push(String(chunk));
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
    errors.push(String(chunk));
    return true;
  });
  validate.mockReturnValue({ fileCount: 2, findings: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

async function run(...args: string[]): Promise<void> {
  const program = new Command();
  program.exitOverride();
  program.option("--verbose");
  const toolConfig = program.command("framework");
  registerRecipesCommand(toolConfig, program, createDeps);
  await program.parseAsync(["node", "aidd", "framework", "validate-recipes", ...args]);
}

describe("aidd framework validate-recipes: what it hands the validation", () => {
  it("resolves the files against the project and adds no directory by default", async () => {
    await run("a.md", "docs/b.md");

    expect(validate).toHaveBeenCalledWith({
      files: [resolve(PROJECT_ROOT, "a.md"), resolve(PROJECT_ROOT, "docs/b.md")],
      directories: [],
    });
  });

  it("adds the project recipes as an optional directory and the bundled one as required", async () => {
    await run("--all", "--bundled", "assets");

    expect(validate).toHaveBeenCalledWith({
      files: [],
      directories: [
        { path: join(PROJECT_ROOT, "aidd_docs", "recipes"), optional: true },
        { path: resolve(PROJECT_ROOT, "assets"), optional: false },
      ],
    });
  });

  it("reports a pass and leaves the exit code alone when nothing is found", async () => {
    await run();

    expect(written.join("")).toContain("PASS: 2 recipe(s) validated.");
    expect(process.exitCode).toBeUndefined();
  });

  it("reports the findings on stderr and fails the run", async () => {
    validate.mockReturnValue({
      fileCount: 1,
      findings: [{ file: join(PROJECT_ROOT, "a.md"), line: 3, rule: "r1", fix: "do it" }],
    });

    await run("a.md");

    expect(errors.join("")).toContain("| a.md | 3 | r1 | do it |");
    expect(errors.join("")).toContain("FAIL: 1 finding(s) in 1 recipe(s).");
    expect(process.exitCode).toBe(1);
  });
});
