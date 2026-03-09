import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FRAMEWORK_PATH, runCli } from "./helpers.js";

describe("E2E: aidd install", () => {
  let tempDir: string;
  let projectDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "aidd-e2e-install-"));
    projectDir = join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("auto-initializes and installs claude in one command", async () => {
    const { stdout, exitCode } = await runCli(
      ["install", "claude", "--framework", FRAMEWORK_PATH],
      projectDir
    );

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Installed claude");
    expect(existsSync(join(projectDir, ".claude"))).toBe(true);
    expect(existsSync(join(projectDir, "aidd_docs"))).toBe(true);
    expect(existsSync(join(projectDir, ".aidd", "manifest.json"))).toBe(true);
  }, 5000);

  it("installs cursor tool with correct file layout", async () => {
    const { stdout, exitCode } = await runCli(
      ["install", "cursor", "--framework", FRAMEWORK_PATH],
      projectDir
    );

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Installed cursor");
    expect(existsSync(join(projectDir, ".cursor"))).toBe(true);
  }, 5000);

  it("installs copilot tool with correct file layout", async () => {
    const { stdout, exitCode } = await runCli(
      ["install", "copilot", "--framework", FRAMEWORK_PATH],
      projectDir
    );

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Installed copilot");
    expect(existsSync(join(projectDir, ".github"))).toBe(true);
  }, 5000);

  it("shows an error message for unrecognized tool IDs", async () => {
    const { stderr, exitCode } = await runCli(
      ["install", "unknown-tool", "--framework", FRAMEWORK_PATH],
      projectDir
    );

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("Unknown tool");
  }, 5000);

  it("skips already installed tool without --force", async () => {
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

    const { stderr, exitCode } = await runCli(
      ["install", "claude", "--framework", FRAMEWORK_PATH],
      projectDir
    );

    expect(exitCode).toBe(0);
    expect(stderr).toContain("already installed");
  }, 5000);

  it("reinstalls an existing tool when --force is used", async () => {
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

    const { stdout, exitCode } = await runCli(
      ["install", "claude", "--force", "--framework", FRAMEWORK_PATH],
      projectDir
    );

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Installed claude");
  }, 5000);

  it("skips re-initializing docs when project is already initialized", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    const { stdout, exitCode } = await runCli(
      ["install", "claude", "--framework", FRAMEWORK_PATH],
      projectDir
    );

    expect(exitCode).toBe(0);
    expect(stdout).not.toContain("Initializing docs first");
  }, 5000);

  it("installs all tools at once with --all", async () => {
    const { stdout, exitCode } = await runCli(
      ["install", "--all", "--framework", FRAMEWORK_PATH],
      projectDir
    );

    expect(exitCode).toBe(0);
    expect(stdout).toContain("claude");
    expect(stdout).toContain("cursor");
    expect(stdout).toContain("copilot");
    expect(existsSync(join(projectDir, ".claude"))).toBe(true);
    expect(existsSync(join(projectDir, ".cursor"))).toBe(true);
    expect(existsSync(join(projectDir, ".github"))).toBe(true);
  }, 5000);

  it("shows an error message when no tool is specified and --all is not used", async () => {
    const { stderr, exitCode } = await runCli(
      ["install", "--framework", FRAMEWORK_PATH],
      projectDir
    );

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("--all");
  }, 5000);

  it("reinstalls all tools when --all --force is used", async () => {
    await runCli(["install", "--all", "--framework", FRAMEWORK_PATH], projectDir);

    const { stdout, exitCode } = await runCli(
      ["install", "--all", "--force", "--framework", FRAMEWORK_PATH],
      projectDir
    );

    expect(exitCode).toBe(0);
    expect(stdout).toContain("claude");
    expect(stdout).toContain("cursor");
    expect(stdout).toContain("copilot");
  }, 5000);

  it("generates files with all path placeholders resolved", async () => {
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

    const manifestRaw = await readFile(join(projectDir, ".aidd", "manifest.json"), "utf-8");
    const manifest = JSON.parse(manifestRaw) as {
      tools: { claude: { files: { relativePath: string }[] } };
    };

    for (const file of manifest.tools.claude.files) {
      const content = await readFile(join(projectDir, file.relativePath), "utf-8");
      expect(content).not.toContain("{{TOOLS}}/");
      expect(content).not.toContain("{{DOCS}}/");
    }
  }, 5000);
});
