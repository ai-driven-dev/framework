import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AgentPluginHosts } from "../../../src/contexts/installation/application/agents/agent-plugin-hosts.js";
import { MainSessionLocator } from "../../../src/contexts/installation/application/agents/main-session-locator.js";
import { MainSessionModels } from "../../../src/contexts/installation/application/agents/main-session-models.use-case.js";
import { RecordAgentProviders } from "../../../src/contexts/installation/application/agents/record-agent-providers.use-case.js";
import { RestoreAgentProviders } from "../../../src/contexts/installation/application/agents/restore-agent-providers.use-case.js";
import { RestoreMainSessionModels } from "../../../src/contexts/installation/application/agents/restore-main-session-models.use-case.js";
import type { UpdatePluginRequest } from "../../../src/contexts/installation/application/plugin/update-plugin.use-case.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { AgentModelStoreAdapter } from "../../../src/contexts/installation/infrastructure/agent-model-store-adapter.js";
import { jsoncMainSessionSettings } from "../../../src/contexts/installation/infrastructure/jsonc-main-session-settings.js";
import { RefreshAgentPlugins } from "../../../src/orchestration/agent-models/refresh-agent-plugins.use-case.js";
import { SetAgentModels } from "../../../src/orchestration/agent-models/set-agent-models.use-case.js";
import type { SyncSettingsRequest } from "../../../src/orchestration/domain/sync-settings.model.js";
import type { Scope } from "../../../src/shared/domain/scope.js";
import { aManifest } from "../../contexts/installation/testing/manifest.builder.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import {
  HOST,
  HOST_CONFIG_DIR_ENV,
  HOST_MCP_SCHEMA,
  hostCatalog,
  hostMcpGlobalDir,
} from "../testing/synthetic-hosts.builder.js";

const PROJECT = "/p";
const HOME = "/home/me";
const CONFIG = "/home/me/.config/aidd";
const CLAUDE_SETTINGS = join(HOME, ".hostclaude", "settings.json");
const OPENCODE_SETTINGS = join(hostMcpGlobalDir(HOME), "hostmcp.jsonc");
const OPENCODE_SCHEMA = `"$schema": "${HOST_MCP_SCHEMA}"`;

