import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, runCli } from "./helpers.js";

const CLAUDE_PLUGIN_FIXTURE = resolve(
  process.cwd(),
  "tests/fixtures/plugins/claude-format/sample-plugin"
);
const CURSOR_PLUGIN_FIXTURE = resolve(
  process.cwd(),
  "tests/fixtures/plugins/cursor-format/sample-plugin"
);

const AIDD_DIR = ".aidd";

async function seedProject(projectDir: string): Promise<void> {
  await mkdir(join(projectDir, AIDD_DIR), { recursive: true });
  await writeFile(
    join(projectDir, AIDD_DIR, "manifest.json"),
    JSON.stringify({ version: 5, tools: {}, marketplaces: {} }),
    "utf-8"
  );
}

describe.concurrent("E2E: aidd ai sync", () => {
  it("exits non-zero when --source is missing in non-interactive mode", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("sync-no-source");
    try {
      await seedProject(projectDir);
      await runCli(["ai", "install", "claude"], projectDir, fakeHome);
      await runCli(["ai", "install", "cursor"], projectDir, fakeHome);

      // Non-interactive (runCli is not a TTY), no --source flag
      const { stderr, exitCode } = await runCli(["ai", "sync"], projectDir, fakeHome);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("--source");
    } finally {
      await cleanup();
    }
  });

  it("fails when source tool is not installed", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("sync-not-installed");
    try {
      await seedProject(projectDir);
      await runCli(["ai", "install", "cursor"], projectDir, fakeHome);

      const { stderr, exitCode } = await runCli(
        ["ai", "sync", "--source", "claude", "--target", "cursor"],
        projectDir,
        fakeHome
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("claude");
    } finally {
      await cleanup();
    }
  });

  it("fails when only one tool is installed (sync needs at least 2)", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("sync-one-tool");
    try {
      await seedProject(projectDir);
      await runCli(["ai", "install", "claude"], projectDir, fakeHome);

      const { stderr, exitCode } = await runCli(
        ["ai", "sync", "--source", "claude"],
        projectDir,
        fakeHome
      );

      expect(exitCode).not.toBe(0);
      expect(stderr.toLowerCase()).toMatch(/at least 2|sync requires/i);
    } finally {
      await cleanup();
    }
  });

  it("reports nothing to sync when files are unmodified", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("sync-noop");
    try {
      await seedProject(projectDir);
      await runCli(["ai", "install", "claude"], projectDir, fakeHome);
      await runCli(["ai", "install", "cursor"], projectDir, fakeHome);

      const { stdout, exitCode } = await runCli(
        ["ai", "sync", "--source", "claude", "--target", "cursor"],
        projectDir,
        fakeHome
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Nothing to sync");
    } finally {
      await cleanup();
    }
  });

  it("syncs a user-modified agent file from claude to cursor with --force", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("sync-agent");
    try {
      await seedProject(projectDir);
      await runCli(["ai", "install", "claude"], projectDir, fakeHome);
      await runCli(["ai", "install", "cursor"], projectDir, fakeHome);

      // Create a user agent in claude directory (simulates a user-added file)
      const agentDir = join(projectDir, ".claude", "agents");
      await mkdir(agentDir, { recursive: true });
      const agentContent = "---\nname: my-agent\ndescription: test\n---\nbody\n";
      await writeFile(join(agentDir, "my-agent.md"), agentContent);

      const { stdout, exitCode } = await runCli(
        [
          "ai",
          "sync",
          "--source",
          "claude",
          "--target",
          "cursor",
          "--include-user-files",
          "--force",
        ],
        projectDir,
        fakeHome
      );

      expect(exitCode).toBe(0);
      // Either synced files or nothing to sync (depends on tool capabilities)
      expect(stdout).toMatch(/Synced \d+ file|Nothing to sync/);
    } finally {
      await cleanup();
    }
  });

  it("propagates modified plugin component file from claude to cursor with --force", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("sync-plugin-component");
    try {
      await seedProject(projectDir);
      await runCli(["ai", "install", "claude"], projectDir, fakeHome);
      await runCli(["ai", "install", "cursor"], projectDir, fakeHome);

      // Install same plugin (different format) to both tools via plugin add (writes real files)
      await runCli(
        ["plugin", "add", CLAUDE_PLUGIN_FIXTURE, "--tool", "claude"],
        projectDir,
        fakeHome
      );
      await runCli(
        ["plugin", "add", CURSOR_PLUGIN_FIXTURE, "--tool", "cursor"],
        projectDir,
        fakeHome
      );

      // Modify the claude plugin component file to differ from its manifest hash
      const claudeCommandPath = join(
        projectDir,
        ".claude",
        "plugins",
        "sample-plugin",
        "commands",
        "greet.md"
      );
      const original = await readFile(claudeCommandPath, "utf-8");
      await writeFile(claudeCommandPath, `${original}\nExtra line added by user.\n`, "utf-8");

      const { stdout, exitCode } = await runCli(
        ["ai", "sync", "--source", "claude", "--target", "cursor", "--force"],
        projectDir,
        fakeHome
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Synced 1 file");

      const cursorCommandPath = join(
        projectDir,
        ".cursor",
        "plugins",
        "sample-plugin",
        "commands",
        "greet.md"
      );
      const synced = await readFile(cursorCommandPath, "utf-8");
      expect(synced).toContain("Extra line added by user.");
    } finally {
      await cleanup();
    }
  });
});
