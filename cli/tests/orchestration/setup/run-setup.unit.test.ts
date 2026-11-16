import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { RefreshMarketplace } from "../../../src/contexts/distribution/application/refresh-marketplace.js";
import type { RegisterFrameworkMarketplace } from "../../../src/contexts/distribution/application/register-framework-marketplace.js";
import type { ResolveMarketplace } from "../../../src/contexts/distribution/application/resolve-marketplace.js";
import type { PluginCatalogEntry } from "../../../src/contexts/distribution/contract/catalog.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../src/contexts/distribution/contract/marketplace.js";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { MarketplaceSourceMode } from "../../../src/contexts/distribution/domain/marketplace-source-mode.js";
import type { ReleaseLister } from "../../../src/contexts/distribution/ports/release-lister.js";
import type { RepositoryVisibility } from "../../../src/contexts/distribution/ports/repository-visibility.js";
import type { MarketplaceSyncSettings } from "../../../src/contexts/framework/application/flows/marketplace-sync-settings-use-case.js";
import { DetectProjectContext } from "../../../src/contexts/installation/application/detect-project-context.js";
import { ConfigureMachineScope } from "../../../src/contexts/installation/application/install/configure-machine-scope.js";
import { InstallTools } from "../../../src/contexts/installation/application/install/install-tools.js";
import { ProjectContext } from "../../../src/contexts/installation/contract/project-context.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import type { ManifestRepository } from "../../../src/contexts/installation/ports/manifest-repository.js";
import { UserSourceReferencesAdapter } from "../../../src/contexts/machine-claims/infrastructure/user-source-references-adapter.js";
import type { UserSourceReferences } from "../../../src/contexts/machine-claims/ports/user-source-references.js";
import type { PluginInstallFromMarketplace } from "../../../src/orchestration/plugin/install-from-marketplace.js";
import { SetupFlow } from "../../../src/orchestration/setup/setup-flow.js";
import { SetupMachineScope } from "../../../src/orchestration/setup/setup-machine-scope.js";
import type { PluginPick } from "../../../src/presentation/prompts/plugin-pick-use-case.js";
import { SetupPluginsPromptUseCase } from "../../../src/presentation/prompts/setup-plugins-prompt-use-case.js";
import { SetupToolsPromptUseCase } from "../../../src/presentation/prompts/setup-tools-prompt-use-case.js";
import { UserScopeUnavailableError } from "../../../src/shared/domain/errors.js";
import type { ToolId } from "../../../src/shared/domain/tool.js";
import type { Lock } from "../../../src/shared/ports/lock.js";
import type { Logger } from "../../../src/shared/ports/logger.js";
import { catalogOf, flowTools, TOOL } from "../../contexts/tools/testing/catalog-of.js";
import { askMarketplaceSource } from "../../helpers/ask-marketplace-source.js";
import { buildUnitDeps, initAndInstall, initProject } from "../../helpers/ports/build-unit-deps.js";
import { CapturingLogger } from "../../helpers/ports/capturing-logger.js";
import { InMemoryEnvironment } from "../../helpers/ports/in-memory-environment.js";
import { InMemoryFileAdapter } from "../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../helpers/ports/in-memory-manifest-repository.js";
import { InMemoryMarketplaceRegistry } from "../../helpers/ports/in-memory-marketplace-registry.js";
import { OverwritePrompter, ScriptedPrompter } from "../../helpers/ports/scripted-prompter.js";
import { runSetupOf } from "../../helpers/run-setup-of.js";
import { setupMarketplaceRegistrar } from "../../helpers/setup-marketplace-registrar.js";

