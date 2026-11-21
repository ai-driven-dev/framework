/** Builds an InstallPlugin over recorded delegates, a silent prompter and an in-memory manifest. */
import { join } from "node:path";
import { type Mock, vi } from "vitest";
import { TrustPluginSource } from "../../../src/contexts/distribution/application/plugin-source/trust-plugin-source.js";
import type { MarketplaceTrustStore } from "../../../src/contexts/distribution/ports/marketplace-trust-store.js";
import type { PluginAdd } from "../../../src/contexts/installation/application/plugin/add/plugin-add.js";
import { PlanPluginInstall } from "../../../src/contexts/installation/application/plugin/plan-plugin-install.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { ConfirmPluginSourceTrust } from "../../../src/orchestration/plugin/confirm-plugin-source-trust.js";
import type { PluginInstallFromMarketplace } from "../../../src/orchestration/plugin/install-from-marketplace.js";
import { InstallPlugin } from "../../../src/orchestration/plugin/install-plugin.js";
import type { PluginPick } from "../../../src/orchestration/plugin/pick-plugins.js";
import type { AiToolId } from "../../../src/shared/domain/tool.js";
import type { Prompter } from "../../../src/shared/ports/prompter.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { registeredTools } from "../../shared/testing/registered-tools.builder.js";

export const PLUGIN_FIXTURE = join(
  process.cwd(),
  "tests/fixtures/plugins/claude-format/sample-plugin"
);
export const PROJECT_ROOT = "/test-project";

export function manifestWith(toolId: AiToolId): InMemoryManifestRepository {
  const manifest = Manifest.create();
  manifest.addTool(toolId, "1.0.0", []);
  return new InMemoryManifestRepository(manifest, PROJECT_ROOT);
}

export function makeAlwaysTrustStore(): MarketplaceTrustStore {
  return {
    isTrusted: vi.fn().mockResolvedValue(true),
    trust: vi.fn().mockResolvedValue(undefined),
  };
}

export function makeSilentPrompter(): Prompter {
  return {
    confirm: vi.fn().mockResolvedValue(true),
    input: vi.fn().mockResolvedValue(""),
    select: vi.fn(),
    checkbox: vi.fn(),
    resolveConflict: vi.fn(),
    resolveConflictBulk: vi.fn(),
  };
}

export function makeUseCases(overrides?: {
  pickExecute?: Mock;
  addExecute?: Mock;
  marketplaceExecute?: Mock;
  trustStore?: MarketplaceTrustStore;
  prompter?: Prompter;
  manifestRepo?: InMemoryManifestRepository;
}) {
  const pickExecute = overrides?.pickExecute ?? vi.fn();
  const addExecute = overrides?.addExecute ?? vi.fn();
  const marketplaceExecute = overrides?.marketplaceExecute ?? vi.fn();
  const pickPlugins: PluginPick = { execute: pickExecute };
  const pluginAddUseCase: PluginAdd = { execute: addExecute };
  const pluginInstallFromMarketplaceUseCase: PluginInstallFromMarketplace = {
    execute: marketplaceExecute,
  };
  const manifestRepo = overrides?.manifestRepo ?? new InMemoryManifestRepository();
  const trustStore = overrides?.trustStore ?? makeAlwaysTrustStore();
  const prompter = overrides?.prompter ?? makeSilentPrompter();
  return {
    pickPlugins,
    pluginAddUseCase,
    pluginInstallFromMarketplaceUseCase,
    manifestRepo,
    trustStore,
    prompter,
    pickExecute,
    addExecute,
    marketplaceExecute,
  };
}

export function makeUseCase(overrides?: Parameters<typeof makeUseCases>[0]): InstallPlugin {
  const {
    pickPlugins,
    pluginAddUseCase,
    pluginInstallFromMarketplaceUseCase,
    manifestRepo,
    trustStore,
    prompter,
  } = makeUseCases(overrides);
  return new InstallPlugin({
    planPluginInstall: new PlanPluginInstall(manifestRepo, registeredTools()),
    pickPlugin: pickPlugins,
    addPlugin: pluginAddUseCase,
    installFromMarketplace: pluginInstallFromMarketplaceUseCase,
    trustPluginSource: new ConfirmPluginSourceTrust(new TrustPluginSource(trustStore), prompter),
  });
}
