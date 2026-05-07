import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { SetupMarketplaceSourceUseCase } from "../../../src/application/use-cases/setup/setup-marketplace-source-use-case.js";
import { SetupPluginsPromptUseCase } from "../../../src/application/use-cases/setup/setup-plugins-prompt-use-case.js";
import { SetupToolsUseCase } from "../../../src/application/use-cases/setup/setup-tools-use-case.js";
import { SetupUseCase } from "../../../src/application/use-cases/setup-use-case.js";
import { MarketplaceSourceMode } from "../../../src/domain/models/marketplace-source-mode.js";
import { SetupFlow } from "../../../src/domain/models/setup-flow.js";
import { AI_TOOL_IDS, IDE_TOOL_IDS, type ToolId } from "../../../src/domain/tools/registry.js";
import { OverwritePrompter } from "../../helpers/ports/scripted-prompter.js";
import {
  buildUnitDeps,
  initAndInstall,
  initProject,
} from "../../helpers/ports/build-unit-deps.js";

function makeNoOpMarketplaceRegisterFramework() {
  return { execute: vi.fn().mockResolvedValue({ registered: false }) } as never;
}

function makeNoOpMarketplaceRefresh() {
  return { execute: vi.fn().mockResolvedValue({ results: [], failedCount: 0 }) } as never;
}

function makeNoOpMarketplaceSyncSettings() {
  return { execute: vi.fn().mockResolvedValue(undefined) } as never;
}

function makeNoOpPluginPick() {
  return { execute: vi.fn().mockResolvedValue({ marketplace: {}, installed: [] }) } as never;
}

function makeNoOpPluginInstallFromMarketplace() {
  return { execute: vi.fn().mockResolvedValue({ marketplace: {}, entry: {} }) } as never;
}

function makeNoOpMarketplaceRegistry() {
  return { list: vi.fn().mockResolvedValue([]) } as never;
}

function makeNoOpResolveMarketplace() {
  return {
    execute: vi.fn().mockResolvedValue({ marketplace: {}, localPath: "", catalog: null }),
  } as never;
}

const PROJECT_ROOT = "/test-project";

async function buildUseCase() {
  const deps = await buildUnitDeps(PROJECT_ROOT);
  const prompter = new OverwritePrompter();
  const setupMarketplaceSourceUseCase = new SetupMarketplaceSourceUseCase(prompter);
  const setupToolsUseCase = new SetupToolsUseCase(
    deps.manifestRepo,
    deps.installRuntimeConfigUseCase,
    deps.installIdeConfigUseCase
  );
  const setupPluginsPromptUseCase = new SetupPluginsPromptUseCase(
    makeNoOpPluginPick(),
    makeNoOpPluginInstallFromMarketplace(),
    makeNoOpMarketplaceRegistry(),
    makeNoOpResolveMarketplace()
  );
  const useCase = new SetupUseCase(
    deps.fs,
    deps.manifestRepo,
    setupMarketplaceSourceUseCase,
    makeNoOpMarketplaceRegisterFramework(),
    makeNoOpMarketplaceRefresh(),
    makeNoOpMarketplaceSyncSettings(),
    setupToolsUseCase,
    setupPluginsPromptUseCase,
    deps.currentVersionProvider
  );
  return { useCase, deps };
}

function remoteFlow(opts: Partial<{ aiTools: ToolId[]; ideTools: ToolId[] }> = {}): SetupFlow {
  return new SetupFlow({
    projectRoot: PROJECT_ROOT,
    source: MarketplaceSourceMode.remote(),
    aiTools: opts.aiTools ?? [],
    ideTools: opts.ideTools ?? [],
    pluginMode: "none",
    interactive: false,
  });
}

describe("setup without TTY", () => {
  it("fresh project with all tools flag initializes and installs all tools", async () => {
    const { useCase } = await buildUseCase();
    const result = await useCase.execute(
      remoteFlow({ aiTools: [...AI_TOOL_IDS], ideTools: [...IDE_TOOL_IDS] })
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
      remoteFlow({ aiTools: [...AI_TOOL_IDS], ideTools: [...IDE_TOOL_IDS] })
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
      remoteFlow({ aiTools: [...AI_TOOL_IDS], ideTools: [...IDE_TOOL_IDS] })
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
    await initAndInstall(deps, PROJECT_ROOT, "claude");

    const result = await useCase.execute(remoteFlow());

    expect(result.kind).toBe("up-to-date");
  });

  describe("issue #141 — post-uninstall regression", () => {
    it("succeeds when aidd_docs/ and .aidd/ exist but no manifest and no tool dirs", async () => {
      const { useCase, deps } = await buildUseCase();
      deps.fs.writeFile(join(PROJECT_ROOT, "aidd_docs/.keep"), "");
      deps.fs.writeFile(join(PROJECT_ROOT, ".aidd/.keep"), "");

      const result = await useCase.execute(remoteFlow({ aiTools: ["claude" as ToolId] }));

      expect(result.kind).toBe("initialized");
    });

    it("installs selected tools when only aidd_docs/ survives uninstall", async () => {
      const { useCase, deps } = await buildUseCase();
      deps.fs.writeFile(join(PROJECT_ROOT, "aidd_docs/.keep"), "");
      deps.fs.writeFile(join(PROJECT_ROOT, ".aidd/.keep"), "");

      const result = await useCase.execute(remoteFlow({ aiTools: ["opencode" as ToolId] }));

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

      await useCase.execute(remoteFlow({ aiTools: ["claude" as ToolId] }));

      const content = deps.fs.getFile(join(PROJECT_ROOT, "aidd_docs/README.md")) ?? "";
      expect(content).toBe("my custom readme");
    });
  });
});