function makeNoOpLatestResolver(): ReleaseLister & RepositoryVisibility {
  return {
    listRootReleases: vi.fn().mockResolvedValue([]),
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

function makeNoOpMarketplaceSyncSettings(): MarketplaceSyncSettings {
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
  setupToolsPromptUseCase?: SetupToolsPromptUseCase,
  userSourceReferences?: UserSourceReferences,
  logger?: Logger,
  options?: {
    userManifestRepo?: ManifestRepository & Lock;
    marketplaceSyncSettingsUseCase?: MarketplaceSyncSettings & {
      execute: ReturnType<typeof vi.fn>;
    };
    detectContext?: boolean;
  }
) {
  const deps = await buildUnitDeps(PROJECT_ROOT);
  const prompter = new OverwritePrompter();
  const askSource = askMarketplaceSource(prompter, makeNoOpLatestResolver());
  const setupToolsUseCase = new InstallTools(
    deps.manifestRepo,
    deps.installRuntimeConfigUseCase,
    deps.installIdeConfig
  );
  const pluginInstallFromMarketplace = makeNoOpPluginInstallFromMarketplace();
  const setupPluginsPromptUseCase = new SetupPluginsPromptUseCase(
    makeNoOpPluginPick(),
    pluginInstallFromMarketplace,
    new InMemoryMarketplaceRegistry(),
    makeNoOpResolveMarketplace()
  );
  const marketplaceRegisterFramework = makeNoOpMarketplaceRegisterFramework();
  const marketplaceRefresh = makeNoOpMarketplaceRefresh();
  const marketplaceSyncSettingsUseCase =
    options?.marketplaceSyncSettingsUseCase ?? makeNoOpMarketplaceSyncSettings();
  const setupMarketplaceRegistration = setupMarketplaceRegistrar(
    deps.fs,
    askSource,
    marketplaceRegisterFramework,
    marketplaceRefresh,
    deps.currentVersionProvider,
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
          new ConfigureMachineScope(options.userManifestRepo, deps.currentVersionProvider),
          setupMarketplaceRegistration,
          (syncOptions) => marketplaceSyncSettingsUseCase.execute(syncOptions)
        );
  const useCase = runSetupOf(
    deps.fs,
    deps.manifestRepo,
    {
      registration: setupMarketplaceRegistration,
      installTools: setupToolsUseCase,
      syncSettings: (syncOptions) => marketplaceSyncSettingsUseCase.execute(syncOptions),
      version: deps.currentVersionProvider,
      detectContext:
        options?.detectContext === true ? new DetectProjectContext(deps.fs) : undefined,
      machineScope,
    },
    {
      plugins: (promptOptions) => setupPluginsPromptUseCase.execute(promptOptions),
      tools:
        setupToolsPromptUseCase === undefined
          ? undefined
          : (promptOptions) => setupToolsPromptUseCase.execute(promptOptions),
    }
  );
  return {
    useCase,
    deps,
    marketplaceRegisterFramework,
    marketplaceRefresh,
    marketplaceSyncSettingsUseCase,
    pluginInstallFromMarketplace,
  };
}

function remoteFlow(
  opts: Partial<{ aiTools: ToolId[]; ideTools: ToolId[]; scope: "project" | "user" }> = {}
): SetupFlow {
  return new SetupFlow({
    ...flowTools(),
    supportsUserScopeActivation: () => true,
    projectRoot: PROJECT_ROOT,
    source: MarketplaceSourceMode.remote(),
    aiTools: opts.aiTools ?? [],
    ideTools: opts.ideTools ?? [],
    pluginMode: "none",
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

    await expect(useCase.execute(flow, catalogOf())).rejects.toThrow(/--source/);

    expect(await deps.manifestRepo.load()).toBeNull();
    expect(deps.fs.has(join(PROJECT_ROOT, ".gitignore"))).toBe(false);
  });
});

describe("setup without TTY", () => {
  it("fresh project with all tools flag initializes and installs all tools", async () => {
    const { useCase } = await buildUseCase();
    const result = await useCase.execute(
      remoteFlow({
        aiTools: [...catalogOf().idsInCanonicalOrder("ai")],
        ideTools: [...catalogOf().idsInCanonicalOrder("ide")],
      }),
      catalogOf()
    );

    expect(result.kind).toBe("initialized");
    if (result.kind === "initialized") {
      expect(result.install.results.length).toBeGreaterThan(0);
    }
  });

  it("fresh project without tool flags initializes docs only and installs no tools", async () => {
    const { useCase } = await buildUseCase();
    const result = await useCase.execute(remoteFlow(), catalogOf());

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
        aiTools: [...catalogOf().idsInCanonicalOrder("ai")],
        ideTools: [...catalogOf().idsInCanonicalOrder("ide")],
      }),
      catalogOf()
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
        aiTools: [...catalogOf().idsInCanonicalOrder("ai")],
        ideTools: [...catalogOf().idsInCanonicalOrder("ide")],
      }),
      catalogOf()
    );

    expect(result.kind).toBe("up-to-date");
    if (result.kind === "up-to-date") {
      expect(result.install.results.length).toBeGreaterThan(0);
    }
  });

  it("manifest exists without tool flags returns up-to-date with empty install", async () => {
    const { useCase, deps } = await buildUseCase();
    await initProject(deps, PROJECT_ROOT);

    const result = await useCase.execute(remoteFlow(), catalogOf());

    expect(result.kind).toBe("up-to-date");
    if (result.kind === "up-to-date") {
      expect(result.install.results).toHaveLength(0);
    }
  });

  it("project already up to date — exits without error", async () => {
    const { useCase, deps } = await buildUseCase();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);

    const result = await useCase.execute(remoteFlow(), catalogOf());

    expect(result.kind).toBe("up-to-date");
  });

  it("hands the detected project context back with the result", async () => {
    const { useCase, deps } = await buildUseCase(undefined, undefined, undefined, {
      detectContext: true,
    });
    deps.fs.setFile(join(PROJECT_ROOT, "tsconfig.json"), "{}");

    const result = await useCase.execute(remoteFlow(), catalogOf());

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
        source: MarketplaceSourceMode.remote(),
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

      await useCase.execute(namedFlow(true), catalogOf());

      expect(pluginInstallFromMarketplace.execute).toHaveBeenCalledTimes(1);
      expect(pluginInstallFromMarketplace.execute).toHaveBeenCalledWith({
        tools: expect.objectContaining({ inHelpOrder: expect.any(Function) }),
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

      await useCase.execute(namedFlow(false), catalogOf());

      expect(pluginInstallFromMarketplace.execute).not.toHaveBeenCalled();
    });
  });

  describe("default marketplace opt-out (#197)", () => {
    it("registers framework marketplace by default", async () => {
      const { useCase, marketplaceRegisterFramework, marketplaceRefresh } = await buildUseCase();
      await useCase.execute(remoteFlow({ aiTools: [TOOL.claude] }), catalogOf());
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
          source: MarketplaceSourceMode.remote(),
          aiTools: [TOOL.claude],
          ideTools: [],
          pluginMode: "none",
          interactive: false,
          registerDefaultMarketplace: false,
        }),
        catalogOf()
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
          source: MarketplaceSourceMode.remote(),
          aiTools: [TOOL.claude],
          ideTools: [],
          pluginMode: "none",
          interactive: false,
          registerDefaultMarketplace: false,
        }),
        catalogOf()
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
      const { useCase, deps } = await buildUseCase(undefined, userSourceReferences);

      await useCase.execute(remoteFlow({ aiTools: [TOOL.claude] }), catalogOf());

      expect(userSourceReferences.added).toEqual([
        { version: deps.currentVersionProvider.get(), projectRoot: PROJECT_ROOT },
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
          source: MarketplaceSourceMode.remote(),
          aiTools: [TOOL.claude],
          ideTools: [],
          pluginMode: "none",
          interactive: false,
          registerDefaultMarketplace: false,
        }),
        catalogOf()
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

      const result = await useCase.execute(remoteFlow({ aiTools: [TOOL.claude] }), catalogOf());

      expect(result.kind).toBe("initialized");
      expect(logger.warnMessages.some((m) => m.includes("references.json"))).toBe(true);
    });
  });

  describe("issue #141 — post-uninstall regression", () => {
    it("succeeds when aidd_docs/ and .aidd/ exist but no manifest and no tool dirs", async () => {
      const { useCase, deps } = await buildUseCase();
      deps.fs.writeFile(join(PROJECT_ROOT, "aidd_docs/.keep"), "");
      deps.fs.writeFile(join(PROJECT_ROOT, ".aidd/.keep"), "");

      const result = await useCase.execute(remoteFlow({ aiTools: [TOOL.claude] }), catalogOf());

      expect(result.kind).toBe("initialized");
    });

    it("installs selected tools when only aidd_docs/ survives uninstall", async () => {
      const { useCase, deps } = await buildUseCase();
      deps.fs.writeFile(join(PROJECT_ROOT, "aidd_docs/.keep"), "");
      deps.fs.writeFile(join(PROJECT_ROOT, ".aidd/.keep"), "");

      const result = await useCase.execute(remoteFlow({ aiTools: [TOOL.opencode] }), catalogOf());

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

      const result = await useCase.execute(remoteFlow(), catalogOf());

      expect(result.kind).toBe("initialized");
    });

    it("preserves user files in aidd_docs/ across setup", async () => {
      const { useCase, deps } = await buildUseCase();
      deps.fs.writeFile(join(PROJECT_ROOT, "aidd_docs/.keep"), "");
      deps.fs.writeFile(join(PROJECT_ROOT, ".aidd/.keep"), "");
      deps.fs.writeFile(join(PROJECT_ROOT, "aidd_docs/README.md"), "my custom readme");

      await useCase.execute(remoteFlow({ aiTools: [TOOL.claude] }), catalogOf());

      const content = deps.fs.getFile(join(PROJECT_ROOT, "aidd_docs/README.md")) ?? "";
      expect(content).toBe("my custom readme");
    });
  });
});

