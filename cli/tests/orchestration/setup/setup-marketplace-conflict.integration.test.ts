import { describe, expect, it, vi } from "vitest";
import { ListMarketplaces } from "../../../src/contexts/distribution/application/list-marketplaces.use-case.js";
import type { RegisterFrameworkMarketplace } from "../../../src/contexts/distribution/application/register-framework-marketplace.use-case.js";
import { remoteFrameworkSource } from "../../../src/contexts/distribution/contract/framework-source.js";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import type { RepositoryVisibility } from "../../../src/contexts/distribution/ports/repository-visibility.js";
import { InstallTools } from "../../../src/contexts/installation/application/install/install-tools.use-case.js";
import { SetupFlow } from "../../../src/orchestration/domain/setup-flow.model.js";
import type { RefreshMarketplaces } from "../../../src/orchestration/marketplace/refresh-marketplaces.use-case.js";
import type { PluginInstallFromMarketplace } from "../../../src/orchestration/plugin/install-from-marketplace.use-case.js";
import { ChoosePlugins } from "../../../src/orchestration/setup/steps/choose-plugins.use-case.js";
import { render } from "../../../src/presentation/errors/error-translator.presenter.js";
import type { ToolId } from "../../../src/shared/domain/tool.js";
import type { ReleaseLister } from "../../../src/shared/ports/release-lister.js";
import { FakeHostMarketplaceRegistry } from "../../contexts/host-registration/testing/fake-host-marketplace-registry.fake.js";
import { FakeCurrentVersion } from "../../shared/testing/fake-current-version.fake.js";
import { fakeEnsureBuiltMarketplace } from "../../shared/testing/fake-ensure-built-marketplace.fake.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { InMemoryEnvironment } from "../../shared/testing/in-memory-environment.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { buildInstallationDeps } from "../../shared/testing/installation-deps.builder.js";
import { marketplaceSync } from "../../shared/testing/marketplace-sync.builder.js";
import { flowTools, registeredTools, TOOL } from "../../shared/testing/registered-tools.builder.js";
import { OverwritePrompter } from "../../shared/testing/scripted-prompter.fake.js";
import { askMarketplaceSource } from "../testing/ask-marketplace-source.builder.js";
import { runSetupOf } from "../testing/run-setup-of.builder.js";
import { setupMarketplaceRegistrar } from "../testing/setup-marketplace-registrar.builder.js";

const CURRENT_VERSION = new FakeCurrentVersion();

const PROJECT_ROOT = "/test-project";
const REGISTRY_LOCATION = "/home/.claude/plugins/known_marketplaces.json";

function makeNoOpLatestResolver(): ReleaseLister & RepositoryVisibility {
  return {
    listReleaseTags: vi.fn().mockResolvedValue([]),
    readReleaseBody: vi.fn().mockResolvedValue(null),
    isRepoPublic: vi.fn().mockResolvedValue(true),
  };
}

function makeNoOpMarketplaceRegisterFramework(): Pick<RegisterFrameworkMarketplace, "execute"> {
  return { execute: vi.fn().mockResolvedValue({ registered: false, scope: "user" }) };
}

function makeNoOpMarketplaceRefresh(): Pick<RefreshMarketplaces, "execute"> {
  return { execute: vi.fn().mockResolvedValue({ results: [], failedCount: 0 }) };
}

function makeNoOpPluginInstallFromMarketplace(): PluginInstallFromMarketplace {
  return { execute: vi.fn() };
}

/** A REAL `SyncSettings`, not the no-op double the other setup suites
 * substitute, behind a host registry already holding a different catalog under that name. */
async function buildUseCaseWithConflict() {
  const deps = await buildInstallationDeps({ tools: registeredTools() });
  const prompter = new OverwritePrompter();
  const askSource = askMarketplaceSource(prompter, makeNoOpLatestResolver());
  const setupToolsUseCase = new InstallTools(
    deps.manifestRepo,
    deps.installRuntimeConfigUseCase,
    deps.installIdeConfig
  );
  const choosePlugins = new ChoosePlugins({
    pickPlugins: { execute: vi.fn() },
    pluginInstallFromMarketplaceUseCase: makeNoOpPluginInstallFromMarketplace(),
    listMarketplaces: new ListMarketplaces(new InMemoryMarketplaceRegistry()),
    resolveMarketplaceUseCase: { execute: vi.fn() },
  });

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
  const activator = new FakeHostActions({ available: true });
  const syncSettingsUseCase = marketplaceSync({
    tools: registeredTools(),
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
    CURRENT_VERSION,
    deps.logger,
    new InMemoryEnvironment()
  );
  const useCase = runSetupOf({
    tools: registeredTools(),
    fs: deps.fs,
    manifestRepo: deps.manifestRepo,
    steps: {
      ...setupMarketplaceRegistration,
      installTools: setupToolsUseCase,
      syncSettings: (options) => syncSettingsUseCase.execute(options),
      version: CURRENT_VERSION,
    },
    questions: { plugins: (options) => choosePlugins.execute(options) },
  });
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
    expect(render(result.activation.errors[0]?.error)).toMatch(/different catalog/);
    expect(render(result.activation.errors[0]?.error)).toMatch(/probe-mkt/);
  });
});
