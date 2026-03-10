import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FRAMEWORK_PATH, runCli } from "./helpers.js";

describe("E2E: aidd update", () => {
  let tempDir: string;
  let projectDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "aidd-e2e-update-"));
    projectDir = join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("fails with 'No AIDD installation found' when no manifest exists", async () => {
    const { stderr, exitCode } = await runCli(
      ["update", "--framework", FRAMEWORK_PATH],
      projectDir
    );

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("No AIDD installation found");
  }, 10000);

  it("reports 'Already up to date' when same version is installed and no files changed", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

    const { stdout, exitCode } = await runCli(
      ["update", "--framework", FRAMEWORK_PATH],
      projectDir
    );

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Already up to date");
  }, 10000);

  it("exits successfully with --dry-run and shows no files written", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

    const claudeMdPath = join(projectDir, "CLAUDE.md");
    const originalContent = await readFile(claudeMdPath, "utf-8");

    const { exitCode } = await runCli(
      ["update", "--framework", FRAMEWORK_PATH, "--dry-run"],
      projectDir
    );

    expect(exitCode).toBe(0);

    const afterContent = await readFile(claudeMdPath, "utf-8");
    expect(afterContent).toBe(originalContent);
  }, 10000);

  it("exits successfully with --force when already up to date", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

    const { stdout, exitCode } = await runCli(
      ["update", "--framework", FRAMEWORK_PATH, "--force"],
      projectDir
    );

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Already up to date");
  }, 10000);

  it("creates a .backup file when --force overwrites a user-modified conflict", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

    const manifestPath = join(projectDir, ".aidd", "manifest.json");
    const rawManifest = await readFile(manifestPath, "utf-8");
    const manifestData = JSON.parse(rawManifest) as {
      tools: Record<
        string,
        { version: string; files: Array<{ relativePath: string; hash: string }> }
      >;
    };

    const ruleFile = manifestData.tools.claude.files.find(
      (f: { relativePath: string }) => f.relativePath === ".claude/rules/01-standards/naming.md"
    );
    if (ruleFile) ruleFile.hash = "00000000000000000000000000000000";
    await writeFile(manifestPath, JSON.stringify(manifestData));

    const rulePath = join(projectDir, ".claude", "rules", "01-standards", "naming.md");
    await writeFile(rulePath, "user modified rule content");

    const { exitCode } = await runCli(
      ["update", "--framework", FRAMEWORK_PATH, "--force"],
      projectDir
    );

    expect(exitCode).toBe(0);
    const backupPath = join(projectDir, ".claude", "rules", "01-standards", "naming.md.backup");
    expect(existsSync(backupPath)).toBe(true);

    const backupContent = await readFile(backupPath, "utf-8");
    expect(backupContent).toBe("user modified rule content");
  }, 15000);

  it("shows usage with --help", async () => {
    const { stdout, exitCode } = await runCli(["update", "--help"], projectDir);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("update");
  }, 10000);

  it("respects --release flag to download specific version", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);
    const { exitCode } = await runCli(
      ["update", "--framework", FRAMEWORK_PATH, "--release", "test"],
      projectDir
    );
    expect(exitCode).toBe(0);
  }, 10000);
});
