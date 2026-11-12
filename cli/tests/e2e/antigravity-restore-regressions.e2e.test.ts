import { existsSync } from "node:fs";
import { cp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseFrontmatter } from "../../src/kernel/markdown.js";
import { createTestEnv, initProject, runCli } from "./helpers.js";

const PLUGIN_FIXTURE = resolve("tests/fixtures/plugins/claude-format/sample-plugin");
const FRAMEWORK_FIXTURE = resolve("tests/fixtures/framework-real");
type TestEnv = Awaited<ReturnType<typeof createTestEnv>>;

async function installLocalPlugin(test: TestEnv): Promise<void> {
  await initProject(test.projectDir, FRAMEWORK_FIXTURE);
  const framework = await runCli(
    ["framework", "install", "--tool", "antigravity"],
    test.projectDir,
    test.fakeHome
  );
  expect(framework.exitCode, framework.stderr).toBe(0);
  const plugin = await runCli(
    ["plugin", "install", PLUGIN_FIXTURE, "--tool", "antigravity"],
    test.projectDir,
    test.fakeHome
  );
  expect(plugin.exitCode, plugin.stderr).toBe(0);
}

describe("E2E: Antigravity installation and restoration use the same artifacts", () => {
  it("restores a missing hooks file from a local plugin without claiming its scripts twice", async () => {
    const test = await createTestEnv("antigravity-local-hooks-restore");
    try {
      await installLocalPlugin(test);
      const hooksPath = join(test.projectDir, ".agents/hooks.json");
      expect(existsSync(hooksPath), "local installation delivers the hooks file").toBe(true);
      const installed = JSON.parse(await readFile(hooksPath, "utf8"));
      await rm(hooksPath);

      const sync = await runCli(["sync", "--force"], test.projectDir, test.fakeHome);

      expect(sync.exitCode, sync.stderr).toBe(0);
      expect(existsSync(hooksPath), "sync restores the missing hooks file").toBe(true);
      expect(JSON.parse(await readFile(hooksPath, "utf8"))).toEqual(installed);
      const manifest = JSON.parse(
        await readFile(join(test.projectDir, ".aidd/manifest.json"), "utf8")
      );
      const plugin = manifest.tools.antigravity.plugins.find(
        (entry: { name: string }) => entry.name === "sample-plugin"
      );
      expect(Object.keys(plugin.files).filter((path) => path.startsWith(".agents/hooks/"))).toEqual(
        []
      );
      const again = await runCli(["sync"], test.projectDir, test.fakeHome);
      expect(again.exitCode, again.stderr).toBe(0);
    } finally {
      await test.cleanup();
    }
  });

  it("installs and restores a local agent in the same portable shape as a flat build", async () => {
    const test = await createTestEnv("antigravity-local-agent");
    try {
      await installLocalPlugin(test);
      const agentPath = join(test.projectDir, ".agents/agents/sample-plugin-reviewer/agent.md");
      const installed = await readFile(agentPath, "utf8");
      expect(parseFrontmatter(installed).frontmatter).toMatchObject({
        name: "sample-plugin-reviewer",
        description: expect.any(String),
        model: "inherit",
      });
      await rm(agentPath);

      const sync = await runCli(["sync", "--force"], test.projectDir, test.fakeHome);

      expect(sync.exitCode, sync.stderr).toBe(0);
      expect(await readFile(agentPath, "utf8")).toBe(installed);
    } finally {
      await test.cleanup();
    }
  });

  it("persists hook provenance when only the source hook changes", async () => {
    const test = await createTestEnv("antigravity-hook-provenance");
    try {
      const framework = join(test.tempDir, "framework");
      await cp(FRAMEWORK_FIXTURE, framework, { recursive: true });
      const setup = await runCli(
        [
          "setup",
          "--source",
          "local",
          "--path",
          framework,
          "--ai",
          "antigravity",
          "--plugins",
          "aidd-context",
          "--yes",
        ],
        test.projectDir,
        test.fakeHome
      );
      expect(setup.exitCode, setup.stderr).toBe(0);
      const manifestPath = join(test.projectDir, ".aidd/manifest.json");
      const before = await readFile(manifestPath, "utf8");
      const sourceHook = join(framework, "plugins/aidd-context/hooks/update_memory.js");
      const updated = `${await readFile(sourceHook, "utf8")}\n// source update\n`;
      await writeFile(sourceHook, updated);

      const sync = await runCli(["sync"], test.projectDir, test.fakeHome);

      expect(sync.exitCode, sync.stderr).toBe(0);
      expect(
        await readFile(join(test.projectDir, ".agents/hooks/aidd-context/update_memory.js"), "utf8")
      ).toBe(updated);
      expect(await readFile(manifestPath, "utf8")).not.toBe(before);
      const again = await runCli(["sync"], test.projectDir, test.fakeHome);
      expect(again.exitCode, again.stderr).toBe(0);
      const clean = await runCli(["clean"], test.projectDir, test.fakeHome);
      expect(clean.exitCode, clean.stderr).toBe(0);
    } finally {
      await test.cleanup();
    }
  });

  it("leaves an unselected local agent untouched during a scoped sync", async () => {
    const test = await createTestEnv("antigravity-selected-sync");
    try {
      await installLocalPlugin(test);
      const agentPath = join(test.projectDir, ".agents/agents/sample-plugin-reviewer/agent.md");
      const edited = `${await readFile(agentPath, "utf8")}\nUser addition.\n`;
      await writeFile(agentPath, edited);

      const sync = await runCli(
        ["sync", ".agents/skills/sample-plugin-hello/SKILL.md", "--tool", "antigravity", "--force"],
        test.projectDir,
        test.fakeHome
      );

      expect(sync.exitCode, sync.stderr).toBe(0);
      expect(await readFile(agentPath, "utf8")).toBe(edited);
    } finally {
      await test.cleanup();
    }
  });
});
