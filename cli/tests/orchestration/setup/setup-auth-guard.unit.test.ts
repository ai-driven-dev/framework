import { describe, expect, it, vi } from "vitest";
import type { TokenProvider } from "../../../src/contexts/auth/contract/token-provider.js";
import { ListMarketplaces } from "../../../src/contexts/distribution/application/list-marketplaces.js";
import type { RefreshMarketplace } from "../../../src/contexts/distribution/application/refresh-marketplace.js";
import type { RegisterFrameworkMarketplace } from "../../../src/contexts/distribution/application/register-framework-marketplace.js";
import type { ResolveMarketplace } from "../../../src/contexts/distribution/application/resolve-marketplace.js";
import {
  localFrameworkSource,
  remoteFrameworkSource,
} from "../../../src/contexts/distribution/contract/framework-source.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../src/contexts/distribution/contract/marketplace.js";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import type { RepositoryVisibility } from "../../../src/contexts/distribution/ports/repository-visibility.js";
import { InstallTools } from "../../../src/contexts/installation/application/install/install-tools.js";
import type { PluginInstallFromMarketplace } from "../../../src/orchestration/plugin/install-from-marketplace.js";
import type { PluginPick } from "../../../src/orchestration/plugin/pick-plugins.js";
import { SetupFlow } from "../../../src/orchestration/setup/setup-flow.js";
import { ChoosePlugins } from "../../../src/orchestration/setup/steps/choose-plugins.js";
import type { SyncSettings } from "../../../src/orchestration/sync/sync-settings.js";
import { CatalogFetchAuthError } from "../../../src/shared/domain/errors.js";
import type { ReleaseLister } from "../../../src/shared/ports/release-lister.js";
import { buildInstallationDeps } from "../../contexts/installation/testing/installation-deps.js";
import { InMemoryMarketplaceRegistry } from "../../helpers/ports/in-memory-marketplace-registry.js";
import { FakeCurrentVersion } from "../../shared/testing/fake-current-version.fake.js";
import { InMemoryEnvironment } from "../../shared/testing/in-memory-environment.fake.js";
import { flowTools } from "../../shared/testing/registered-tools.builder.js";
import { OverwritePrompter } from "../../shared/testing/scripted-prompter.fake.js";
import { askMarketplaceSource } from "../testing/ask-marketplace-source.js";
import { runSetupOf } from "../testing/run-setup-of.js";
import { setupMarketplaceRegistrar } from "../testing/setup-marketplace-registrar.js";

const CURRENT_VERSION = new FakeCurrentVersion();

function makeReleaseResolver(isPublic: boolean): ReleaseLister & RepositoryVisibility {
  return {
    listReleaseTags: vi.fn().mockResolvedValue([]),
    readReleaseBody: vi.fn().mockResolvedValue(null),
    isRepoPublic: vi.fn().mockResolvedValue(isPublic),
  };
}

// Real values, not empty objects: a no-op double still has to answer with what its
// contract promises, so a caller that starts reading the answer breaks here first.
const FRAMEWORK_MARKETPLACE = Marketplace.create({
  name: FRAMEWORK_MARKETPLACE_NAME,
  source: { kind: "local", path: "/framework" },
  scope: "project",
  addedAt: "2026-08-20T00:00:00.000Z",
});

function makeNoOpPluginPick(): PluginPick {
  return {
    execute: vi.fn().mockResolvedValue({ marketplace: FRAMEWORK_MARKETPLACE, installed: [] }),
  };
}

function makeNoOpPluginInstallFromMarketplace(): PluginInstallFromMarketplace {
  return {
    execute: vi.fn().mockResolvedValue({
      marketplace: FRAMEWORK_MARKETPLACE,
      entry: {
        name: "aidd-context",
        source: { kind: "local", path: "/framework/plugins/aidd-context" },
        recommended: false,
        strict: false,
      },
    }),
  };
}

function makeNoOpResolveMarketplace(): Pick<ResolveMarketplace, "execute"> {
  return {
    execute: vi
      .fn()
      .mockResolvedValue({ marketplace: FRAMEWORK_MARKETPLACE, localPath: "", catalog: null }),
  };
}

