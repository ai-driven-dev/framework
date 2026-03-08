import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FRAMEWORK_PATH, runCli } from "./helpers.js";

describe("E2E: aidd clean", () => {
  let tempDir: string;
  let projectDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "aidd-e2e-clean-"));
    projectDir = join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("previews files to remove without deleting them", async () => {
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

    const { stdout, exitCode } = await runCli(["clean"], projectDir);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("--force");
    expect(existsSync(join(projectDir, ".claude"))).toBe(true);
    expect(existsSync(join(projectDir, ".aidd"))).toBe(true);
  }, 5000);

  it("deletes all installed files and manifest when --force is used", async () => {
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

    const { stdout, exitCode } = await runCli(["clean", "--force"], projectDir);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Cleaned all AIDD files");
    expect(existsSync(join(projectDir, ".claude"))).toBe(false);
    expect(existsSync(join(projectDir, ".aidd"))).toBe(false);
  }, 5000);

  it("reports nothing to clean when not initialized", async () => {
    const { stdout, exitCode } = await runCli(["clean", "--force"], projectDir);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Nothing to clean");
  }, 5000);

  it("lists tool names and file counts in dry-run preview output", async () => {
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

    const { stdout, exitCode } = await runCli(["clean"], projectDir);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("claude");
    expect(stdout).toMatch(/\d+ files?/);
  }, 5000);

  it("removes docs and manifest when only init was run", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);

    const { stdout, exitCode } = await runCli(["clean", "--force"], projectDir);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Cleaned");
    expect(existsSync(join(projectDir, "aidd_docs"))).toBe(false);
    expect(existsSync(join(projectDir, ".aidd"))).toBe(false);
  }, 5000);
});
