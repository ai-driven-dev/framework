import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ListMarketplaces } from "../../../src/contexts/distribution/application/list-marketplaces.js";
import type { RefreshMarketplace } from "../../../src/contexts/distribution/application/refresh-marketplace.js";
import type { RegisterFrameworkMarketplace } from "../../../src/contexts/distribution/application/register-framework-marketplace.js";
import type { ResolveMarketplace } from "../../../src/contexts/distribution/application/resolve-marketplace.js";
import type { PluginCatalogEntry } from "../../../src/contexts/distribution/contract/catalog.js";
import { remoteFrameworkSource } from "../../../src/contexts/distribution/contract/framework-source.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../src/contexts/distribution/contract/marketplace.js";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import type { RepositoryVisibility } from "../../../src/contexts/distribution/ports/repository-visibility.js";
import { DetectProjectContext } from "../../../src/contexts/installation/application/detect-project-context.js";
import { ConfigureMachineScope } from "../../../src/contexts/installation/application/install/configure-machine-scope.js";
import { InstallTools } from "../../../src/contexts/installation/application/install/install-tools.js";
import { ProjectContext } from "../../../src/contexts/installation/contract/project-context.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import type { ManifestRepository } from "../../../src/contexts/installation/ports/manifest-repository.js";
import { UserSourceReferencesAdapter } from "../../../src/contexts/machine-claims/infrastructure/user-source-references-adapter.js";
import type { UserSourceReferences } from "../../../src/contexts/machine-claims/ports/user-source-references.js";
import type { PluginInstallFromMarketplace } from "../../../src/orchestration/plugin/install-from-marketplace.js";
import type { PluginPick } from "../../../src/orchestration/plugin/pick-plugins.js";
import type { InstallGlobalPlugins } from "../../../src/orchestration/setup/install-global-plugins.js";
import { SetupFlow } from "../../../src/orchestration/setup/setup-flow.js";
import { SetupMachineScope } from "../../../src/orchestration/setup/setup-machine-scope.js";
import { ChoosePlugins } from "../../../src/orchestration/setup/steps/choose-plugins.js";
import type { ChooseTools } from "../../../src/orchestration/setup/steps/choose-tools.js";
import type { SyncSettings } from "../../../src/orchestration/sync/sync-settings.js";
import { UserScopeUnavailableError } from "../../../src/shared/domain/errors.js";
import type { Scope } from "../../../src/shared/domain/scope.js";
import type { ToolId } from "../../../src/shared/domain/tool.js";
import type { Lock } from "../../../src/shared/ports/lock.js";
import type { Logger } from "../../../src/shared/ports/logger.js";
import type { ReleaseLister } from "../../../src/shared/ports/release-lister.js";
import { InMemoryManifestRepository } from "../../contexts/installation/testing/in-memory-manifest-repository.fake.js";
import {
  buildInstallationDeps,
  initAndInstall,
  initProject,
} from "../../contexts/installation/testing/installation-deps.builder.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { FakeCurrentVersion } from "../../shared/testing/fake-current-version.fake.js";
import { InMemoryEnvironment } from "../../shared/testing/in-memory-environment.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { flowTools, registeredTools, TOOL } from "../../shared/testing/registered-tools.builder.js";
import { OverwritePrompter } from "../../shared/testing/scripted-prompter.fake.js";
import { askMarketplaceSource } from "../testing/ask-marketplace-source.builder.js";
import { runSetupOf } from "../testing/run-setup-of.builder.js";
import { setupMarketplaceRegistrar } from "../testing/setup-marketplace-registrar.builder.js";

const CURRENT_VERSION = new FakeCurrentVersion();

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
type RefreshMock = Pick<RefreshMarketplace, "execute"> & { execute: ReturnType<typeof vi.fn> };

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

const PROJECT_ROOT = "/test-project";

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

