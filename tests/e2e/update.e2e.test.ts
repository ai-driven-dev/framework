import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, FRAMEWORK_PATH, initProject, runCli } from "./helpers.js";

describe.concurrent("E2E: aidd update", () => {
  it("re-installs runtime configs from bundled CLI assets for installed tools", async () => {
    const { projectDir, cleanup } = await createTestEnv("update");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

      // user modifies the runtime config
      const claudeMd = join(projectDir, "CLAUDE.md");
      await writeFile(claudeMd, "user-modified content", "utf-8");

      const { stdout, exitCode } = await runCli(["update", "--force"], projectDir);
      expect(exitCode).toBe(0);
      expect(stdout.toLowerCase()).toMatch(/updated|nothing/);
    } finally {
      await cleanup();
    }
  });

  it("limits update to specified tool with --tool", async () => {
    const { projectDir, cleanup } = await createTestEnv("update");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "ai", "cursor", "--path", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(["update", "--tool", "claude"], projectDir);
      expect(exitCode).toBe(0);
      expect(stdout).not.toContain("cursor");
    } finally {
      await cleanup();
    }
  });

  it("reports nothing to update when no tools installed", async () => {
    const { projectDir, cleanup } = await createTestEnv("update");
    try {
      const { stdout, exitCode } = await runCli(["update"], projectDir);
      expect(exitCode).toBe(0);
      expect(stdout.toLowerCase()).toMatch(/no tools|setup/);
    } finally {
      await cleanup();
    }
  });

  it("rejects unknown tool ID", async () => {
    const { projectDir, cleanup } = await createTestEnv("update");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);

      const { stderr, exitCode } = await runCli(["update", "--tool", "nonexistent"], projectDir);
      expect(exitCode).not.toBe(0);
      expect(stderr.toLowerCase()).toMatch(/tool/);
    } finally {
      await cleanup();
    }
  });

  it("legacy --path flag is rejected (removed)", async () => {
    const { projectDir, cleanup } = await createTestEnv("update");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);

      const { stderr, exitCode } = await runCli(["update", "--path", FRAMEWORK_PATH], projectDir);
      expect(exitCode).not.toBe(0);
      expect(stderr).toMatch(/unknown option/i);
    } finally {
      await cleanup();
    }
  });

  it("legacy --release flag is rejected (removed)", async () => {
    const { projectDir, cleanup } = await createTestEnv("update");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);

      const { stderr, exitCode } = await runCli(["update", "--release", "v3.9.0"], projectDir);
      expect(exitCode).not.toBe(0);
      expect(stderr).toMatch(/unknown option/i);
    } finally {
      await cleanup();
    }
  });

  it("legacy --dry-run flag is rejected (removed)", async () => {
    const { projectDir, cleanup } = await createTestEnv("update");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);

      const { stderr, exitCode } = await runCli(["update", "--dry-run"], projectDir);
      expect(exitCode).not.toBe(0);
      expect(stderr).toMatch(/unknown option/i);
    } finally {
      await cleanup();
    }
  });

  it("file structure stays intact after update (regression: empty project)", async () => {
    const { projectDir, cleanup } = await createTestEnv("update");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

      await runCli(["update", "--force"], projectDir);

      expect(existsSync(join(projectDir, "CLAUDE.md"))).toBe(true);
      expect(existsSync(join(projectDir, ".aidd", "manifest.json"))).toBe(true);
    } finally {
      await cleanup();
    }
  });
});