describe("setup interactive tool selection", () => {
  function interactiveFlow(
    opts: Partial<{ aiTools: ToolId[]; ideTools: ToolId[] }> = {}
  ): SetupFlow {
    return new SetupFlow({
      ...flowTools(),
      supportsUserScopeActivation: () => true,
      projectRoot: PROJECT_ROOT,
      source: MarketplaceSourceMode.remote(),
      aiTools: opts.aiTools ?? [],
      ideTools: opts.ideTools ?? [],
      pluginMode: "none",
      interactive: true,
    });
  }

  it("interactive + empty tools → prompts and installs user-selected tools", async () => {
    const prompter = new ScriptedPrompter([
      ScriptedPrompter.answer.checkbox(["claude"]),
      ScriptedPrompter.answer.checkbox([]),
    ]);
    const setupToolsPromptUseCase = new SetupToolsPromptUseCase(prompter);
    const { useCase } = await buildUseCase(setupToolsPromptUseCase);

    const result = await useCase.execute(interactiveFlow(), catalogOf());

    expect(result.kind).toBe("initialized");
    if (result.kind === "initialized") {
      const installed = result.install.results.map((r) => r.toolId);
      expect(installed).toContain("claude");
    }
  });

  it("interactive + tools provided via flow → no extra prompt, installs given tools", async () => {
    const prompter = new ScriptedPrompter([]); // no tool prompts expected
    const setupToolsPromptUseCase = new SetupToolsPromptUseCase(prompter);
    const { useCase } = await buildUseCase(setupToolsPromptUseCase);

    const result = await useCase.execute(interactiveFlow({ aiTools: [TOOL.cursor] }), catalogOf());

    expect(result.kind).toBe("initialized");
    if (result.kind === "initialized") {
      const installed = result.install.results.map((r) => r.toolId);
      expect(installed).toContain("cursor");
    }
  });

  it("non-interactive + empty tools → no prompt, installs nothing", async () => {
    const prompter = new ScriptedPrompter([]); // no prompts expected
    const setupToolsPromptUseCase = new SetupToolsPromptUseCase(prompter);
    const { useCase } = await buildUseCase(setupToolsPromptUseCase);

    const result = await useCase.execute(remoteFlow(), catalogOf());

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
      useCase.execute(remoteFlow({ aiTools: [TOOL.claude], scope: "user" }), catalogOf())
    ).rejects.toThrow(UserScopeUnavailableError);
  });

  it("reports a first run as initialized, installing nothing", async () => {
    const userManifestRepo = new InMemoryManifestRepository();
    const { useCase } = await buildUseCase(undefined, undefined, undefined, { userManifestRepo });

    const result = await useCase.execute(
      remoteFlow({ aiTools: [TOOL.claude], scope: "user" }),
      catalogOf()
    );

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

    const result = await useCase.execute(
      remoteFlow({ aiTools: [TOOL.claude], scope: "user" }),
      catalogOf()
    );

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

    await useCase.execute(remoteFlow({ aiTools: [TOOL.claude], scope: "user" }), catalogOf());

    expect(userManifestRepo.getCurrent()?.getInstalledToolIds()).toStrictEqual(["codex", "claude"]);
  });

  it("registers a new tool with no files and saves the manifest once", async () => {
    const userManifestRepo = new InMemoryManifestRepository(Manifest.create());
    const { useCase } = await buildUseCase(undefined, undefined, undefined, { userManifestRepo });

    await useCase.execute(remoteFlow({ aiTools: [TOOL.claude], scope: "user" }), catalogOf());

    expect(userManifestRepo.getCurrent()?.getToolFiles(TOOL.claude)).toStrictEqual([]);
    expect(userManifestRepo.saveCount).toBe(1);
  });

  it("leaves an already-registered tool at its recorded version, saving nothing", async () => {
    const seed = Manifest.create();
    seed.addTool(TOOL.claude, "9.9.9", []);
    const userManifestRepo = new InMemoryManifestRepository(seed);
    const { useCase } = await buildUseCase(undefined, undefined, undefined, { userManifestRepo });

    await useCase.execute(remoteFlow({ aiTools: [TOOL.claude], scope: "user" }), catalogOf());

    expect(userManifestRepo.getCurrent()?.getToolVersion(TOOL.claude)).toBe("9.9.9");
    expect(userManifestRepo.saveCount).toBe(0);
  });

  it("writes nothing at all under projectRoot — full directory delta, not a list", async () => {
    const userManifestRepo = new InMemoryManifestRepository();
    const { useCase, deps } = await buildUseCase(undefined, undefined, undefined, {
      userManifestRepo,
    });

    await useCase.execute(remoteFlow({ aiTools: [TOOL.claude], scope: "user" }), catalogOf());

    expect(deps.fs.listUnder(PROJECT_ROOT)).toEqual([]);
  });

  it("writes the user manifest, never this project's own .aidd/manifest.json", async () => {
    const userManifestRepo = new InMemoryManifestRepository();
    const { useCase, deps } = await buildUseCase(undefined, undefined, undefined, {
      userManifestRepo,
    });

    await useCase.execute(remoteFlow({ aiTools: [TOOL.claude], scope: "user" }), catalogOf());

    expect(userManifestRepo.getCurrent()?.getInstalledToolIds()).toContain("claude");
    expect(await deps.manifestRepo.load()).toBeNull();
  });

  it("hands the machine-wide sync the tools it registered and the plugins it enabled", async () => {
    const userManifestRepo = new InMemoryManifestRepository();
    const marketplaceSyncSettingsUseCase =
      makeNoOpMarketplaceSyncSettings() as MarketplaceSyncSettings & {
        execute: ReturnType<typeof vi.fn>;
      };
    const { useCase } = await buildUseCase(undefined, undefined, undefined, {
      userManifestRepo,
      marketplaceSyncSettingsUseCase,
    });

    await useCase.execute(remoteFlow({ aiTools: [TOOL.claude], scope: "user" }), catalogOf());

    expect(marketplaceSyncSettingsUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ toolIds: [TOOL.claude], enablePlugins: [] })
    );
  });

  it("never installs framework files nor prompts for plugins — no project delivery at all", async () => {
    const userManifestRepo = new InMemoryManifestRepository();
    const { useCase } = await buildUseCase(undefined, undefined, undefined, { userManifestRepo });

    const result = await useCase.execute(
      remoteFlow({ aiTools: [TOOL.claude], scope: "user" }),
      catalogOf()
    );

    expect(result.install.results).toEqual([]);
  });

  it("records no shared-source reference — there is no project-scope manifest for a later clean to ever decrement", async () => {
    const userManifestRepo = new InMemoryManifestRepository();
    const userSourceReferences = makeRecordingUserSourceReferences();
    const { useCase } = await buildUseCase(undefined, userSourceReferences, undefined, {
      userManifestRepo,
    });

    await useCase.execute(remoteFlow({ aiTools: [TOOL.claude], scope: "user" }), catalogOf());

    expect(userSourceReferences.added).toEqual([]);
  });
});