function makeRecordingUserSourceReferences(): UserSourceReferences & {
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

async function buildUseCase(
  chooseTools?: Pick<ChooseTools, "execute">,
  userSourceReferences?: UserSourceReferences,
  logger?: Logger,
  options?: {
    userManifestRepo?: ManifestRepository & Lock;
    syncSettingsUseCase?: Pick<SyncSettings, "execute"> & {
      execute: ReturnType<typeof vi.fn>;
    };
    detectContext?: boolean;
    installGlobalPlugins?: Pick<InstallGlobalPlugins, "execute">;
  }
) {
  const deps = await buildInstallationDeps();
  const prompter = new OverwritePrompter();
  const askSource = askMarketplaceSource(prompter, makeNoOpLatestResolver());
  const setupToolsUseCase = new InstallTools(
    deps.manifestRepo,
    deps.installRuntimeConfigUseCase,
    deps.installIdeConfig
  );
  const pluginInstallFromMarketplace = makeNoOpPluginInstallFromMarketplace();
  const choosePlugins = new ChoosePlugins(
    makeNoOpPluginPick(),
    pluginInstallFromMarketplace,
    new ListMarketplaces(new InMemoryMarketplaceRegistry()),
    makeNoOpResolveMarketplace()
  );
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
      : new SetupMachineScope(
          new ConfigureMachineScope(options.userManifestRepo, CURRENT_VERSION),
          setupMarketplaceRegistration,
          (syncOptions) => syncSettingsUseCase.execute(syncOptions),
          options.installGlobalPlugins ?? { execute: async () => ({ plugins: [] }) }
        );
  const useCase = runSetupOf(
    deps.fs,
    deps.manifestRepo,
    {
      registration: setupMarketplaceRegistration,
      installTools: setupToolsUseCase,
      syncSettings: (syncOptions) => syncSettingsUseCase.execute(syncOptions),
      version: CURRENT_VERSION,
      detectContext:
        options?.detectContext === true ? new DetectProjectContext(deps.fs) : undefined,
      machineScope,
    },
    {
      plugins: (promptOptions) => choosePlugins.execute(promptOptions),
      tools:
        chooseTools === undefined
          ? undefined
          : (promptOptions) => chooseTools.execute(promptOptions),
    }
  );
  return {
    useCase,
    deps,
    marketplaceRegisterFramework,
    marketplaceRefresh,
    syncSettingsUseCase,
    pluginInstallFromMarketplace,
  };
}

function remoteFlow(
  opts: Partial<{
    aiTools: ToolId[];
    ideTools: ToolId[];
    scope: Scope;
    pluginMode: "all" | "named";
    pluginNames: string[];
  }> = {}
): SetupFlow {
  return new SetupFlow({
    ...flowTools(),
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

describe("setup validates before any side effect", () => {
  it("non-interactive with no --source rejects without writing a manifest or .gitignore", async () => {
    const { useCase, deps } = await buildUseCase();
    const flow = new SetupFlow({
      ...flowTools(),
      supportsUserScopeActivation: () => true,
      projectRoot: PROJECT_ROOT,
      aiTools: [],
      ideTools: [],
      pluginMode: "none",
      interactive: false,
    });

    await expect(useCase.execute(flow)).rejects.toThrow(/--source/);

    expect(await deps.manifestRepo.load()).toBeNull();
    expect(deps.fs.has(join(PROJECT_ROOT, ".gitignore"))).toBe(false);
  });
});

describe("setup without TTY", () => {
  it("fresh project with all tools flag initializes and installs all tools", async () => {
    const { useCase } = await buildUseCase();
    const result = await useCase.execute(
      remoteFlow({
        aiTools: [...registeredTools().idsInCanonicalOrder("ai")],
        ideTools: [...registeredTools().idsInCanonicalOrder("ide")],
      })
    );

    expect(result.kind).toBe("initialized");
    if (result.kind === "initialized") {
      expect(result.install.results.length).toBeGreaterThan(0);
    }
  });

  it("fresh project without tool flags initializes docs only and installs no tools", async () => {
    const { useCase } = await buildUseCase();
    const result = await useCase.execute(remoteFlow());

    expect(result.kind).toBe("initialized");
    if (result.kind === "initialized") {
      expect(result.install.results).toHaveLength(0);
    }
  });

  it("aidd_docs exists without tool signals routes to init and installs tools", async () => {
    const { useCase, deps } = await buildUseCase();
    deps.fs.writeFile(join(PROJECT_ROOT, "aidd_docs/.keep"), "");

    const result = await useCase.execute(
      remoteFlow({
        aiTools: [...registeredTools().idsInCanonicalOrder("ai")],
        ideTools: [...registeredTools().idsInCanonicalOrder("ide")],
      })
    );

    expect(result.kind).toBe("initialized");
    if (result.kind === "initialized") {
      expect(result.install.results.length).toBeGreaterThan(0);
    }
  });

  it("manifest exists — returns up-to-date even with tool flags (tools still installed)", async () => {
    const { useCase, deps } = await buildUseCase();
    await initProject(deps, PROJECT_ROOT);

    const result = await useCase.execute(
      remoteFlow({
        aiTools: [...registeredTools().idsInCanonicalOrder("ai")],
        ideTools: [...registeredTools().idsInCanonicalOrder("ide")],
      })
    );

    expect(result.kind).toBe("up-to-date");
    if (result.kind === "up-to-date") {
      expect(result.install.results.length).toBeGreaterThan(0);
    }
  });

  it("manifest exists without tool flags returns up-to-date with empty install", async () => {
    const { useCase, deps } = await buildUseCase();
    await initProject(deps, PROJECT_ROOT);

    const result = await useCase.execute(remoteFlow());

    expect(result.kind).toBe("up-to-date");
    if (result.kind === "up-to-date") {
      expect(result.install.results).toHaveLength(0);
    }
  });

  it("project already up to date — exits without error", async () => {
    const { useCase, deps } = await buildUseCase();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);

    const result = await useCase.execute(remoteFlow());

    expect(result.kind).toBe("up-to-date");
  });

  it("hands the detected project context back with the result", async () => {
    const { useCase, deps } = await buildUseCase(undefined, undefined, undefined, {
      detectContext: true,
    });
    deps.fs.setFile(join(PROJECT_ROOT, "tsconfig.json"), "{}");

    const result = await useCase.execute(remoteFlow());

    expect(result.context).toStrictEqual(
      new ProjectContext({ stack: "typescript", isMonorepo: false, hasFramework: false })
    );
  });

  describe("plugins named on the command line", () => {
    function namedFlow(registerDefaultMarketplace: boolean): SetupFlow {
      return new SetupFlow({
        ...flowTools(),
        supportsUserScopeActivation: () => true,
        projectRoot: PROJECT_ROOT,
        source: remoteFrameworkSource(),
        aiTools: [TOOL.claude],
        ideTools: [],
        pluginMode: "named",
        pluginNames: ["aidd-context"],
        interactive: false,
        registerDefaultMarketplace,
      });
    }

    it("installs each named plugin on every tool once the framework marketplace is registered", async () => {
      const { useCase, pluginInstallFromMarketplace } = await buildUseCase();

      await useCase.execute(namedFlow(true));

      expect(pluginInstallFromMarketplace.execute).toHaveBeenCalledTimes(1);
      expect(pluginInstallFromMarketplace.execute).toHaveBeenCalledWith({
        pluginName: "aidd-context",
        toolIds: "all",
        projectRoot: PROJECT_ROOT,
        interactive: false,
        autoSelect: true,
        replace: true,
      });
    });

    it("installs no plugin when the default marketplace is opted out", async () => {
      const { useCase, pluginInstallFromMarketplace } = await buildUseCase();

      await useCase.execute(namedFlow(false));

      expect(pluginInstallFromMarketplace.execute).not.toHaveBeenCalled();
    });
  });

  describe("default marketplace opt-out (#197)", () => {
    it("registers framework marketplace by default", async () => {
      const { useCase, marketplaceRegisterFramework, marketplaceRefresh } = await buildUseCase();
      await useCase.execute(remoteFlow({ aiTools: [TOOL.claude] }));
      expect(marketplaceRegisterFramework.execute).toHaveBeenCalledOnce();
      expect(marketplaceRefresh.execute).toHaveBeenCalledOnce();
    });

    it("skips framework register + refresh when registerDefaultMarketplace=false", async () => {
      const { useCase, marketplaceRegisterFramework, marketplaceRefresh } = await buildUseCase();
      await useCase.execute(
        new SetupFlow({
          ...flowTools(),
          supportsUserScopeActivation: () => true,
          projectRoot: PROJECT_ROOT,
          source: remoteFrameworkSource(),
          aiTools: [TOOL.claude],
          ideTools: [],
          pluginMode: "none",
          interactive: false,
          registerDefaultMarketplace: false,
        })
      );
      expect(marketplaceRegisterFramework.execute).not.toHaveBeenCalled();
      expect(marketplaceRefresh.execute).not.toHaveBeenCalled();
    });

    it("still installs tools when default marketplace is opted out", async () => {
      const { useCase } = await buildUseCase();
      const result = await useCase.execute(
        new SetupFlow({
          ...flowTools(),
          supportsUserScopeActivation: () => true,
          projectRoot: PROJECT_ROOT,
          source: remoteFrameworkSource(),
          aiTools: [TOOL.claude],
          ideTools: [],
          pluginMode: "none",
          interactive: false,
          registerDefaultMarketplace: false,
        })
      );
      expect(result.kind).toBe("initialized");
      if (result.kind === "initialized") {
        const claudeResult = result.install.results.find((r) => r.toolId === "claude");
        expect(claudeResult).toBeDefined();
      }
    });
  });

  describe("this project's own reference to the shared source", () => {
    it("records it after registering the framework marketplace by default", async () => {
      const userSourceReferences = makeRecordingUserSourceReferences();
      const { useCase } = await buildUseCase(undefined, userSourceReferences);

      await useCase.execute(remoteFlow({ aiTools: [TOOL.claude] }));

      expect(userSourceReferences.added).toEqual([
        { version: CURRENT_VERSION.get(), projectRoot: PROJECT_ROOT },
      ]);
    });

    it("records no reference when default marketplace registration is opted out", async () => {
      const userSourceReferences = makeRecordingUserSourceReferences();
      const { useCase } = await buildUseCase(undefined, userSourceReferences);

      await useCase.execute(
        new SetupFlow({
          ...flowTools(),
          supportsUserScopeActivation: () => true,
          projectRoot: PROJECT_ROOT,
          source: remoteFrameworkSource(),
          aiTools: [TOOL.claude],
          ideTools: [],
          pluginMode: "none",
          interactive: false,
          registerDefaultMarketplace: false,
        })
      );

      expect(userSourceReferences.added).toEqual([]);
    });

    // `references.json` is a help, not an authority: a corrupted copy must never block `setup`,
    // which does not depend on it.
    it("warns and still completes setup when references.json is corrupted", async () => {
      const logger = new CapturingLogger();
      const referencesFs = new InMemoryFileAdapter();
      referencesFs.setFile("/fake-home/.config/aidd/references.json", "not json");
      const userSourceReferences = new UserSourceReferencesAdapter(
        referencesFs,
        () => "/fake-home/.config/aidd"
      );
      const { useCase } = await buildUseCase(undefined, userSourceReferences, logger);

      const result = await useCase.execute(remoteFlow({ aiTools: [TOOL.claude] }));

      expect(result.kind).toBe("initialized");
      expect(logger.warnMessages.some((m) => m.includes("references.json"))).toBe(true);
    });
  });

  describe("issue #141 — post-uninstall regression", () => {
    it("succeeds when aidd_docs/ and .aidd/ exist but no manifest and no tool dirs", async () => {
      const { useCase, deps } = await buildUseCase();
      deps.fs.writeFile(join(PROJECT_ROOT, "aidd_docs/.keep"), "");
      deps.fs.writeFile(join(PROJECT_ROOT, ".aidd/.keep"), "");

      const result = await useCase.execute(remoteFlow({ aiTools: [TOOL.claude] }));

      expect(result.kind).toBe("initialized");
    });

    it("installs selected tools when only aidd_docs/ survives uninstall", async () => {
      const { useCase, deps } = await buildUseCase();
      deps.fs.writeFile(join(PROJECT_ROOT, "aidd_docs/.keep"), "");
      deps.fs.writeFile(join(PROJECT_ROOT, ".aidd/.keep"), "");

      const result = await useCase.execute(remoteFlow({ aiTools: [TOOL.opencode] }));

      expect(result.kind).toBe("initialized");
      if (result.kind === "initialized") {
        const opencodeTool = result.install.results.find((r) => r.toolId === "opencode");
        expect(opencodeTool).toBeDefined();
        expect(opencodeTool?.skipped).toBe(false);
      }
    });

    it("does not fail when only aidd_docs/ exists (no manifest)", async () => {
      const { useCase, deps } = await buildUseCase();
      deps.fs.writeFile(join(PROJECT_ROOT, "aidd_docs/.keep"), "");
      deps.fs.writeFile(join(PROJECT_ROOT, ".aidd/.keep"), "");

      const result = await useCase.execute(remoteFlow());

      expect(result.kind).toBe("initialized");
    });

    it("preserves user files in aidd_docs/ across setup", async () => {
      const { useCase, deps } = await buildUseCase();
      deps.fs.writeFile(join(PROJECT_ROOT, "aidd_docs/.keep"), "");
      deps.fs.writeFile(join(PROJECT_ROOT, ".aidd/.keep"), "");
      deps.fs.writeFile(join(PROJECT_ROOT, "aidd_docs/README.md"), "my custom readme");

      await useCase.execute(remoteFlow({ aiTools: [TOOL.claude] }));

      const content = deps.fs.getFile(join(PROJECT_ROOT, "aidd_docs/README.md")) ?? "";
      expect(content).toBe("my custom readme");
    });
  });
});

describe("setup interactive tool selection", () => {
  function _interactiveFlow(
    opts: Partial<{ aiTools: ToolId[]; ideTools: ToolId[] }> = {}
  ): SetupFlow {
    return new SetupFlow({
      ...flowTools(),
      supportsUserScopeActivation: () => true,
      projectRoot: PROJECT_ROOT,
      source: remoteFrameworkSource(),
      aiTools: opts.aiTools ?? [],
      ideTools: opts.ideTools ?? [],
      pluginMode: "none",
      interactive: true,
    });
  }

  it("hands the tools question the flow's whole request, and installs the answer", async () => {
    const answer = vi.fn(async () => ({ aiTools: [TOOL.cursor], ideTools: [] }));
    const { useCase, deps } = await buildUseCase({ execute: answer }, undefined, undefined, {
      detectContext: true,
    });
    deps.fs.setFile(join(PROJECT_ROOT, "tsconfig.json"), "{}");

    const result = await useCase.execute(
      remoteFlow({ aiTools: [TOOL.claude, TOOL.cursor], ideTools: [TOOL.vscode] })
    );

    expect(answer).toHaveBeenCalledWith({
      interactive: false,
      aiTools: [TOOL.claude, TOOL.cursor],
      ideTools: [TOOL.vscode],
      context: new ProjectContext({ stack: "typescript", isMonorepo: false, hasFramework: false }),
    });
    if (result.kind === "initialized") {
      expect(result.install.results.map((r) => r.toolId)).toEqual(["cursor"]);
    }
  });

  it("non-interactive + empty tools → no prompt, installs nothing", async () => {
    const { useCase } = await buildUseCase();

    const result = await useCase.execute(remoteFlow());

    expect(result.kind).toBe("initialized");
    if (result.kind === "initialized") {
      expect(result.install.results).toHaveLength(0);
    }
  });
});

describe("setup --scope user", () => {
  it("refuses when no machine-scope use case was wired", async () => {
    const { useCase } = await buildUseCase();

    await expect(
      useCase.execute(remoteFlow({ aiTools: [TOOL.claude], scope: "user" }))
    ).rejects.toThrow(UserScopeUnavailableError);
  });

  it("reports a first run as initialized, installing nothing", async () => {
    const userManifestRepo = new InMemoryManifestRepository();
    const { useCase } = await buildUseCase(undefined, undefined, undefined, { userManifestRepo });

    const result = await useCase.execute(remoteFlow({ aiTools: [TOOL.claude], scope: "user" }));

    expect(result).toStrictEqual({
      kind: "initialized",
      install: { results: [] },
      activation: { updatedTools: [] },
      context: undefined,
      globalPlugins: [],
    });
  });

  it("reports a repeat run as up-to-date", async () => {
    const userManifestRepo = new InMemoryManifestRepository(Manifest.create());
    const { useCase } = await buildUseCase(undefined, undefined, undefined, { userManifestRepo });

    const result = await useCase.execute(remoteFlow({ aiTools: [TOOL.claude], scope: "user" }));

    expect(result).toStrictEqual({
      kind: "up-to-date",
      install: { results: [] },
      activation: { updatedTools: [] },
      context: undefined,
      globalPlugins: [],
    });
  });

  it("keeps the tools an earlier run registered", async () => {
    const seed = Manifest.create();
    seed.addTool(TOOL.codex, "9.9.9", []);
    const userManifestRepo = new InMemoryManifestRepository(seed);
    const { useCase } = await buildUseCase(undefined, undefined, undefined, { userManifestRepo });

    await useCase.execute(remoteFlow({ aiTools: [TOOL.claude], scope: "user" }));

    expect(userManifestRepo.getCurrent()?.getInstalledToolIds()).toStrictEqual(["codex", "claude"]);
  });

  it("registers a new tool with no files and saves the manifest once", async () => {
    const userManifestRepo = new InMemoryManifestRepository(Manifest.create());
    const { useCase } = await buildUseCase(undefined, undefined, undefined, { userManifestRepo });

    await useCase.execute(remoteFlow({ aiTools: [TOOL.claude], scope: "user" }));

    expect(userManifestRepo.getCurrent()?.getToolFiles(TOOL.claude)).toStrictEqual([]);
    expect(userManifestRepo.saveCount).toBe(1);
  });

  it("leaves an already-registered tool at its recorded version, saving nothing", async () => {
    const seed = Manifest.create();
    seed.addTool(TOOL.claude, "9.9.9", []);
    const userManifestRepo = new InMemoryManifestRepository(seed);
    const { useCase } = await buildUseCase(undefined, undefined, undefined, { userManifestRepo });

    await useCase.execute(remoteFlow({ aiTools: [TOOL.claude], scope: "user" }));

    expect(userManifestRepo.getCurrent()?.getToolVersion(TOOL.claude)).toBe("9.9.9");
    expect(userManifestRepo.saveCount).toBe(0);
  });

  it("writes nothing at all under projectRoot — full directory delta, not a list", async () => {
    const userManifestRepo = new InMemoryManifestRepository();
    const { useCase, deps } = await buildUseCase(undefined, undefined, undefined, {
      userManifestRepo,
    });

    await useCase.execute(remoteFlow({ aiTools: [TOOL.claude], scope: "user" }));

    expect(deps.fs.listUnder(PROJECT_ROOT)).toEqual([]);
  });

  it("writes the user manifest, never this project's own .aidd/manifest.json", async () => {
    const userManifestRepo = new InMemoryManifestRepository();
    const { useCase, deps } = await buildUseCase(undefined, undefined, undefined, {
      userManifestRepo,
    });

    await useCase.execute(remoteFlow({ aiTools: [TOOL.claude], scope: "user" }));

    expect(userManifestRepo.getCurrent()?.getInstalledToolIds()).toContain("claude");
    expect(await deps.manifestRepo.load()).toBeNull();
  });

  it("hands the machine-wide sync the tools it registered and the plugins it enabled", async () => {
    const userManifestRepo = new InMemoryManifestRepository();
    const syncSettingsUseCase = { execute: vi.fn().mockResolvedValue({ updatedTools: [] }) };
    const { useCase } = await buildUseCase(undefined, undefined, undefined, {
      userManifestRepo,
      syncSettingsUseCase,
    });

    await useCase.execute(remoteFlow({ aiTools: [TOOL.claude], scope: "user" }));

    expect(syncSettingsUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ toolIds: [TOOL.claude], enablePlugins: [] })
    );
  });

  it("installs the named plugins machine-wide and enables exactly those it installed", async () => {
    const userManifestRepo = new InMemoryManifestRepository();
    const syncSettingsUseCase = { execute: vi.fn().mockResolvedValue({ updatedTools: [] }) };
    const execute = vi.fn(async () => ({ plugins: ["aidd-dev"] }));
    const { useCase } = await buildUseCase(undefined, undefined, undefined, {
      userManifestRepo,
      syncSettingsUseCase,
      installGlobalPlugins: { execute },
    });

    await useCase.execute(
      remoteFlow({
        aiTools: [TOOL.claude],
        scope: "user",
        pluginMode: "named",
        pluginNames: ["aidd-dev"],
      })
    );

    expect(execute).toHaveBeenCalledWith({
      projectRoot: PROJECT_ROOT,
      toolIds: [TOOL.claude],
      mode: "named",
      pluginNames: ["aidd-dev"],
    });
    expect(syncSettingsUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ toolIds: [TOOL.claude], enablePlugins: ["aidd-dev"] })
    );
  });

  it("never installs framework files nor prompts for plugins — no project delivery at all", async () => {
    const userManifestRepo = new InMemoryManifestRepository();
    const { useCase } = await buildUseCase(undefined, undefined, undefined, { userManifestRepo });

    const result = await useCase.execute(remoteFlow({ aiTools: [TOOL.claude], scope: "user" }));

    expect(result.install.results).toEqual([]);
  });

  it("records no shared-source reference — there is no project-scope manifest for a later clean to ever decrement", async () => {
    const userManifestRepo = new InMemoryManifestRepository();
    const userSourceReferences = makeRecordingUserSourceReferences();
    const { useCase } = await buildUseCase(undefined, userSourceReferences, undefined, {
      userManifestRepo,
    });

    await useCase.execute(remoteFlow({ aiTools: [TOOL.claude], scope: "user" }));

    expect(userSourceReferences.added).toEqual([]);
  });
});
