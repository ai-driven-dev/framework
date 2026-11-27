import { existsSync } from "node:fs";
import { cp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseFrontmatter } from "../../../../src/shared/domain/markdown.js";
import { createTestEnv } from "../../../shared/testing/cli-sandbox.builder.js";
import { runInProcess } from "../../../shared/testing/in-process-cli.builder.js";
import { REPOSITORY_ROOT } from "../../../shared/testing/repository-root.builder.js";
import { FRAMEWORK_REAL, setupFromFixture } from "../../testing/fixture-setup.builder.js";
import { readJson, seedEmptyManifest } from "../../testing/project-state.builder.js";

const PLUGIN_FIXTURE = join(
  REPOSITORY_ROOT,
  "cli",
  "tests",
  "fixtures",
  "plugins",
  "claude-format",
  "sample-plugin"
);

let tempDir: string;
let project: string;
let home: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  ({ tempDir, projectDir: project, fakeHome: home, cleanup } = await createTestEnv("antigravity"));
});

afterEach(async () => {
  await cleanup();
});

const aidd = (args: string[]) => runInProcess(args, { cwd: project, home });

type ManifestWithPlugins = {
  tools: { antigravity: { plugins: { name: string; files: Record<string, unknown> }[] } };
};

async function installLocalPlugin(): Promise<void> {
  await seedEmptyManifest(project);
  const framework = await aidd(["framework", "install", "--tool", "antigravity"]);
  expect(framework.exitCode, framework.stderr).toBe(0);
  const plugin = await aidd(["plugin", "install", PLUGIN_FIXTURE, "--tool", "antigravity"]);
  expect(plugin.exitCode, plugin.stderr).toBe(0);
}

describe("antigravity installation and restoration use the same artifacts", () => {
  it("restores a missing hooks file from a local plugin without claiming its scripts twice", async () => {
    await installLocalPlugin();
    const hooksPath = join(project, ".agents/plugins/sample-plugin/hooks.json");
    expect(existsSync(hooksPath), "local installation delivers the hooks file").toBe(true);
    const installed = await readJson<Record<string, unknown>>(hooksPath);
    await rm(hooksPath);

    const sync = await aidd(["sync", "--force"]);

    expect(sync.exitCode, sync.stderr).toBe(0);
    expect(existsSync(hooksPath), "sync restores the missing hooks file").toBe(true);
    expect(await readJson<Record<string, unknown>>(hooksPath)).toEqual(installed);
    const manifest = await readJson<ManifestWithPlugins>(join(project, ".aidd/manifest.json"));
    const plugin = manifest.tools.antigravity.plugins.find(
      (entry) => entry.name === "sample-plugin"
    );
    expect(
      Object.keys(plugin?.files ?? {}).filter((path) => path.startsWith(".agents/hooks"))
    ).toEqual([]);
    expect(plugin).not.toHaveProperty("projectHooks");
    const again = await aidd(["sync"]);
    expect(again.exitCode, again.stderr).toBe(0);
  });

  it("installs and restores a local agent in the same portable shape as a build", async () => {
    await installLocalPlugin();
    const agentPath = join(project, ".agents/plugins/sample-plugin/agents/reviewer.md");
    const installed = await readFile(agentPath, "utf8");
    expect(parseFrontmatter(installed).frontmatter).toMatchObject({
      name: "sample-plugin-reviewer",
      description: expect.any(String),
      model: "inherit",
    });
    await rm(agentPath);

    const sync = await aidd(["sync", "--force"]);

    expect(sync.exitCode, sync.stderr).toBe(0);
    expect(await readFile(agentPath, "utf8")).toBe(installed);
  });

  it("records the plugin again when only the source hook changes", async () => {
    const framework = join(tempDir, "framework");
    await cp(FRAMEWORK_REAL, framework, { recursive: true });
    const setup = await aidd(setupFromFixture("antigravity", "aidd-context", [], framework));
    expect(setup.exitCode, setup.stderr).toBe(0);
    const manifestPath = join(project, ".aidd/manifest.json");
    const before = await readFile(manifestPath, "utf8");
    const sourceHook = join(framework, "plugins/aidd-context/hooks/update_memory.js");
    const updated = `${await readFile(sourceHook, "utf8")}\n// source update\n`;
    await writeFile(sourceHook, updated);

    const sync = await aidd(["sync"]);

    expect(sync.exitCode, sync.stderr).toBe(0);
    expect(
      await readFile(join(project, ".agents/plugins/aidd-context/hooks/update_memory.js"), "utf8")
    ).toBe(updated);
    expect(await readFile(manifestPath, "utf8")).not.toBe(before);
    const again = await aidd(["sync"]);
    expect(again.exitCode, again.stderr).toBe(0);
    const clean = await aidd(["clean"]);
    expect(clean.exitCode, clean.stderr).toBe(0);
  });

  it("leaves an unselected local agent untouched during a scoped sync", async () => {
    await installLocalPlugin();
    const agentPath = join(project, ".agents/plugins/sample-plugin/agents/reviewer.md");
    const edited = `${await readFile(agentPath, "utf8")}\nUser addition.\n`;
    await writeFile(agentPath, edited);

    const sync = await aidd([
      "sync",
      ".agents/plugins/sample-plugin/skills/hello/SKILL.md",
      "--tool",
      "antigravity",
      "--force",
    ]);

    expect(sync.exitCode, sync.stderr).toBe(0);
    expect(await readFile(agentPath, "utf8")).toBe(edited);
  });
});
