import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AgentPluginHosts } from "../../../src/contexts/installation/application/agents/agent-plugin-hosts.js";
import { AgentProviders } from "../../../src/contexts/installation/application/agents/agent-providers.js";
import { MainSessionLocator } from "../../../src/contexts/installation/application/agents/main-session-locator.js";
import { MainSessionModels } from "../../../src/contexts/installation/application/agents/main-session-models.js";
import type { UpdatePluginCommand } from "../../../src/contexts/installation/application/plugin/update-plugin.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { InstalledPlugin } from "../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { AgentModelStoreAdapter } from "../../../src/contexts/installation/infrastructure/agent-model-store-adapter.js";
import { jsoncMainSessionSettings } from "../../../src/contexts/installation/infrastructure/jsonc-main-session-settings.js";
import { RefreshAgentPlugins } from "../../../src/orchestration/agent-models/refresh-agent-plugins.js";
import { SetAgentModels } from "../../../src/orchestration/agent-models/set-agent-models.js";
import type { SyncSettingsOptions } from "../../../src/orchestration/sync/sync-settings.js";
import { InMemoryManifestRepository } from "../../helpers/ports/in-memory-manifest-repository.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.js";
import { registeredTools, TOOL } from "../../shared/testing/registered-tools.js";

const PROJECT = "/p";
const HOME = "/home/me";
const CONFIG = "/home/me/.config/aidd";
const CLAUDE_SETTINGS = join(HOME, ".claude", "settings.json");
const OPENCODE_SETTINGS = join(HOME, ".config", "opencode", "opencode.jsonc");
const OPENCODE_SCHEMA = '"$schema": "https://opencode.ai/config.json"';

function plugin(scope: "project" | "user"): InstalledPlugin {
  return InstalledPlugin.fromJSON({
    name: "aidd-orchestrator",
    source: { kind: "local", path: "./orchestrator" },
    version: "1.0.0",
    strict: false,
    files: {},
    scope,
  });
}

function setup(
  seed?: (manifest: Manifest) => void,
  userManifest: Manifest | null = null,
  fs: InMemoryFileAdapter = new InMemoryFileAdapter(),
  env: (name: string) => string | undefined = () => undefined,
  updateFails = false
) {
  const manifest = Manifest.create();
  seed?.(manifest);
  const updates: UpdatePluginCommand[] = [];
  const userUpdates: UpdatePluginCommand[] = [];
  const activations: SyncSettingsOptions[] = [];
  const store = new AgentModelStoreAdapter(fs, () => CONFIG);
  const refresh = new RefreshAgentPlugins(
    new AgentPluginHosts(
      new InMemoryManifestRepository(manifest, PROJECT),
      new InMemoryManifestRepository(userManifest, CONFIG)
    ),
    {
      execute: async (options) => {
        if (updateFails) throw new Error("build failed");
        updates.push(options);
        return ["aidd-orchestrator"];
      },
    },
    {
      execute: async (options) => {
        userUpdates.push(options);
        return [];
      },
    },
    {
      execute: async (options) => {
        activations.push(options);
        return { activated: [], binaryMissing: [], warnings: [], errors: [], failed: false };
      },
    }
  );
  const tools = registeredTools();
  const mainSessions = new MainSessionModels(
    fs,
    store,
    jsoncMainSessionSettings,
    new MainSessionLocator(fs, () => HOME, { get: env }, tools)
  );
  const useCase = new SetAgentModels(new AgentProviders(store), mainSessions, refresh, tools);
  return { fs, useCase, updates, userUpdates, activations };
}

