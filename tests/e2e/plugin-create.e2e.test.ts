/**
 * E2E — plugin create round-trip
 * AC#6: aidd plugin create demo --yes → scaffold at plugins/demo/ →
 *        aidd plugin install → manifest tracks plugin → doctor exits 0.
 * AC#9: non-TTY with no name arg → exit 1.
 */

import { access } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, runCli } from "./helpers.js";

async function seedWithClaude(projectDir: string, fakeHome: string): Promise<void> {
  await runCli(["ai", "install", "claude"], projectDir, fakeHome);
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

describe.concurrent("E2E: plugin create round-trip", () => {
  it("plugin create demo --yes scaffolds at plugins/demo/ with expected files", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("plugin-create-scaffold");
    try {
      await seedWithClaude(projectDir, fakeHome);
      const { stdout, exitCode } = await runCli(
        ["plugin", "create", "demo", "--yes"],
        projectDir,
        fakeHome
      );
      expect(exitCode).toBe(0);
      expect(stdout).toContain("demo");

      const pluginDir = join(projectDir, "plugins", "demo");
      expect(await pathExists(pluginDir)).toBe(true);
      expect(await pathExists(join(pluginDir, ".claude-plugin", "plugin.json"))).toBe(true);
      expect(await pathExists(join(pluginDir, "README.md"))).toBe(true);
      expect(await pathExists(join(pluginDir, "CHANGELOG.md"))).toBe(true);
      expect(await pathExists(join(pluginDir, "hooks", "hooks.json"))).toBe(true);
      expect(await pathExists(join(pluginDir, ".mcp.json"))).toBe(true);
      expect(await pathExists(join(pluginDir, "agents", "example.md"))).toBe(true);
      expect(await pathExists(join(pluginDir, "skills", "00-example", "SKILL.md"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("plugin create → plugin install → doctor exits 0 (full round-trip)", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("plugin-create-roundtrip");
    try {
      await seedWithClaude(projectDir, fakeHome);

      const createResult = await runCli(
        ["plugin", "create", "demo", "--yes"],
        projectDir,
        fakeHome
      );
      expect(createResult.exitCode).toBe(0);

      const pluginDir = join(projectDir, "plugins", "demo");
      const installResult = await runCli(
        ["plugin", "install", pluginDir, "--tool", "claude"],
        projectDir,
        fakeHome
      );
      expect(installResult.exitCode).toBe(0);
      expect(installResult.stdout).toContain("Plugin added successfully");

      const doctorResult = await runCli(["plugin", "doctor"], projectDir, fakeHome);
      expect(doctorResult.exitCode).toBe(0);
      expect(doctorResult.stdout).toContain("healthy");
    } finally {
      await cleanup();
    }
  });

  it("plugin create with no name in non-TTY mode exits 1 with error message", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("plugin-create-noname");
    try {
      const { stderr, exitCode } = await runCli(["plugin", "create"], projectDir, fakeHome);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("name is required");
    } finally {
      await cleanup();
    }
  });
});
