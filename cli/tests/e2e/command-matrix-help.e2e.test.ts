import { describe, expect, it } from "vitest";
import { createTestEnv, runCli } from "./helpers.js";

describe.concurrent("Command Matrix: Help", () => {
  it("aidd --help exits 0 and lists top-level commands", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("help-root");
    try {
      const { stdout, exitCode } = await runCli(["--help"], projectDir, fakeHome);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("setup");
      expect(stdout).toContain("framework");
      expect(stdout).toContain("plugin");
      expect(stdout).toContain("marketplace");
      expect(stdout).toContain("auth");
      expect(stdout).toContain("doctor");
      expect(stdout).toContain("sync");
      expect(stdout).toContain("translate");
      expect(stdout).toContain("update");
      // `ai`/`ide` are retired behind `--tool`.
      expect(stdout).not.toMatch(/^\s*ai\s/m);
      expect(stdout).not.toMatch(/^\s*ide\s/m);
    } finally {
      await cleanup();
    }
  });

  it("aidd install (no --help) exits 1 with unknown command error", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("help-unknown-install");
    try {
      const { stderr, exitCode } = await runCli(["install"], projectDir, fakeHome);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("unknown command");
      expect(stderr).toContain("install");
    } finally {
      await cleanup();
    }
  });

  it("aidd install --help exits 0 (Commander.js intercepts --help before unknown command check)", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("help-unknown-install-flag");
    try {
      const { stdout, exitCode } = await runCli(["install", "--help"], projectDir, fakeHome);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Usage:");
    } finally {
      await cleanup();
    }
  });

  it("update --check works without authentication", async () => {
    // --check performs a real npm lookup, so the exit code tracks network reachability;
    // assert only that authentication is never demanded.
    const { projectDir, fakeHome, cleanup } = await createTestEnv("global-update-check");
    try {
      const { stderr } = await runCli(["update", "--check"], projectDir, fakeHome);
      expect(stderr).not.toMatch(/[Nn]ot authenticated|auth login/);
    } finally {
      await cleanup();
    }
  });
});
