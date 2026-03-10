import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FRAMEWORK_PATH, runCli } from "./helpers.js";

describe("E2E: aidd init", () => {
  let tempDir: string;
  let projectDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "aidd-e2e-init-"));
    projectDir = join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("creates the docs directory and manifest", async () => {
    const { stdout, exitCode } = await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Initialized docs in aidd_docs/");
    expect(existsSync(join(projectDir, "aidd_docs"))).toBe(true);
    expect(existsSync(join(projectDir, ".aidd", "manifest.json"))).toBe(true);
  }, 5000);

  it("creates a custom docs directory when --docs-dir is specified", async () => {
    const { stdout, exitCode } = await runCli(
      ["init", "--framework", FRAMEWORK_PATH, "--docs-dir", "my_docs"],
      projectDir
    );

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Initialized docs in my_docs/");
    expect(existsSync(join(projectDir, "my_docs"))).toBe(true);

    const manifestRaw = await readFile(join(projectDir, ".aidd", "manifest.json"), "utf-8");
    const manifest = JSON.parse(manifestRaw) as { docsDir?: string };
    expect(manifest.docsDir).toBe("my_docs");
  }, 5000);

  it("shows an error message when the docs-dir name contains invalid characters", async () => {
    const { stderr, exitCode } = await runCli(
      ["init", "--framework", FRAMEWORK_PATH, "--docs-dir", "my docs!"],
      projectDir
    );

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("Invalid directory name");
  }, 5000);

  it("shows an error message when the docs directory already exists", async () => {
    await mkdir(join(projectDir, "aidd_docs"), { recursive: true });

    const { stderr, exitCode } = await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("aidd adopt");
  }, 5000);

  it("re-copies docs templates with --force on existing installation", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
    const { stdout, exitCode } = await runCli(
      ["init", "--force", "--framework", FRAMEWORK_PATH],
      projectDir
    );

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Initialized docs in aidd_docs/");
  }, 10000);

  it("fails with guidance when --force is used without prior init", async () => {
    const { stderr, exitCode } = await runCli(
      ["init", "--force", "--framework", FRAMEWORK_PATH],
      projectDir
    );

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("No AIDD installation found");
  }, 5000);
});
