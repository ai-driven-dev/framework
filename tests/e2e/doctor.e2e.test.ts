import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FRAMEWORK_PATH, runCli } from "./helpers.js";

describe("E2E: aidd doctor", () => {
  let tempDir: string;
  let projectDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "aidd-e2e-doctor-"));
    projectDir = join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("reports a healthy installation after a fresh install", async () => {
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

    const { stdout, exitCode } = await runCli(["doctor"], projectDir);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Installation is healthy");
  }, 5000);

  it("shows an error message when the manifest JSON is corrupted", async () => {
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);
    await writeFile(join(projectDir, ".aidd", "manifest.json"), "{ not valid json", "utf-8");

    const { stderr, exitCode } = await runCli(["doctor"], projectDir);

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("corrupted");
  }, 5000);

  it("shows an error message when the project is not initialized", async () => {
    const { stderr, exitCode } = await runCli(["doctor"], projectDir);

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("No AIDD installation found");
  }, 5000);

  it("reports a warning for a broken @path reference in a tracked file", async () => {
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

    // Overwrite a tracked .md file with a broken @path reference
    await writeFile(
      join(projectDir, ".claude", "agents", "code-reviewer.md"),
      "See @.claude/agents/nonexistent-agent.md for details",
      "utf-8"
    );

    const { stderr, exitCode } = await runCli(["doctor"], projectDir);

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("nonexistent-agent.md");
  }, 5000);
});
