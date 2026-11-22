/** Builds RunSetup over in-memory deps and no-op marketplace and plugin doubles, plus the non-interactive flow it runs. */

import { vi } from "vitest";
import { ListMarketplaces } from "../../../src/contexts/distribution/application/list-marketplaces.use-case.js";
import type { RegisterFrameworkMarketplace } from "../../../src/contexts/distribution/application/register-framework-marketplace.use-case.js";
import type { ResolveMarketplace } from "../../../src/contexts/distribution/application/resolve-marketplace.use-case.js";
import type { PluginCatalogEntry } from "../../../src/contexts/distribution/contract/catalog.js";
import { remoteFrameworkSource } from "../../../src/contexts/distribution/contract/framework-source.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../src/contexts/distribution/contract/marketplace.js";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import type { RepositoryVisibility } from "../../../src/contexts/distribution/ports/repository-visibility.js";
import { DetectProjectContext } from "../../../src/contexts/installation/application/detect-project-context.use-case.js";
import { ConfigureMachineScope } from "../../../src/contexts/installation/application/install/configure-machine-scope.use-case.js";
import { InstallTools } from "../../../src/contexts/installation/application/install/install-tools.use-case.js";
import type { ManifestRepository } from "../../../src/contexts/installation/ports/manifest-repository.js";
import type { UserSourceReferences } from "../../../src/contexts/machine-claims/ports/user-source-references.js";
import type { ToolCatalog } from "../../../src/contexts/tools/contract/tool-catalog.js";
import { SetupFlow } from "../../../src/orchestration/domain/setup-flow.model.js";
import type { RefreshMarketplaces } from "../../../src/orchestration/marketplace/refresh-marketplaces.use-case.js";
import type { PluginInstallFromMarketplace } from "../../../src/orchestration/plugin/install-from-marketplace.use-case.js";
import type { PluginPick } from "../../../src/orchestration/plugin/pick-plugins.use-case.js";
import type { InstallGlobalPlugins } from "../../../src/orchestration/setup/install-global-plugins.use-case.js";
import { SetupMachineScope } from "../../../src/orchestration/setup/setup-machine-scope.use-case.js";
import { ChoosePlugins } from "../../../src/orchestration/setup/steps/choose-plugins.use-case.js";
import type { ChooseTools } from "../../../src/orchestration/setup/steps/choose-tools.use-case.js";
import type { SyncSettings } from "../../../src/orchestration/sync/settings/sync-settings.use-case.js";
import type { Scope } from "../../../src/shared/domain/scope.js";
import type { ToolId } from "../../../src/shared/domain/tool.js";
import type { Lock } from "../../../src/shared/ports/lock.js";
import type { Logger } from "../../../src/shared/ports/logger.js";
import type { ReleaseLister } from "../../../src/shared/ports/release-lister.js";
import { InMemoryEnvironment } from "../../shared/testing/in-memory-environment.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { buildInstallationDeps } from "../../shared/testing/installation-deps.builder.js";
import { OverwritePrompter } from "../../shared/testing/scripted-prompter.fake.js";
import { askMarketplaceSource } from "../testing/ask-marketplace-source.builder.js";
import { runSetupOf } from "../testing/run-setup-of.builder.js";
import { setupMarketplaceRegistrar } from "../testing/setup-marketplace-registrar.builder.js";

export const CURRENT_VERSION = "0.0.0-test";

function makeNoOpLatestResolver(): ReleaseLister & RepositoryVisibility {
  return {
    listReleaseTags: vi.fn().mockResolvedValue([]),
    readReleaseBody: vi.fn().mockResolvedValue(null),
    isRepoPublic: vi.fn().mockResolvedValue(true),
  };
}

type RegisterFrameworkMock = Pick<RegisterFrameworkMarketplace, "execute"> & {
  execute: ReturnType<typeof vi.fn>;
};
type RefreshMock = Pick<RefreshMarketplaces, "execute"> & { execute: ReturnType<typeof vi.fn> };

function makeNoOpMarketplaceRegisterFramework(): RegisterFrameworkMock {
  const execute = vi.fn().mockResolvedValue({ registered: false, scope: "user" });
  return { execute };
}

function makeNoOpMarketplaceRefresh(): RefreshMock {
  const execute = vi.fn().mockResolvedValue({ results: [], failedCount: 0 });
  return { execute };
}

function makeNoOpMarketplaceSyncSettings(): Pick<SyncSettings, "execute"> {
  return { execute: vi.fn().mockResolvedValue({ updatedTools: [] }) };
}

function makeNoOpPluginPick(): PluginPick {
  return {
    execute: vi.fn().mockResolvedValue({ marketplace: FRAMEWORK_MARKETPLACE, installed: [] }),
  };
}

function makeNoOpPluginInstallFromMarketplace(): PluginInstallFromMarketplace {
  return {
    execute: vi
      .fn()
      .mockResolvedValue({ marketplace: FRAMEWORK_MARKETPLACE, entry: CATALOG_ENTRY }),
  };
}

function makeNoOpResolveMarketplace(): Pick<ResolveMarketplace, "execute"> {
  return {
    execute: vi
      .fn()
      .mockResolvedValue({ marketplace: FRAMEWORK_MARKETPLACE, localPath: "", catalog: null }),
  };
}

export const PROJECT_ROOT = "/test-project";

// Real values, not empty objects: a no-op double still has to answer with what its
// contract promises, so a caller that starts reading the answer breaks here first.
const FRAMEWORK_MARKETPLACE = Marketplace.create({
  name: FRAMEWORK_MARKETPLACE_NAME,
  source: { kind: "local", path: "/framework" },
  scope: "project",
  addedAt: "2026-08-20T00:00:00.000Z",
});