function makeNoOpRegisterFramework(): Pick<RegisterFrameworkMarketplace, "execute"> {
  return { execute: vi.fn().mockResolvedValue({ registered: false, scope: "user" }) };
}

function makeNoOpRefresh(): Pick<RefreshMarketplace, "execute"> {
  return { execute: vi.fn().mockResolvedValue({ results: [], failedCount: 0 }) };
}

function makeNoOpSyncSettings(): Pick<SyncSettings, "execute"> {
  return { execute: vi.fn().mockResolvedValue({ updatedTools: [] }) };
}

function makeTokenProvider(token: string | null): TokenProvider {
  return { resolve: vi.fn().mockResolvedValue(token) };
}

const PROJECT_ROOT = "/test-project";

async function buildSetupUseCase(tokenProvider: TokenProvider, isRepoPublic = false) {
  const deps = await buildInstallationDeps();
  const prompter = new OverwritePrompter();
  const askSource = askMarketplaceSource(prompter, makeReleaseResolver(true));
  const setupToolsUseCase = new InstallTools(
    deps.manifestRepo,
    deps.installRuntimeConfigUseCase,
    deps.installIdeConfig
  );
  const choosePlugins = new ChoosePlugins(
    makeNoOpPluginPick(),
    makeNoOpPluginInstallFromMarketplace(),
    new ListMarketplaces(new InMemoryMarketplaceRegistry()),
    makeNoOpResolveMarketplace()
  );
  const setupMarketplaceRegistration = setupMarketplaceRegistrar(
    deps.fs,
    askSource,
    makeNoOpRegisterFramework(),
    makeNoOpRefresh(),
    CURRENT_VERSION,
    deps.logger,
    new InMemoryEnvironment(),
    tokenProvider,
    makeReleaseResolver(isRepoPublic)
  );
  return runSetupOf(
    deps.fs,
    deps.manifestRepo,
    {
      registration: setupMarketplaceRegistration,
      installTools: setupToolsUseCase,
      syncSettings: (options) => makeNoOpSyncSettings().execute(options),
      version: CURRENT_VERSION,
    },
    { plugins: (options) => choosePlugins.execute(options) }
  );
}

describe("RunSetup — auth guard for remote source", () => {
  it("throws CatalogFetchAuthError when source is remote, no token, and repo is private", async () => {
    const useCase = await buildSetupUseCase(makeTokenProvider(null), false);

    const flow = new SetupFlow({
      ...flowTools(),
      supportsUserScopeActivation: () => true,
      projectRoot: PROJECT_ROOT,
      source: remoteFrameworkSource(),
      interactive: false,
    });

    await expect(useCase.execute(flow)).rejects.toThrow(CatalogFetchAuthError);
  });

  it("proceeds when source is remote, no token, but repo is public", async () => {
    const useCase = await buildSetupUseCase(makeTokenProvider(null), true);

    const flow = new SetupFlow({
      ...flowTools(),
      supportsUserScopeActivation: () => true,
      projectRoot: PROJECT_ROOT,
      source: remoteFrameworkSource(),
      interactive: false,
    });

    await expect(useCase.execute(flow)).resolves.toBeDefined();
  });

  it("proceeds without error when source is remote and a token is present", async () => {
    const useCase = await buildSetupUseCase(makeTokenProvider("ghp_valid-token"));

    const flow = new SetupFlow({
      ...flowTools(),
      supportsUserScopeActivation: () => true,
      projectRoot: PROJECT_ROOT,
      source: remoteFrameworkSource(),
      interactive: false,
    });

    await expect(useCase.execute(flow)).resolves.toBeDefined();
  });

  it("proceeds without error when source is local (no token required)", async () => {
    const useCase = await buildSetupUseCase(makeTokenProvider(null));

    const flow = new SetupFlow({
      ...flowTools(),
      supportsUserScopeActivation: () => true,
      projectRoot: PROJECT_ROOT,
      source: localFrameworkSource("/some/path"),
      interactive: false,
    });

    await expect(useCase.execute(flow)).resolves.toBeDefined();
  });
});
