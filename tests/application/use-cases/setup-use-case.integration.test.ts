import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SetupMarketplaceSourceUseCase } from "../../../src/application/use-cases/setup/setup-marketplace-source-use-case.js";
import { SetupPluginsPromptUseCase } from "../../../src/application/use-cases/setup/setup-plugins-prompt-use-case.js";
import { SetupToolsUseCase } from "../../../src/application/use-cases/setup/setup-tools-use-case.js";
import { SetupUseCase } from "../../../src/application/use-cases/setup-use-case.js";
import { MarketplaceSourceMode } from "../../../src/domain/models/marketplace-source-mode.js";
import { SetupFlow } from "../../../src/domain/models/setup-flow.js";
import { AI_TOOL_IDS, IDE_TOOL_IDS, type ToolId } from "../../../src/domain/tools/registry.js";
import { SilentPrompterAdapter } from "../../../src/infrastructure/adapters/prompter-adapter.js";
import {
  buildDeps,
  cleanupTempProject,
  createTempProject,
  initAndInstall,
  initProject,
} from "./helpers.js";

// Minimal no-op sub-use-case stubs for marketplace (network calls not needed in unit-style integration tests)
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

describe("setup without TTY", () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    ({ tempDir, projectRoot } = await createTempProject());
    process.env.AIDD_SKIP_MARKETPLACE_REFRESH = "1";
  });

  afterEach(async () => {
    delete process.env.AIDD_SKIP_MARKETPLACE_REFRESH;
    await cleanupTempProject(tempDir);
  });

  function buildUseCase() {
    const deps = buildDeps(projectRoot);
    const prompter = new SilentPrompterAdapter();
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
    return new SetupUseCase(
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
  }

  function remoteFlow(opts: Partial<{ aiTools: ToolId[]; ideTools: ToolId[] }> = {}): SetupFlow {
    return new SetupFlow({
      projectRoot,
      source: MarketplaceSourceMode.remote(),
      aiTools: opts.aiTools ?? [],
      ideTools: opts.ideTools ?? [],
      pluginMode: "none",
      interactive: false,
    });
  }

  it("fresh project with all tools flag initializes and installs all tools", async () => {
    const result = await buildUseCase().execute(
      remoteFlow({ aiTools: [...AI_TOOL_IDS], ideTools: [...IDE_TOOL_IDS] })
    );

    expect(result.kind).toBe("initialized");
    if (result.kind === "initialized") {
      expect(result.install.results.length).toBeGreaterThan(0);
    }
  });

  it("fresh project without tool flags initializes docs only and installs no tools", async () => {
    const result = await buildUseCase().execute(remoteFlow());

    expect(result.kind).toBe("initialized");
    if (result.kind === "initialized") {
      expect(result.install.results).toHaveLength(0);
    }
  });

  it("aidd_docs exists without tool signals routes to init and installs tools", async () => {
    await mkdir(join(projectRoot, "aidd_docs"), { recursive: true });

    const result = await buildUseCase().execute(
      remoteFlow({ aiTools: [...AI_TOOL_IDS], ideTools: [...IDE_TOOL_IDS] })
    );

    expect(result.kind).toBe("initialized");
    if (result.kind === "initialized") {
      expect(result.install.results.length).toBeGreaterThan(0);
    }
  });

  it("manifest exists — returns up-to-date even with tool flags (tools still installed)", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    const result = await buildUseCase().execute(
      remoteFlow({ aiTools: [...AI_TOOL_IDS], ideTools: [...IDE_TOOL_IDS] })
    );

    expect(result.kind).toBe("up-to-date");
    if (result.kind === "up-to-date") {
      expect(result.install.results.length).toBeGreaterThan(0);
    }
  });

  it("manifest exists without tool flags returns up-to-date with empty install", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    const result = await buildUseCase().execute(remoteFlow());

    expect(result.kind).toBe("up-to-date");
    if (result.kind === "up-to-date") {
      expect(result.install.results).toHaveLength(0);
    }
  });

  it("project already up to date — exits without error", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    const result = await buildUseCase().execute(remoteFlow());

    expect(result.kind).toBe("up-to-date");
  });

  describe("issue #141 — post-uninstall regression", () => {
    async function seedPostUninstallState() {
      await mkdir(join(projectRoot, "aidd_docs"), { recursive: true });
      await mkdir(join(projectRoot, ".aidd"), { recursive: true });
    }

    it("succeeds when aidd_docs/ and .aidd/ exist but no manifest and no tool dirs", async () => {
      await seedPostUninstallState();

      const result = await buildUseCase().execute(remoteFlow({ aiTools: ["claude" as ToolId] }));

      expect(result.kind).toBe("initialized");
    });

    it("installs selected tools when only aidd_docs/ survives uninstall", async () => {
      await seedPostUninstallState();

      const result = await buildUseCase().execute(remoteFlow({ aiTools: ["opencode" as ToolId] }));

      expect(result.kind).toBe("initialized");
      if (result.kind === "initialized") {
        const opencodeTool = result.install.results.find((r) => r.toolId === "opencode");
        expect(opencodeTool).toBeDefined();
        expect(opencodeTool?.skipped).toBe(false);
      }
    });

    it("does not fail when only aidd_docs/ exists (no manifest)", async () => {
      await seedPostUninstallState();

      const result = await buildUseCase().execute(remoteFlow());

      expect(result.kind).toBe("initialized");
    });

    it("preserves user files in aidd_docs/ across setup", async () => {
      await seedPostUninstallState();
      await writeFile(join(projectRoot, "aidd_docs", "README.md"), "my custom readme");

      await buildUseCase().execute(remoteFlow({ aiTools: ["claude" as ToolId] }));

      const content = await readFile(join(projectRoot, "aidd_docs", "README.md"), "utf-8");
      expect(content).toBe("my custom readme");
    });
  });
});
