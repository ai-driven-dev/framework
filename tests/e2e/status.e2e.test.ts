import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FRAMEWORK_PATH, runCli } from "./helpers.js";

describe("E2E: aidd status", () => {
  let tempDir: string;
  let projectDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "aidd-e2e-status-"));
    projectDir = join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("reports all files in sync after a fresh install", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

    const { stdout, exitCode } = await runCli(["status"], projectDir);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("All files are in sync");
  }, 5000);

  it("reports a modified file as drifted", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

    await writeFile(join(projectDir, "CLAUDE.md"), "modified content by user", "utf-8");

    const { stdout, exitCode } = await runCli(["status"], projectDir);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("~");
  }, 5000);

  it("reports a deleted file as missing", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

    await rm(join(projectDir, "CLAUDE.md"), { force: true });

    const { stdout, exitCode } = await runCli(["status"], projectDir);

    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/-\s+CLAUDE\.md/);
  }, 5000);

  it("filters status output to a specific tool with --tool", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "cursor", "--framework", FRAMEWORK_PATH], projectDir);

    const { stdout, exitCode } = await runCli(["status", "--tool", "claude"], projectDir);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("All files are in sync");
    expect(stdout).not.toContain("cursor");
  }, 5000);

  it("reports an untracked file in tool directory as added", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

    await writeFile(join(projectDir, ".claude", "untracked-file.md"), "extra content", "utf-8");

    const { stdout, exitCode } = await runCli(["status"], projectDir);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("+");
  }, 5000);

  it("shows an error message when --tool receives an unrecognized tool ID", async () => {
    const { stderr, exitCode } = await runCli(["status", "--tool", "unknown-tool"], projectDir);

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("Unknown tool");
  }, 5000);

  it("reports error when --tool specifies a valid but uninstalled tool", async () => {
    // init only (no install)
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    const { stderr, exitCode } = await runCli(["status", "--tool", "cursor"], projectDir);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("cursor"); // mentions the tool in error
  }, 5000);

  it("shows an error message when the project is not initialized", async () => {
    const { stderr, exitCode } = await runCli(["status"], projectDir);

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("No AIDD installation found");
  }, 5000);

  it("reports docs drift when no tools are installed", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);

    // aidd_docs/tasks/.gitkeep is a tracked docs file in the test fixture
    const trackedPath = join(projectDir, "aidd_docs", "tasks", ".gitkeep");
    await writeFile(trackedPath, "modified", "utf-8");

    const { stdout, exitCode } = await runCli(["status"], projectDir);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("docs");
    expect(stdout).toContain("~");
  }, 5000);
});
