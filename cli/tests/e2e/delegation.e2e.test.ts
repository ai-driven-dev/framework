import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, FRAMEWORK_PATH, runCli } from "./helpers.js";

describe("project delegation queries", () => {
  it("resolves a Copilot agent from the generated marketplace's declared plugin root", async () => {
    const { tempDir, projectDir, fakeHome, cleanup } = await createTestEnv(
      "delegation-copilot-build"
    );
    try {
      const market = join(tempDir, "market");
      const build = await runCli(
        ["translate", FRAMEWORK_PATH, "--to", "copilot", "--out", market],
        projectDir,
        fakeHome
      );
      expect(build.exitCode).toBe(0);
      const config = join(projectDir, ".aidd", "config.json");
      const personal = join(fakeHome, ".copilot");
      await mkdir(dirname(config), { recursive: true });
      await mkdir(personal, { recursive: true });
      await writeFile(
        config,
        JSON.stringify({ delegation: { review: { agent: "aidd-test:code-reviewer" } } })
      );
      await writeFile(
        join(personal, "settings.json"),
        JSON.stringify({
          enabledPlugins: { "aidd-test@market": true },
          extraKnownMarketplaces: { market: { source: { source: "directory", path: market } } },
        })
      );
      const result = await runCli(
        ["delegation", "resolve", "review", "--tool", "copilot", "--json"],
        projectDir,
        fakeHome
      );
      expect(result.exitCode, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout).agent).toEqual({
        name: "aidd-test:code-reviewer",
        path: join(market, "plugins", "aidd-test", "agents", "code-reviewer.md"),
        mode: "marketplace",
      });
    } finally {
      await cleanup();
    }
  });
  it("shows conflicting native Codex pins in default text output", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("delegation-pins");
    try {
      const config = join(projectDir, ".aidd", "config.json");
      const agent = join(projectDir, ".codex", "agents", "aidd-dev-explorer.toml");
      await mkdir(dirname(config), { recursive: true });
      await mkdir(dirname(agent), { recursive: true });
      await writeFile(
        config,
        JSON.stringify({
          delegation: {
            exploration: {
              agent: "aidd-dev:explorer",
              tools: { codex: { model: "requested-model" } },
            },
          },
        })
      );
      await writeFile(
        agent,
        'name = "aidd-dev-explorer"\nmodel = "pinned-model"\ndescription = "Explore"\ndeveloper_instructions = "Body"'
      );
      const result = await runCli(
        ["delegation", "resolve", "exploration", "--tool", "codex"],
        projectDir,
        fakeHome
      );
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain("pinned-model");
      expect(result.stderr).toContain("requested-model");
      expect(result.stdout).toContain(agent);
    } finally {
      await cleanup();
    }
  });

  it("rejects a disabled cached Claude plugin and accepts an explicit local enablement", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("delegation-activation");
    try {
      const config = join(projectDir, ".aidd", "config.json");
      const personal = join(fakeHome, ".claude");
      const plugins = join(personal, "plugins");
      const installed = join(plugins, "cache", "aidd-dev");
      const local = join(projectDir, ".claude", "settings.local.json");
      await mkdir(dirname(config), { recursive: true });
      await mkdir(join(installed, "agents"), { recursive: true });
      await mkdir(dirname(local), { recursive: true });
      await writeFile(
        config,
        JSON.stringify({ delegation: { exploration: { agent: "aidd-dev:explorer" } } })
      );
      await writeFile(join(installed, "agents", "explorer.md"), "---\nname: explorer\n---\nBody");
      await writeFile(
        join(plugins, "installed_plugins.json"),
        JSON.stringify({
          plugins: { "aidd-dev@market": [{ scope: "user", installPath: installed }] },
        })
      );
      await writeFile(
        join(personal, "settings.json"),
        JSON.stringify({ enabledPlugins: { "aidd-dev@market": false } })
      );
      const options = {
        env: { CLAUDE_CONFIG_DIR: personal, CLAUDE_CODE_PLUGIN_CACHE_DIR: plugins },
      };
      const disabled = await runCli(
        ["delegation", "resolve", "exploration", "--tool", "claude", "--json"],
        projectDir,
        fakeHome,
        options
      );
      expect(disabled.exitCode).toBe(1);
      expect(disabled.stderr).toContain("disabled");
      await writeFile(local, JSON.stringify({ enabledPlugins: { "aidd-dev@market": true } }));
      const enabled = await runCli(
        ["delegation", "resolve", "exploration", "--tool", "claude", "--json"],
        projectDir,
        fakeHome,
        options
      );
      expect(enabled.exitCode).toBe(0);
      expect(JSON.parse(enabled.stdout).agent).toMatchObject({
        name: "aidd-dev:explorer",
        path: join(installed, "agents", "explorer.md"),
        mode: "marketplace",
      });
    } finally {
      await cleanup();
    }
  });
  it("resolves a real installed agent, emits native suggestions, and never rewrites config", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("delegation");
    try {
      const path = join(projectDir, ".aidd", "config.json");
      const agent = join(projectDir, ".codex", "agents", "aidd-dev-explorer.toml");
      const raw =
        '{"telemetry":{"enabled":true},"custom":7,"delegation":{"exploration":{"agent":"aidd-dev:explorer","tools":{"codex":{"model":"user-model","effort":"high"}}}}}\n';
      await mkdir(dirname(path), { recursive: true });
      await mkdir(dirname(agent), { recursive: true });
      await writeFile(path, raw);
      await writeFile(
        agent,
        'name = "aidd-dev-explorer"\ndescription = "Explore"\ndeveloper_instructions = "Body"\n'
      );
      const result = await runCli(
        ["delegation", "resolve", "exploration", "--tool", "codex", "--json"],
        projectDir,
        fakeHome
      );
      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        configured: true,
        canonicalAgent: "aidd-dev:explorer",
        agent: { name: "aidd-dev-explorer", path: agent },
        requested: { model: "user-model", effort: "high" },
        native: { model: "user-model", model_reasoning_effort: "high" },
        effectiveRuntime: "unknown",
      });
      expect(await readFile(path, "utf8")).toBe(raw);
    } finally {
      await cleanup();
    }
  });

  it("reports inheritance for an absent task, and diagnoses malformed config on stderr", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("delegation-missing");
    try {
      const inherited = await runCli(
        ["delegation", "resolve", "exploration", "--tool", "codex", "--json"],
        projectDir,
        fakeHome
      );
      expect(inherited.exitCode).toBe(0);
      expect(JSON.parse(inherited.stdout)).toMatchObject({
        configured: false,
        requested: {},
        native: {},
      });
      const path = join(projectDir, ".aidd", "config.json");
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, "{");
      const failed = await runCli(
        ["delegation", "resolve", "exploration", "--tool", "codex"],
        projectDir,
        fakeHome
      );
      expect(failed.exitCode).toBe(1);
      expect(failed.stderr).toContain(path);
      expect(failed.stderr).toContain("valid JSON");
    } finally {
      await cleanup();
    }
  });
});
