import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FRAMEWORK_PATH, runCli } from "./helpers.js";

describe("E2E: aidd adopt", () => {
  let tempDir: string;
  let projectDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "aidd-e2e-adopt-"));
    projectDir = join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("shows usage with --help", async () => {
    const { stdout, exitCode } = await runCli(["adopt", "--help"], projectDir);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("adopt");
  }, 10000);

  it("fails with 'No AIDD directories found' when no tool dirs exist", async () => {
    const { stderr, exitCode } = await runCli(["adopt", "--framework", FRAMEWORK_PATH], projectDir);

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("No AIDD directories found");
  }, 10000);

  it("fails with 'Already initialized' when manifest exists", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

    const { stderr, exitCode } = await runCli(
      ["adopt", "--framework", FRAMEWORK_PATH, "--force"],
      projectDir
    );

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("Already initialized");
  }, 10000);

  it("creates manifest from manually installed .claude/ files with --force", async () => {
    // Seed .claude/ directory (simulate manual installation)
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

    // Remove manifest to simulate manual install
    await rm(join(projectDir, ".aidd"), { recursive: true, force: true });

    expect(existsSync(join(projectDir, ".aidd", "manifest.json"))).toBe(false);
    expect(existsSync(join(projectDir, ".claude"))).toBe(true);

    const { stdout, exitCode } = await runCli(
      ["adopt", "--framework", FRAMEWORK_PATH, "--force"],
      projectDir
    );

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Adopted");
    expect(existsSync(join(projectDir, ".aidd", "manifest.json"))).toBe(true);
  }, 15000);

  it("status shows no drift after adopt with --force", async () => {
    // Seed .claude/ directory
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

    // Remove manifest to simulate manual install
    await rm(join(projectDir, ".aidd"), { recursive: true, force: true });

    await runCli(["adopt", "--framework", FRAMEWORK_PATH, "--force"], projectDir);

    const { stdout, exitCode } = await runCli(
      ["status", "--framework", FRAMEWORK_PATH],
      projectDir
    );

    expect(exitCode).toBe(0);
    expect(stdout).toContain("in sync");
  }, 20000);

  it("init fails with adopt guidance when .claude/ exists and no manifest", async () => {
    await mkdir(join(projectDir, ".claude"), { recursive: true });

    const { stderr, exitCode } = await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("aidd adopt");
  }, 10000);

  it("orphan files are reported but not deleted", async () => {
    // Seed .claude/ with framework files
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

    // Add orphan file
    const orphanPath = join(projectDir, ".claude", "rules", "my-custom-rule.md");
    await writeFile(orphanPath, "my custom rule");

    // Remove manifest to simulate manual install
    await rm(join(projectDir, ".aidd"), { recursive: true, force: true });

    const { stdout, stderr, exitCode } = await runCli(
      ["adopt", "--framework", FRAMEWORK_PATH, "--force"],
      projectDir
    );

    expect(exitCode).toBe(0);
    // Orphan warning should appear
    expect(stderr).toContain("orphan");
    // Orphan file should still exist
    expect(existsSync(orphanPath)).toBe(true);
  }, 15000);

  it("adopts multiple tools when both .claude/ and .cursor/ exist", async () => {
    // Seed both tool directories
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);
    await runCli(["install", "cursor", "--framework", FRAMEWORK_PATH], projectDir);

    // Remove manifest
    await rm(join(projectDir, ".aidd"), { recursive: true, force: true });

    const { stdout, exitCode } = await runCli(
      ["adopt", "--framework", FRAMEWORK_PATH, "--force"],
      projectDir
    );

    expect(exitCode).toBe(0);

    const manifestRaw = await readFile(join(projectDir, ".aidd", "manifest.json"), "utf-8");
    const manifest = JSON.parse(manifestRaw) as { tools: Record<string, unknown> };
    expect(manifest.tools.claude).toBeDefined();
    expect(manifest.tools.cursor).toBeDefined();
  }, 20000);
});