const CATALOG_ENTRY: PluginCatalogEntry = {
  name: "aidd-context",
  source: { kind: "local", path: "/framework/plugins/aidd-context" },
  recommended: false,
  strict: false,
};

export function makeRecordingUserSourceReferences(): UserSourceReferences & {
  added: Array<{ version: string; projectRoot: string }>;
} {
  const added: Array<{ version: string; projectRoot: string }> = [];
  return {
    added,
    addReference: vi.fn(async (version: string, projectRoot: string) => {
      added.push({ version, projectRoot });
    }),
    removeReference: vi.fn(async () => undefined),
    listAllReferencingProjects: vi.fn(async () => []),
  };
}

interface UseCaseOptions {
  userManifestRepo?: ManifestRepository & Lock;
  syncSettingsUseCase?: Pick<SyncSettings, "execute"> & {
    execute: ReturnType<typeof vi.fn>;
  };
  detectContext?: boolean;
  installGlobalPlugins?: Pick<InstallGlobalPlugins, "execute">;
}

interface UseCaseArgs {
  chooseTools?: Pick<ChooseTools, "execute">;
  userSourceReferences?: UserSourceReferences;
  logger?: Logger;
  options?: UseCaseOptions;
}

async function buildUseCaseOver(tools: ToolCatalog, args: UseCaseArgs) {
  const { chooseTools, userSourceReferences, logger, options } = args;
  const deps = await buildInstallationDeps({ tools });
  const prompter = new OverwritePrompter();
  const askSource = askMarketplaceSource(prompter, makeNoOpLatestResolver());
  const setupToolsUseCase = new InstallTools(
    deps.manifestRepo,
    deps.installRuntimeConfigUseCase,
    deps.installIdeConfig
  );
  const pluginInstallFromMarketplace = makeNoOpPluginInstallFromMarketplace();
  const choosePlugins = new ChoosePlugins({
    pickPlugins: makeNoOpPluginPick(),
    pluginInstallFromMarketplaceUseCase: pluginInstallFromMarketplace,
    listMarketplaces: new ListMarketplaces(new InMemoryMarketplaceRegistry()),
    resolveMarketplaceUseCase: makeNoOpResolveMarketplace(),
  });
  const marketplaceRegisterFramework = makeNoOpMarketplaceRegisterFramework();
  const marketplaceRefresh = makeNoOpMarketplaceRefresh();
  const syncSettingsUseCase = options?.syncSettingsUseCase ?? makeNoOpMarketplaceSyncSettings();
  const setupMarketplaceRegistration = setupMarketplaceRegistrar(
    deps.fs,
    askSource,
    marketplaceRegisterFramework,
    marketplaceRefresh,
    CURRENT_VERSION,
    logger ?? deps.logger,
    new InMemoryEnvironment(),
    undefined,
    undefined,
    userSourceReferences
  );
  const machineScope =
    options?.userManifestRepo === undefined
      ? undefined
      : new SetupMachineScope({
          configureMachineScope: new ConfigureMachineScope(
            options.userManifestRepo,
            CURRENT_VERSION
          ),
          resolveSource: setupMarketplaceRegistration.resolveSource,
          register: setupMarketplaceRegistration.register,
          syncMachineScope: (syncOptions) => syncSettingsUseCase.execute(syncOptions),
          installPlugins: options.installGlobalPlugins ?? {
            execute: async () => ({ plugins: [] }),
          },
        });
  const useCase = runSetupOf({
    tools,
    fs: deps.fs,
    manifestRepo: deps.manifestRepo,
    ...setupMarketplaceRegistration,
    installTools: setupToolsUseCase,
    syncSettings: syncSettingsUseCase,
    version: CURRENT_VERSION,
    detectContext: options?.detectContext === true ? new DetectProjectContext(deps.fs) : undefined,
    machineScope,
    choosePlugins,
    chooseTools,
  });
  return {
    useCase,
    deps,
    marketplaceRegisterFramework,
    marketplaceRefresh,
    syncSettingsUseCase,
    pluginInstallFromMarketplace,
  };
}

function remoteFlowOver(
  tools: ToolCatalog,
  opts: Partial<{
    aiTools: ToolId[];
    ideTools: ToolId[];
    scope: Scope;
    pluginMode: "all" | "named";
    pluginNames: string[];
  }> = {}
): SetupFlow {
  return new SetupFlow({
    registeredToolIds: tools.idsInCanonicalOrder(),
    aiToolIds: tools.idsInCanonicalOrder("ai"),
    ideToolIds: tools.idsInCanonicalOrder("ide"),
    supportsUserScopeActivation: () => true,
    projectRoot: PROJECT_ROOT,
    source: remoteFrameworkSource(),
    aiTools: opts.aiTools ?? [],
    ideTools: opts.ideTools ?? [],
    pluginMode: opts.pluginMode ?? "none",
    pluginNames: opts.pluginNames,
    interactive: false,
    scope: opts.scope,
  });
}

/** The scenario's use case and flow, over the catalog its test names. */
export function runSetupScenarioOf(tools: ToolCatalog) {
  return {
    buildUseCase: (
      chooseTools?: Pick<ChooseTools, "execute">,
      userSourceReferences?: UserSourceReferences,
      logger?: Logger,
      options?: UseCaseOptions
    ) => buildUseCaseOver(tools, { chooseTools, userSourceReferences, logger, options }),
    remoteFlow: (opts?: Parameters<typeof remoteFlowOver>[1]) => remoteFlowOver(tools, opts),
  };
}
