import { describe, expect, it } from "vitest";
import { createTestEnv, FRAMEWORK_PATH, runCli } from "./helpers.js";

describe.concurrent("E2E: aidd global options", () => {
  it("--version outputs version in aidd/{semver} format", async () => {
    const { projectDir, cleanup } = await createTestEnv("global");
    try {
      const { stdout, exitCode } = await runCli(["--version"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/^aidd\/\d+\.\d+\.\d+ node\/\d+\.\d+\.\d+/);
    } finally {
      await cleanup();
    }
  });

  it("--help lists all registered commands", async () => {
    const { projectDir, cleanup } = await createTestEnv("global");
    try {
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
      expect(stdout).toContain("self-update");
    } finally {
      await cleanup();
    }
  });

  it("shows an error message for unrecognized commands", async () => {
    const { projectDir, cleanup } = await createTestEnv("global");
    try {
      const { stderr, exitCode } = await runCli(["does-not-exist"], projectDir);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("unknown command");
    } finally {
      await cleanup();
    }
  });

  it("init --help shows init-specific options", async () => {
    const { projectDir, cleanup } = await createTestEnv("global");
    try {
      const { stdout, exitCode } = await runCli(["init", "--help"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("init");
      expect(stdout).toContain("--force");
      expect(stdout).toContain("--docs-dir");
    } finally {
      await cleanup();
    }
  });

  it("config --help shows config subcommands", async () => {
    const { projectDir, cleanup } = await createTestEnv("global");
    try {
      const { stdout, exitCode } = await runCli(["config", "--help"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("list");
      expect(stdout).toContain("get");
      expect(stdout).toContain("set");
    } finally {
      await cleanup();
    }
  });

  it("--verbose install lists installed files", async () => {
    const { projectDir, cleanup } = await createTestEnv("global");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);

      const { stderr, exitCode } = await runCli(
        ["--verbose", "install", "claude", "--framework", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stderr).toMatch(/\+ .+/);
    } finally {
      await cleanup();
    }
  });
});