function plugin(scope: Scope): RecordedPlugin {
  return RecordedPlugin.fromJSON({
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
  const updates: UpdatePluginRequest[] = [];
  const userUpdates: UpdatePluginRequest[] = [];
  const activations: SyncSettingsRequest[] = [];
  const store = new AgentModelStoreAdapter(fs, () => CONFIG);
  const refresh = new RefreshAgentPlugins({
    pluginHosts: new AgentPluginHosts(
      new InMemoryManifestRepository(manifest, PROJECT),
      new InMemoryManifestRepository(userManifest, CONFIG)
    ),
    updatePlugin: {
      execute: async (options) => {
        if (updateFails) throw new Error("build failed");
        updates.push(options);
        return ["aidd-orchestrator"];
      },
    },
    updateUserPlugin: {
      execute: async (options) => {
        userUpdates.push(options);
        return [];
      },
    },
    syncSettings: {
      execute: async (options) => {
        activations.push(options);
        return { activated: [], binaryMissing: [], warnings: [], errors: [], failed: false };
      },
    },
  });
  const tools = hostCatalog();
  const mainSessions = new MainSessionModels({
    fs,
    store,
    settings: jsoncMainSessionSettings,
    mainSessionLocator: new MainSessionLocator(
      { fs, homedir: () => HOME, environment: { get: env } },
      tools
    ),
  });
  const useCase = new SetAgentModels({
    recordProviders: new RecordAgentProviders(store, tools),
    restoreProviders: new RestoreAgentProviders(store),
    mainSessions,
    restoreMainSessions: new RestoreMainSessionModels(store, mainSessions),
    refresh,
  });
  return { fs, useCase, updates, userUpdates, activations };
}

describe("setting agent models", () => {
  it("records the provider machine-wide, re-installs this project's plugins, then sets the main session", async () => {
    const { fs, useCase, updates, activations } = setup((manifest) => {
      manifest.addTool(HOST.mcp, "1.0.0", []);
      manifest.addPlugin(HOST.mcp, plugin("project"));
    });

    const result = await useCase.execute({
      projectRoot: PROJECT,
      hosts: [HOST.mcp],
      provider: "mistral",
      scope: "project",
    });

    expect(fs.getFile(`${CONFIG}/agent-models.json`)).toBe(`{\n  "${HOST.mcp}": "mistral"\n}\n`);
    expect(updates).toStrictEqual([{ toolIds: [HOST.mcp], projectRoot: PROJECT, rebuild: true }]);
    expect(activations).toStrictEqual([{ projectRoot: PROJECT, toolIds: [HOST.mcp] }]);
    expect(result.reinstalled).toStrictEqual(["aidd-orchestrator"]);
  });

  it("sets the main session on its tier's model, and restores what it replaced once unset", async () => {
    const { fs, useCase } = setup();
    fs.setFile(CLAUDE_SETTINGS, '{\n  "model": "mine"\n}\n');

    const set = await useCase.execute({
      projectRoot: PROJECT,
      scope: "project",
      hosts: [HOST.claude],
      provider: "anthropic",
    });
    expect(set).toStrictEqual({
      reinstalled: [],
      changed: [{ host: HOST.claude, path: CLAUDE_SETTINGS }],
      skipped: [],
    });
    expect(fs.getFile(CLAUDE_SETTINGS)).toBe(
      '{\n  "model": "claude-sonnet-5-5",\n  "effortLevel": "medium"\n}\n'
    );

    const unset = await useCase.execute({
      projectRoot: PROJECT,
      scope: "project",
      hosts: [HOST.claude],
    });
    expect(unset.changed).toStrictEqual([{ host: HOST.claude, path: CLAUDE_SETTINGS }]);
    expect(fs.getFile(CLAUDE_SETTINGS)).toBe('{\n  "model": "mine"\n}\n');
    expect(fs.has(`${CONFIG}/main-model.json`)).toBe(false);
  });

  it("writes the main model in the host's user settings, never a project file", async () => {
    const { fs, useCase } = setup();

    const result = await useCase.execute({
      projectRoot: PROJECT,
      scope: "project",
      hosts: [HOST.claude, HOST.mcp, HOST.cursor],
      provider: "anthropic",
    });

    expect(fs.getFile(OPENCODE_SETTINGS)).toBe(
      `{\n  ${OPENCODE_SCHEMA},\n  "model": "anthropic/claude-sonnet-5-5"\n}\n`
    );
    expect(result.changed).toStrictEqual([
      { host: HOST.claude, path: CLAUDE_SETTINGS },
      { host: HOST.mcp, path: OPENCODE_SETTINGS },
    ]);
    expect(fs.listAll().filter((path) => path.startsWith(`${PROJECT}/`))).toStrictEqual([]);
  });

  it("follows CLAUDE_CONFIG_DIR to the settings file Claude Code reads", async () => {
    const custom = join(HOME, "claude-config");
    const { fs, useCase } = setup(undefined, null, undefined, (name) =>
      name === HOST_CONFIG_DIR_ENV ? custom : undefined
    );

    await useCase.execute({
      projectRoot: PROJECT,
      scope: "project",
      hosts: [HOST.claude],
      provider: "anthropic",
    });

    expect(fs.has(join(custom, "settings.json"))).toBe(true);
    expect(fs.has(CLAUDE_SETTINGS)).toBe(false);
  });

  it("refreshes this project globally too, and adds the machine-scope registrations", async () => {
    const userManifest = Manifest.create();
    userManifest.addTool(HOST.claude, "1.0.0", []);
    const { useCase, updates, activations } = setup((manifest) => {
      manifest.addTool(HOST.claude, "1.0.0", []);
      manifest.addPlugin(HOST.claude, plugin("project"));
    }, userManifest);

    await useCase.execute({
      projectRoot: PROJECT,
      hosts: [HOST.claude],
      provider: "anthropic",
      scope: "user",
    });

    expect(updates).toStrictEqual([
      { toolIds: [HOST.claude], projectRoot: PROJECT, rebuild: true },
    ]);
    expect(activations.map(({ toolIds, scope }) => ({ toolIds, scope }))).toStrictEqual([
      { toolIds: [HOST.claude], scope: undefined },
      { toolIds: [HOST.claude], scope: "user" },
    ]);
  });

  it("rewrites a plugin installed in the user's home whatever the scope", async () => {
    const userManifest = aManifest()
      .withTool(HOST.cursor, [])
      .withPlugin(HOST.cursor, plugin("user"))
      .build();
    const { useCase, userUpdates } = setup(undefined, userManifest);

    await useCase.execute({
      projectRoot: PROJECT,
      hosts: [HOST.cursor],
      provider: "anthropic",
      scope: "project",
    });

    expect(userUpdates).toStrictEqual([
      { toolIds: [HOST.cursor], projectRoot: PROJECT, scope: "user", rebuild: true },
    ]);
  });

  it("resets the machine: restores every main session it changed and forgets the providers", async () => {
    const { fs, useCase } = setup();
    fs.setFile(CLAUDE_SETTINGS, '{\n  "model": "opus"\n}\n');
    const base = { projectRoot: PROJECT, scope: "project" as const };
    await useCase.execute({ ...base, hosts: [HOST.claude, HOST.mcp], provider: "anthropic" });

    const preview = await useCase.reset({ dryRun: true });
    expect(preview.providers).toStrictEqual([HOST.claude, HOST.mcp]);
    expect(preview.changed.map(({ host }) => host)).toStrictEqual([HOST.claude, HOST.mcp]);
    expect(fs.getFile(CLAUDE_SETTINGS)).toContain("claude-sonnet-5-5");

    await useCase.reset({ dryRun: false });
    expect(fs.getFile(CLAUDE_SETTINGS)).toBe('{\n  "model": "opus"\n}\n');
    expect(fs.has(OPENCODE_SETTINGS)).toBe(false);
    expect(fs.has(`${CONFIG}/agent-models.json`)).toBe(false);
    expect(fs.has(`${CONFIG}/main-model.json`)).toBe(false);
  });

  it("puts the previous provider back when rebuilding this project's agents fails", async () => {
    const { fs, useCase } = setup((manifest) => {
      manifest.addTool(HOST.mcp, "1.0.0", []);
      manifest.addPlugin(HOST.mcp, plugin("project"));
    });
    const base = { projectRoot: PROJECT, scope: "project" as const, hosts: [HOST.mcp] };
    await useCase.execute({ ...base, provider: "mistral" });
    const failing = setup(
      (manifest) => {
        manifest.addTool(HOST.mcp, "1.0.0", []);
        manifest.addPlugin(HOST.mcp, plugin("project"));
      },
      null,
      fs,
      undefined,
      true
    );

    await expect(failing.useCase.execute({ ...base, provider: "openai" })).rejects.toThrow(
      "build failed"
    );

    expect(fs.getFile(`${CONFIG}/agent-models.json`)).toBe(`{\n  "${HOST.mcp}": "mistral"\n}\n`);
    expect(fs.getFile(OPENCODE_SETTINGS)).toContain("mistral/mistral-large-4");
  });

  it("forgets the provider on reset even when a settings file cannot be restored", async () => {
    const { fs, useCase } = setup();
    await useCase.execute({
      projectRoot: PROJECT,
      scope: "project",
      hosts: [HOST.claude],
      provider: "anthropic",
    });
    fs.setFile(CLAUDE_SETTINGS, "{ broken");

    const reset = await useCase.reset({ dryRun: false });

    expect(reset.skipped.map(({ host }) => host)).toStrictEqual([HOST.claude]);
    expect(fs.has(`${CONFIG}/agent-models.json`)).toBe(false);
  });

  it("refuses a provider one host cannot run before writing anything", async () => {
    const { fs, useCase } = setup();

    await expect(
      useCase.execute({
        projectRoot: PROJECT,
        hosts: [HOST.mcp, HOST.claude],
        provider: "mistral",
        scope: "project",
      })
    ).rejects.toThrow(`Provider "mistral" is not supported for "${HOST.claude}". Use: anthropic.`);
    expect(fs.listAll()).toStrictEqual([]);
  });

  it("refuses a provider for a host that runs no agent provider at all", async () => {
    const { fs, useCase } = setup();

    await expect(
      useCase.execute({
        projectRoot: PROJECT,
        hosts: [HOST.copilot],
        provider: "anthropic",
        scope: "project",
      })
    ).rejects.toThrow(`No agent provider is supported for "${HOST.copilot}".`);
    expect(fs.listAll()).toStrictEqual([]);
  });
});
