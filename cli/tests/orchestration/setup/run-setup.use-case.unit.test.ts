import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { remoteFrameworkSource } from "../../../src/contexts/distribution/contract/framework-source.js";
import { ProjectContext } from "../../../src/contexts/installation/contract/project-context.js";
import { UserSourceReferencesAdapter } from "../../../src/contexts/machine-claims/infrastructure/user-source-references-adapter.js";
import { SetupFlow } from "../../../src/orchestration/domain/setup-flow.model.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { initAndInstall, initProject } from "../../shared/testing/installation-deps.builder.js";
import { flowTools, registeredTools, TOOL } from "../../shared/testing/registered-tools.builder.js";
import { saying } from "../../shared/testing/saying.builder.js";
import {
  buildUseCase,
  CURRENT_VERSION,
  makeRecordingUserSourceReferences,
  PROJECT_ROOT,
  remoteFlow,
} from "../testing/run-setup-scenario.builder.js";

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

    await expect(useCase.execute(flow)).rejects.toThrow(saying(/--source/));

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

  it("manifest exists - returns up-to-date even with tool flags (tools still installed)", async () => {
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

  it("project already up to date - exits without error", async () => {
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

  describe("issue #141 - post-uninstall regression", () => {
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
