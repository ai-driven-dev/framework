import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FRAMEWORK_PATH, runCli } from "./helpers.js";

describe("E2E: aidd sync", () => {
  let tempDir: string;
  let projectDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "aidd-e2e-sync-"));
    projectDir = join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("fails with 'No AIDD installation found' when no manifest exists", async () => {
    const { stderr, exitCode } = await runCli(
      ["sync", "--source", "claude", "--framework", FRAMEWORK_PATH],
      projectDir
    );

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("No AIDD installation found");
  }, 10000);

  it("fails when source tool is not installed", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "cursor", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "copilot", "--framework", FRAMEWORK_PATH], projectDir);

    const { stderr, exitCode } = await runCli(
      ["sync", "--source", "claude", "--framework", FRAMEWORK_PATH],
      projectDir
    );

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("claude");
  }, 10000);

  it("fails with 'at least 2 installed tools' when only claude is installed", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

    const { stderr, exitCode } = await runCli(
      ["sync", "--source", "claude", "--framework", FRAMEWORK_PATH],
      projectDir
    );

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("at least 2 installed tools");
  }, 10000);

  it("fails when source and target are the same tool", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "cursor", "--framework", FRAMEWORK_PATH], projectDir);

    const { stderr, exitCode } = await runCli(
      ["sync", "--source", "claude", "--target", "claude", "--framework", FRAMEWORK_PATH],
      projectDir
    );

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("same tool");
  }, 10000);

  it("reports nothing to sync when claude has no modifications", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "cursor", "--framework", FRAMEWORK_PATH], projectDir);

    const { stdout, exitCode } = await runCli(
      ["sync", "--source", "claude", "--framework", FRAMEWORK_PATH],
      projectDir
    );

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Nothing to sync");
  }, 10000);

  it("syncs a modified rule file from claude to cursor", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "cursor", "--framework", FRAMEWORK_PATH], projectDir);

    const claudeNamingPath = join(projectDir, ".claude", "rules", "01-standards", "naming.md");
    await writeFile(claudeNamingPath, "# Custom naming rules\nmodified content", "utf-8");

    const { stdout, exitCode } = await runCli(
      [
        "sync",
        "--source",
        "claude",
        "--target",
        "cursor",
        "--framework",
        FRAMEWORK_PATH,
        "--force",
      ],
      projectDir
    );

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Synced");

    const cursorNamingPath = join(projectDir, ".cursor", "rules", "01-standards", "naming.mdc");
    const cursorContent = await readFile(cursorNamingPath, "utf-8");
    expect(cursorContent).toContain("Custom naming rules");
  }, 10000);

  it("propagates deletion from source to target", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "cursor", "--framework", FRAMEWORK_PATH], projectDir);

    const claudeNamingPath = join(projectDir, ".claude", "rules", "01-standards", "naming.md");
    await rm(claudeNamingPath, { force: true });

    const { stdout, exitCode } = await runCli(
      ["sync", "--source", "claude", "--target", "cursor", "--framework", FRAMEWORK_PATH],
      projectDir
    );

    expect(exitCode).toBe(0);
    expect(stdout).toContain("deleted");

    const cursorNamingPath = join(projectDir, ".cursor", "rules", "01-standards", "naming.mdc");
    expect(existsSync(cursorNamingPath)).toBe(false);
  }, 10000);

  it("propagates modification from source to all installed tools when no --target is given", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "cursor", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "copilot", "--framework", FRAMEWORK_PATH], projectDir);

    const claudeNamingPath = join(projectDir, ".claude", "rules", "01-standards", "naming.md");
    await writeFile(claudeNamingPath, "# Broadcast sync\nmodified content", "utf-8");

    const { stdout, exitCode } = await runCli(
      ["sync", "--source", "claude", "--framework", FRAMEWORK_PATH, "--force"],
      projectDir
    );

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Synced");

    const cursorNamingPath = join(projectDir, ".cursor", "rules", "01-standards", "naming.mdc");
    const copilotNamingPath = join(
      projectDir,
      ".github",
      "instructions",
      "01-naming.instructions.md"
    );
    const cursorContent = await readFile(cursorNamingPath, "utf-8");
    const copilotContent = await readFile(copilotNamingPath, "utf-8");
    expect(cursorContent).toContain("Broadcast sync");
    expect(copilotContent).toContain("Broadcast sync");
  }, 15000);

  it("fails when target tool is installed but a different target is specified that is not installed", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "cursor", "--framework", FRAMEWORK_PATH], projectDir);

    const { stderr, exitCode } = await runCli(
      ["sync", "--source", "claude", "--target", "copilot", "--framework", FRAMEWORK_PATH],
      projectDir
    );

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("copilot");
    expect(stderr).toContain("not installed");
  }, 10000);

  it("force-syncs from claude to cursor without blocking on conflict", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "cursor", "--framework", FRAMEWORK_PATH], projectDir);

    const claudeNamingPath = join(projectDir, ".claude", "rules", "01-standards", "naming.md");
    await writeFile(claudeNamingPath, "# Force sync\noverridden content", "utf-8");

    const { stdout, exitCode } = await runCli(
      [
        "sync",
        "--source",
        "claude",
        "--target",
        "cursor",
        "--framework",
        FRAMEWORK_PATH,
        "--force",
      ],
      projectDir
    );

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Synced");

    const cursorNamingPath = join(projectDir, ".cursor", "rules", "01-standards", "naming.mdc");
    const content = await readFile(cursorNamingPath, "utf-8");
    expect(content).toContain("Force sync");
  }, 10000);

  it("shows usage with --help", async () => {
    const { stdout, exitCode } = await runCli(["sync", "--help"], projectDir);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("sync");
  }, 10000);

  it("syncs user agent from claude to cursor with --include-user-files", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "cursor", "--framework", FRAMEWORK_PATH], projectDir);

    const userAgentPath = join(projectDir, ".claude", "agents", "my-custom-agent.md");
    await writeFile(
      userAgentPath,
      "---\nname: my-custom-agent\ndescription: My custom agent.\n---\n\nCustom agent content.\n",
      "utf-8"
    );

    const { stdout, exitCode } = await runCli(
      [
        "sync",
        "--source",
        "claude",
        "--target",
        "cursor",
        "--framework",
        FRAMEWORK_PATH,
        "--include-user-files",
      ],
      projectDir
    );

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Synced");

    const targetPath = join(projectDir, ".cursor", "agents", "my-custom-agent.md");
    const content = await readFile(targetPath, "utf-8");
    expect(content).toContain("Custom agent content.");
  }, 15000);

  it("syncs a modified rule from claude to copilot (framework file MODIFIED)", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "copilot", "--framework", FRAMEWORK_PATH], projectDir);

    const claudeNamingPath = join(projectDir, ".claude", "rules", "01-standards", "naming.md");
    await writeFile(claudeNamingPath, "# Copilot sync test\nmodified content", "utf-8");

    const { stdout, exitCode } = await runCli(
      [
        "sync",
        "--source",
        "claude",
        "--target",
        "copilot",
        "--framework",
        FRAMEWORK_PATH,
        "--force",
      ],
      projectDir
    );

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Synced");

    const copilotNamingPath = join(
      projectDir,
      ".github",
      "instructions",
      "01-naming.instructions.md"
    );
    const content = await readFile(copilotNamingPath, "utf-8");
    expect(content).toContain("Copilot sync test");
  }, 15000);
});
