import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FRAMEWORK_PATH, runCli } from "./helpers.js";

describe("E2E: aidd global options", () => {
  let tempDir: string;
  let projectDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "aidd-e2e-global-"));
    projectDir = join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("--version outputs version in aidd/{semver} format", async () => {
    const { stdout, exitCode } = await runCli(["--version"], projectDir);

    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^aidd\/\d+\.\d+\.\d+ node\/\d+\.\d+\.\d+/);
  }, 5000);

  it("--help lists all registered commands", async () => {
    const { stdout, exitCode } = await runCli(["--help"], projectDir);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("init");
    expect(stdout).toContain("install");
    expect(stdout).toContain("uninstall");
    expect(stdout).toContain("status");
    expect(stdout).toContain("clean");
    expect(stdout).toContain("doctor");
    expect(stdout).toContain("update");
    expect(stdout).toContain("restore");
    expect(stdout).toContain("sync");
    expect(stdout).toContain("cache");
    expect(stdout).toContain("config");
  }, 5000);

  it("shows an error message for unrecognized commands", async () => {
    const { stderr, exitCode } = await runCli(["does-not-exist"], projectDir);

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("unknown command");
  }, 5000);

  it("--verbose install lists installed files", async () => {
    await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);

    const { stderr, exitCode } = await runCli(
      ["--verbose", "install", "claude", "--framework", FRAMEWORK_PATH],
      projectDir
    );

    expect(exitCode).toBe(0);
    expect(stderr).toMatch(/\+ .+/);
  }, 5000);
});
