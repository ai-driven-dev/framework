import { describe, expect, it, vi } from "vitest";
import { ListMarketplaces } from "../../../src/contexts/distribution/application/list-marketplaces.js";
import type { RefreshMarketplace } from "../../../src/contexts/distribution/application/refresh-marketplace.js";
import type { RegisterFrameworkMarketplace } from "../../../src/contexts/distribution/application/register-framework-marketplace.js";
import { remoteFrameworkSource } from "../../../src/contexts/distribution/contract/framework-source.js";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import type { ReleaseLister } from "../../../src/contexts/distribution/ports/release-lister.js";
import type { RepositoryVisibility } from "../../../src/contexts/distribution/ports/repository-visibility.js";
import { InstallTools } from "../../../src/contexts/installation/application/install/install-tools.js";
import type { PluginInstallFromMarketplace } from "../../../src/orchestration/plugin/install-from-marketplace.js";
import { SetupFlow } from "../../../src/orchestration/setup/setup-flow.js";
import { SetupPluginsPromptUseCase } from "../../../src/presentation/prompts/setup-plugins-prompt-use-case.js";
import type { ToolId } from "../../../src/shared/domain/tool.js";
import { FakeHostMarketplaceRegistry } from "../../contexts/host-registration/testing/fake-host-marketplace-registry.js";
import { askMarketplaceSource } from "../../helpers/ask-marketplace-source.js";
import { marketplaceSync } from "../../helpers/marketplace-sync.js";
import { buildUnitDeps } from "../../helpers/ports/build-unit-deps.js";
import { fakeEnsureBuiltMarketplace } from "../../helpers/ports/fake-ensure-built-marketplace.js";
import { InMemoryMarketplaceRegistry } from "../../helpers/ports/in-memory-marketplace-registry.js";
import { runSetupOf } from "../../helpers/run-setup-of.js";
import { setupMarketplaceRegistrar } from "../../helpers/setup-marketplace-registrar.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.js";
import { InMemoryEnvironment } from "../../shared/testing/in-memory-environment.js";
import { flowTools, TOOL } from "../../shared/testing/registered-tools.js";
import { OverwritePrompter } from "../../shared/testing/scripted-prompter.js";

const PROJECT_ROOT = "/test-project";
const REGISTRY_LOCATION = "/home/.claude/plugins/known_marketplaces.json";

function makeNoOpLatestResolver(): ReleaseLister & RepositoryVisibility {
  return {
    listReleaseTags: vi.fn().mockResolvedValue([]),
    isRepoPublic: vi.fn().mockResolvedValue(true),
  };
}

function makeNoOpMarketplaceRegisterFramework(): Pick<RegisterFrameworkMarketplace, "execute"> {
  return { execute: vi.fn().mockResolvedValue({ registered: false, scope: "user" }) };
}

function makeNoOpMarketplaceRefresh(): Pick<RefreshMarketplace, "execute"> {
  return { execute: vi.fn().mockResolvedValue({ results: [], failedCount: 0 }) };
}

function makeNoOpPluginInstallFromMarketplace(): PluginInstallFromMarketplace {
  return { execute: vi.fn() };
}

/** A REAL `SyncSettings`, not the no-op double the other setup suites
 * substitute, behind a host registry already holding a different catalog under that name. */
async function buildUseCaseWithConflict() {
  const deps = await buildUnitDeps(PROJECT_ROOT);
  const prompter = new OverwritePrompter();
  const askSource = askMarketplaceSource(prompter, makeNoOpLatestResolver());
  const setupToolsUseCase = new InstallTools(
    deps.manifestRepo,
    deps.installRuntimeConfigUseCase,
    deps.installIdeConfig
  );
  const setupPluginsPromptUseCase = new SetupPluginsPromptUseCase(
    { execute: vi.fn() },
    makeNoOpPluginInstallFromMarketplace(),
    new ListMarketplaces(new InMemoryMarketplaceRegistry()),
    { execute: vi.fn() }
  );

  // The marketplace this project already knows, and the built catalog a real sync would
  // read back, driven here through `setup` rather than against the use case directly.
  await deps.marketplaceRegistry.save(
    PROJECT_ROOT,
    Marketplace.create({
      name: "probe-mkt",
      source: { kind: "local", path: "/source/probe-mkt" },
      scope: "project",
      addedAt: "2026-01-01T00:00:00Z",
    })
  );
  await deps.fs.writeFile(
    "/built/claude/.claude-plugin/marketplace.json",
    JSON.stringify({ name: "probe-mkt", version: "1.0.0", plugins: [{ name: "sample-plugin" }] })
  );
  await deps.fs.writeFile(
    "/other/src/.claude-plugin/marketplace.json",
    JSON.stringify({ name: "probe-mkt", version: "2.0.0", plugins: [{ name: "different-plugin" }] })
  );
  const hostReader = new FakeHostMarketplaceRegistry({
    location: REGISTRY_LOCATION,
    entries: new Map([["probe-mkt", "/other/src"]]),
  });
  const activator = new FakeHostActions({ available: true, enablesPlugins: false });
  const syncSettingsUseCase = marketplaceSync({
    fs: deps.fs,
    manifestRepo: deps.manifestRepo,
    marketplaceRegistry: deps.marketplaceRegistry,

    logger: deps.logger,
    activators: new Map([["claude", activator]]),
    ensureBuilt: fakeEnsureBuiltMarketplace((target) => `/built/${target}`),
    hostMarketplaceRegistries: new Map([[TOOL.claude, hostReader]]),
  });

  const setupMarketplaceRegistration = setupMarketplaceRegistrar(
    deps.fs,
    askSource,
    makeNoOpMarketplaceRegisterFramework(),
    makeNoOpMarketplaceRefresh(),
    deps.currentVersionProvider,
    deps.logger,
    new InMemoryEnvironment()
  );
  const useCase = runSetupOf(
    deps.fs,
    deps.manifestRepo,
    {
      registration: setupMarketplaceRegistration,
      installTools: setupToolsUseCase,
      syncSettings: (options) => syncSettingsUseCase.execute(options),
      version: deps.currentVersionProvider,
    },
    { plugins: (options) => setupPluginsPromptUseCase.execute(options) }
  );
  return { useCase, activator };
}

function remoteFlow(aiTools: ToolId[]): SetupFlow {
  return new SetupFlow({
    ...flowTools(),
    supportsUserScopeActivation: () => true,
    projectRoot: PROJECT_ROOT,
    source: remoteFrameworkSource(),
    aiTools,
    ideTools: [],
    pluginMode: "none",
    interactive: false,
  });
}

describe("setup surfaces a marketplace source conflict instead of exiting clean", () => {
  it("reports the conflict in its own activation result rather than discarding it", async () => {
    const { useCase, activator } = await buildUseCaseWithConflict();

    const result = await useCase.execute(remoteFlow([TOOL.claude]));

    expect(activator.addedMarketplaces).toHaveLength(0);
    expect(result.activation.errors).toHaveLength(1);
    expect(result.activation.errors[0]?.message).toMatch(/different catalog/);
    expect(result.activation.errors[0]?.message).toMatch(/probe-mkt/);
  });
});
