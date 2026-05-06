import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, FRAMEWORK_PATH, initProject, runCli } from "./helpers.js";

const PLUGIN_FIXTURE = resolve(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");

// TODO(feat/cli-v5-cleanup follow-up): rewrite setup with `aidd ai install <tool>`.
// All tests use the removed `install ai <tool> --path` command.
describe.skip("E2E: aidd plugin", () => {
  it("plugin add → installs files for claude tool", async () => {
    const { projectDir, cleanup } = await createTestEnv("plugin-add");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(
        ["install", "ai", "claude", "--path", FRAMEWORK_PATH, "--no-plugins"],
        projectDir
      );
      const { stdout, exitCode } = await runCli(
        ["plugin", "add", PLUGIN_FIXTURE, "--tool", "claude"],
        projectDir
      );
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Plugin added");
      expect(existsSync(join(projectDir, ".claude/plugins/sample-plugin/commands/greet.md"))).toBe(
        true
      );
      expect(existsSync(join(projectDir, ".claude/plugins/sample-plugin/plugin.json"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("plugin list → shows installed plugin under tool", async () => {
    const { projectDir, cleanup } = await createTestEnv("plugin-list");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(
        ["install", "ai", "claude", "--path", FRAMEWORK_PATH, "--no-plugins"],
        projectDir
      );
      await runCli(["plugin", "add", PLUGIN_FIXTURE, "--tool", "claude"], projectDir);
      const { stdout, exitCode } = await runCli(["plugin", "list"], projectDir);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("claude:");
      expect(stdout).toContain("sample-plugin@1.0.0");
    } finally {
      await cleanup();
    }
  });

  it("plugin update → reports up-to-date when versions match", async () => {
    const { projectDir, cleanup } = await createTestEnv("plugin-update-noop");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(
        ["install", "ai", "claude", "--path", FRAMEWORK_PATH, "--no-plugins"],
        projectDir
      );
      await runCli(["plugin", "add", PLUGIN_FIXTURE, "--tool", "claude"], projectDir);
      const { stdout, exitCode } = await runCli(
        ["plugin", "update", "sample-plugin", "--tool", "claude"],
        projectDir
      );
      expect(exitCode).toBe(0);
      expect(stdout).toContain("up to date");
    } finally {
      await cleanup();
    }
  });

  it("plugin remove → deletes plugin files and unregisters from manifest", async () => {
    const { projectDir, cleanup } = await createTestEnv("plugin-remove");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(
        ["install", "ai", "claude", "--path", FRAMEWORK_PATH, "--no-plugins"],
        projectDir
      );
      await runCli(["plugin", "add", PLUGIN_FIXTURE, "--tool", "claude"], projectDir);
      const { stdout, exitCode } = await runCli(
        ["plugin", "remove", "sample-plugin", "--tool", "claude"],
        projectDir
      );
      expect(exitCode).toBe(0);
      expect(stdout).toContain("removed");
      expect(existsSync(join(projectDir, ".claude/plugins/sample-plugin/commands/greet.md"))).toBe(
        false
      );
      const list = await runCli(["plugin", "list"], projectDir);
      expect(list.stdout).toContain("No plugins installed");
    } finally {
      await cleanup();
    }
  });

  it("plugin add → cross-format translation: claude source → cursor target produces .mdc-aware paths", async () => {
    const { projectDir, cleanup } = await createTestEnv("plugin-cross-format");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      // Install both claude and cursor
      const cursorInstall = await runCli(
        ["install", "ai", "cursor", "--path", FRAMEWORK_PATH, "--no-plugins"],
        projectDir
      );
      expect(cursorInstall.exitCode).toBe(0);
      const { exitCode } = await runCli(["plugin", "add", PLUGIN_FIXTURE], projectDir);
      expect(exitCode).toBe(0);
      expect(existsSync(join(projectDir, ".cursor/plugins/sample-plugin/plugin.json"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("plugin add → hooks.json converted to cursor format for cursor tool", async () => {
    const { projectDir, cleanup } = await createTestEnv("plugin-cursor-hooks");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(
        ["install", "ai", "cursor", "--path", FRAMEWORK_PATH, "--no-plugins"],
        projectDir
      );
      const { exitCode } = await runCli(
        ["plugin", "add", PLUGIN_FIXTURE, "--tool", "cursor"],
        projectDir
      );
      expect(exitCode).toBe(0);

      const hooksPath = join(projectDir, ".cursor/plugins/sample-plugin/hooks/hooks.json");
      expect(existsSync(hooksPath)).toBe(true);

      const content = JSON.parse(await readFile(hooksPath, "utf-8")) as {
        hooks: Record<string, unknown[]>;
      };
      expect(content).toHaveProperty("hooks");
      expect(Object.keys(content.hooks)).toContain("sessionStart");
      expect(Object.keys(content.hooks)).not.toContain("SessionStart");
      const items = content.hooks.sessionStart;
      expect(items).toHaveLength(1);
      const item = items[0] as { command: string };
      expect(item.command).toBe("node ./hooks/update_memory.js");
    } finally {
      await cleanup();
    }
  });

  it("plugin install → from marketplace by name", async () => {
    const { tempDir, projectDir, cleanup } = await createTestEnv("plugin-market-install");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      await runCli(
        ["install", "ai", "claude", "--path", FRAMEWORK_PATH, "--no-plugins"],
        projectDir
      );

      const marketDir = join(tempDir, "market");
      await mkdir(join(marketDir, ".claude-plugin"), { recursive: true });
      await writeFile(
        join(marketDir, ".claude-plugin", "marketplace.json"),
        JSON.stringify({
          plugins: [
            {
              name: "sample-plugin",
              source: { kind: "local", path: PLUGIN_FIXTURE },
              version: "1.0.0",
            },
          ],
        })
      );
      await runCli(["marketplace", "add", "local", marketDir, "--yes"], projectDir);

      const { stdout, exitCode } = await runCli(
        ["plugin", "install", "sample-plugin", "--tool", "claude"],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("sample-plugin");
      expect(existsSync(join(projectDir, ".claude/plugins/sample-plugin/plugin.json"))).toBe(false);
    } finally {
      await cleanup();
    }
  });

  it("plugin add → fails with non-existent local source", async () => {
    const { projectDir, cleanup } = await createTestEnv("plugin-bad-source");
    try {
      await initProject(projectDir, FRAMEWORK_PATH);
      const { stderr, exitCode } = await runCli(
        ["plugin", "add", "/nonexistent/path/to/plugin", "--tool", "claude"],
        projectDir
      );
      expect(exitCode).not.toBe(0);
      expect(stderr).toMatch(/(does not exist|not found|invalid)/i);
    } finally {
      await cleanup();
    }
  });
});
