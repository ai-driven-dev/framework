import { join } from "node:path";
import { LocateAgentPlugins } from "../../../src/contexts/installation/application/agents/locate-agent-plugins.use-case.js";
import { LocateMainSession } from "../../../src/contexts/installation/application/agents/locate-main-session.use-case.js";
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
import { ResetAgentModels } from "../../../src/orchestration/agent-models/reset-agent-models.use-case.js";
import { SetAgentModels } from "../../../src/orchestration/agent-models/set-agent-models.use-case.js";
import type { SyncSettingsRequest } from "../../../src/orchestration/domain/sync-settings.model.js";
import type { Scope } from "../../../src/shared/domain/scope.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { HOST_MCP_SCHEMA, hostCatalog, hostMcpGlobalDir } from "./synthetic-hosts.builder.js";

export const PROJECT = "/p";
export const HOME = "/home/me";
export const CONFIG = "/home/me/.config/aidd";
export const CLAUDE_SETTINGS = join(HOME, ".hostclaude", "settings.json");
export const OPENCODE_SETTINGS = join(hostMcpGlobalDir(HOME), "hostmcp.jsonc");
export const OPENCODE_SCHEMA = `"$schema": "${HOST_MCP_SCHEMA}"`;

export function plugin(scope: Scope): RecordedPlugin {
  return RecordedPlugin.fromJSON({
    name: "aidd-orchestrator",
    source: { kind: "local", path: "./orchestrator" },
    version: "1.0.0",
    strict: false,
    files: {},
    scope,
  });
}

export function setup(
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
    pluginHosts: new LocateAgentPlugins(
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
    mainSessionLocator: new LocateMainSession(
      { fs, homedir: () => HOME, environment: { get: env } },
      tools
    ),
  });
  const restoreProviders = new RestoreAgentProviders(store);
  const useCase = new SetAgentModels({
    recordProviders: new RecordAgentProviders(store, tools),
    restoreProviders,
    mainSessions,
    refresh,
  });
  const reset = new ResetAgentModels({
    restoreProviders,
    restoreMainSessions: new RestoreMainSessionModels(store, mainSessions),
  });
  return { fs, useCase, reset, updates, userUpdates, activations };
}