describe("SetAgentModels", () => {
  it("records the provider machine-wide, re-installs this project's plugins, then sets the main session", async () => {
    const { fs, useCase, updates, activations } = setup((manifest) => {
      manifest.addTool(TOOL.opencode, "1.0.0", []);
      manifest.addPlugin(TOOL.opencode, plugin("project"));
    });

    const result = await useCase.execute({
      projectRoot: PROJECT,
      hosts: [TOOL.opencode],
      provider: "mistral",
      scope: "project",
    });

    expect(fs.getFile(`${CONFIG}/agent-models.json`)).toBe('{\n  "opencode": "mistral"\n}\n');
    expect(updates).toStrictEqual([{ toolIds: ["opencode"], projectRoot: PROJECT, rebuild: true }]);
    expect(activations).toStrictEqual([{ projectRoot: PROJECT, toolIds: ["opencode"] }]);
    expect(result.reinstalled).toStrictEqual(["aidd-orchestrator"]);
  });

  it("sets the main session on its tier's model, and restores what it replaced once unset", async () => {
    const { fs, useCase } = setup();
    fs.setFile(CLAUDE_SETTINGS, '{\n  "model": "mine"\n}\n');

    const set = await useCase.execute({
      projectRoot: PROJECT,
      scope: "project",
      hosts: [TOOL.claude],
      provider: "anthropic",
    });
    expect(set).toStrictEqual({
      reinstalled: [],
      changed: [{ host: "claude", path: CLAUDE_SETTINGS }],
      skipped: [],
    });
    expect(fs.getFile(CLAUDE_SETTINGS)).toBe(
      '{\n  "model": "claude-sonnet-5-5",\n  "effortLevel": "medium"\n}\n'
    );

    const unset = await useCase.execute({
      projectRoot: PROJECT,
      scope: "project",
      hosts: [TOOL.claude],
    });
    expect(unset.changed).toStrictEqual([{ host: "claude", path: CLAUDE_SETTINGS }]);
    expect(fs.getFile(CLAUDE_SETTINGS)).toBe('{\n  "model": "mine"\n}\n');
    expect(fs.has(`${CONFIG}/main-model.json`)).toBe(false);
  });

  it("writes the main model in the host's user settings, never a project file", async () => {
    const { fs, useCase } = setup();

    const result = await useCase.execute({
      projectRoot: PROJECT,
      scope: "project",
      hosts: [TOOL.claude, TOOL.opencode, TOOL.cursor],
      provider: "anthropic",
    });

    expect(fs.getFile(OPENCODE_SETTINGS)).toBe(
      `{\n  ${OPENCODE_SCHEMA},\n  "model": "anthropic/claude-sonnet-5-5"\n}\n`
    );
    expect(result.changed).toStrictEqual([
      { host: "claude", path: CLAUDE_SETTINGS },
      { host: "opencode", path: OPENCODE_SETTINGS },
    ]);
    expect(fs.listAll().filter((path) => path.startsWith(`${PROJECT}/`))).toStrictEqual([]);
  });

  it("follows CLAUDE_CONFIG_DIR to the settings file Claude Code reads", async () => {
    const custom = join(HOME, "claude-config");
    const { fs, useCase } = setup(undefined, null, undefined, (name) =>
      name === "CLAUDE_CONFIG_DIR" ? custom : undefined
    );

    await useCase.execute({
      projectRoot: PROJECT,
      scope: "project",
      hosts: [TOOL.claude],
      provider: "anthropic",
    });

    expect(fs.has(join(custom, "settings.json"))).toBe(true);
    expect(fs.has(CLAUDE_SETTINGS)).toBe(false);
  });

  it("keeps a settings file's comments, setting then restoring only its model", async () => {
    const { fs, useCase } = setup();
    const base = { projectRoot: PROJECT, scope: "project" as const, hosts: [TOOL.opencode] };
    const commented = '{\n  // mine\n  "model": "opus",\n}\n';
    fs.setFile(OPENCODE_SETTINGS, commented);

    await useCase.execute({ ...base, provider: "openai" });
    expect(fs.getFile(OPENCODE_SETTINGS)).toBe(
      '{\n  // mine\n  "model": "openai/gpt-6.1-terra",\n}\n'
    );

    await useCase.execute({ ...base });
    expect(fs.getFile(OPENCODE_SETTINGS)).toBe(commented);
  });

  it("reports a settings file it cannot read as skipped", async () => {
    const { fs, useCase } = setup();
    fs.setFile(CLAUDE_SETTINGS, "// broken");

    const result = await useCase.execute({
      projectRoot: PROJECT,
      scope: "project",
      hosts: [TOOL.claude],
      provider: "anthropic",
    });

    expect(result.skipped).toStrictEqual([
      { host: "claude", path: CLAUDE_SETTINGS, reason: "it holds no JSON object" },
    ]);
  });

  it("refreshes this project globally too, and adds the machine-scope registrations", async () => {
    const userManifest = Manifest.create();
    userManifest.addTool(TOOL.claude, "1.0.0", []);
    const { useCase, updates, activations } = setup((manifest) => {
      manifest.addTool(TOOL.claude, "1.0.0", []);
      manifest.addPlugin(TOOL.claude, plugin("project"));
    }, userManifest);

    await useCase.execute({
      projectRoot: PROJECT,
      hosts: [TOOL.claude],
      provider: "anthropic",
      scope: "user",
    });

    expect(updates).toStrictEqual([{ toolIds: ["claude"], projectRoot: PROJECT, rebuild: true }]);
    expect(activations.map(({ toolIds, scope }) => ({ toolIds, scope }))).toStrictEqual([
      { toolIds: ["claude"], scope: undefined },
      { toolIds: ["claude"], scope: "user" },
    ]);
  });

  it("rewrites a plugin installed in the user's home whatever the scope", async () => {
    const userManifest = Manifest.create();
    userManifest.addTool(TOOL.cursor, "1.0.0", []);
    userManifest.addPlugin(TOOL.cursor, plugin("user"));
    const { useCase, userUpdates } = setup(undefined, userManifest);

    await useCase.execute({
      projectRoot: PROJECT,
      hosts: [TOOL.cursor],
      provider: "anthropic",
      scope: "project",
    });

    expect(userUpdates).toStrictEqual([
      { toolIds: ["cursor"], projectRoot: PROJECT, scope: "user", rebuild: true },
    ]);
  });

  it("resets the machine: restores every main session it changed and forgets the providers", async () => {
    const { fs, useCase } = setup();
    fs.setFile(CLAUDE_SETTINGS, '{\n  "model": "opus"\n}\n');
    const base = { projectRoot: PROJECT, scope: "project" as const };
    await useCase.execute({ ...base, hosts: [TOOL.claude, TOOL.opencode], provider: "anthropic" });

    const preview = await useCase.reset({ dryRun: true });
    expect(preview.providers).toStrictEqual(["claude", "opencode"]);
    expect(preview.changed.map(({ host }) => host)).toStrictEqual(["claude", "opencode"]);
    expect(fs.getFile(CLAUDE_SETTINGS)).toContain("claude-sonnet-5-5");

    await useCase.reset({ dryRun: false });
    expect(fs.getFile(CLAUDE_SETTINGS)).toBe('{\n  "model": "opus"\n}\n');
    expect(fs.has(OPENCODE_SETTINGS)).toBe(false);
    expect(fs.has(`${CONFIG}/agent-models.json`)).toBe(false);
    expect(fs.has(`${CONFIG}/main-model.json`)).toBe(false);
  });

  it("restores the file it wrote before when the host now reads another one", async () => {
    let configDir: string | undefined;
    const { fs, useCase } = setup(undefined, null, undefined, (name) =>
      name === "CLAUDE_CONFIG_DIR" ? configDir : undefined
    );
    const base = { projectRoot: PROJECT, scope: "project" as const, hosts: [TOOL.claude] };
    fs.setFile(CLAUDE_SETTINGS, '{\n  "model": "opus"\n}\n');
    await useCase.execute({ ...base, provider: "anthropic" });

    configDir = join(HOME, "claude-config");
    const moved = await useCase.execute({ ...base, provider: "anthropic" });

    const custom = join(HOME, "claude-config", "settings.json");
    expect(fs.getFile(CLAUDE_SETTINGS)).toBe('{\n  "model": "opus"\n}\n');
    expect(fs.getFile(custom)).toContain("claude-sonnet-5-5");
    expect(moved.changed.at(-1)).toStrictEqual({ host: "claude", path: custom });
  });

  it("puts the previous provider back when rebuilding this project's agents fails", async () => {
    const { fs, useCase } = setup((manifest) => {
      manifest.addTool(TOOL.opencode, "1.0.0", []);
      manifest.addPlugin(TOOL.opencode, plugin("project"));
    });
    const base = { projectRoot: PROJECT, scope: "project" as const, hosts: [TOOL.opencode] };
    await useCase.execute({ ...base, provider: "mistral" });
    const failing = setup(
      (manifest) => {
        manifest.addTool(TOOL.opencode, "1.0.0", []);
        manifest.addPlugin(TOOL.opencode, plugin("project"));
      },
      null,
      fs,
      undefined,
      true
    );

    await expect(failing.useCase.execute({ ...base, provider: "openai" })).rejects.toThrow(
      "build failed"
    );

    expect(fs.getFile(`${CONFIG}/agent-models.json`)).toBe('{\n  "opencode": "mistral"\n}\n');
    expect(fs.getFile(OPENCODE_SETTINGS)).toContain("mistral/mistral-large-4");
  });

  it("forgets the provider on reset even when a settings file cannot be restored", async () => {
    const { fs, useCase } = setup();
    await useCase.execute({
      projectRoot: PROJECT,
      scope: "project",
      hosts: [TOOL.claude],
      provider: "anthropic",
    });
    fs.setFile(CLAUDE_SETTINGS, "{ broken");

    const reset = await useCase.reset({ dryRun: false });

    expect(reset.skipped.map(({ host }) => host)).toStrictEqual(["claude"]);
    expect(fs.has(`${CONFIG}/agent-models.json`)).toBe(false);
  });

  it("refuses a provider one host cannot run before writing anything", async () => {
    const { fs, useCase } = setup();

    await expect(
      useCase.execute({
        projectRoot: PROJECT,
        hosts: [TOOL.opencode, TOOL.claude],
        provider: "mistral",
        scope: "project",
      })
    ).rejects.toThrow('Provider "mistral" is not supported for "claude". Use: anthropic.');
    expect(fs.listAll()).toStrictEqual([]);
  });

  it("refuses a provider for a host that runs no agent provider at all", async () => {
    const { fs, useCase } = setup();

    await expect(
      useCase.execute({
        projectRoot: PROJECT,
        hosts: [TOOL.antigravity],
        provider: "anthropic",
        scope: "project",
      })
    ).rejects.toThrow('No agent provider is supported for "antigravity".');
    expect(fs.listAll()).toStrictEqual([]);
  });
});
