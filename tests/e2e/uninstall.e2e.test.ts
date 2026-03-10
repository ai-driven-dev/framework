import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FRAMEWORK_PATH, runCli } from "./helpers.js";

describe("E2E: aidd uninstall", () => {
  let tempDir: string;
  let projectDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "aidd-e2e-uninstall-"));
    projectDir = join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("removes a tool's files without touching other installed tools", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "cursor", "--framework", FRAMEWORK_PATH], projectDir);

    const { stdout, exitCode } = await runCli(["uninstall", "claude"], projectDir);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Uninstalled claude");
    expect(existsSync(join(projectDir, ".claude"))).toBe(false);
    expect(existsSync(join(projectDir, ".cursor"))).toBe(true);
  }, 5000);

  it("shows an error message when uninstalling a tool that is not installed", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

    const { stderr, exitCode } = await runCli(["uninstall", "cursor"], projectDir);

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("cursor is not installed");
  }, 5000);

  it("shows an error message when the project is not initialized", async () => {
    const { stderr, exitCode } = await runCli(["uninstall", "claude"], projectDir);

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("No AIDD installation found");
  }, 5000);

  it("removes multiple tools in one command", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "cursor", "--framework", FRAMEWORK_PATH], projectDir);

    const { stdout, exitCode } = await runCli(["uninstall", "claude", "cursor"], projectDir);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Uninstalled");
    expect(existsSync(join(projectDir, ".claude"))).toBe(false);
    expect(existsSync(join(projectDir, ".cursor"))).toBe(false);
  }, 5000);

  it("shows an error message for unrecognized tool IDs", async () => {
    const { stderr, exitCode } = await runCli(["uninstall", "unknown-tool"], projectDir);

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("Unknown tool");
  }, 5000);

  it("shows an error message when no tool is specified and --all is not used", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

    const { stderr, exitCode } = await runCli(["uninstall"], projectDir);

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("--all");
  }, 5000);

  it("uninstalls all tools at once with --all", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "--all", "--framework", FRAMEWORK_PATH], projectDir);

    const { stdout, exitCode } = await runCli(["uninstall", "--all"], projectDir);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("claude");
    expect(stdout).toContain("cursor");
    expect(stdout).toContain("copilot");
    expect(existsSync(join(projectDir, ".claude"))).toBe(false);
    expect(existsSync(join(projectDir, ".cursor"))).toBe(false);
    expect(existsSync(join(projectDir, ".github"))).toBe(false);
  }, 5000);

  it("manifest correctly reflects remaining tools after partial uninstall", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "cursor", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["uninstall", "claude"], projectDir);

    const manifestRaw = await readFile(join(projectDir, ".aidd", "manifest.json"), "utf-8");
    const manifest = JSON.parse(manifestRaw) as { tools: Record<string, unknown> };
    expect(manifest.tools.claude).toBeUndefined();
    expect(manifest.tools.cursor).toBeDefined();
  }, 10000);

  it("warns when --all is set with explicit tool IDs", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "--all", "--framework", FRAMEWORK_PATH], projectDir);

    const { stderr, exitCode } = await runCli(["uninstall", "--all", "claude"], projectDir);

    expect(exitCode).toBe(0);
    expect(stderr).toContain("ignoring specified tools");
  }, 5000);
});
