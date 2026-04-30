import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InstallFrameworkPluginsUseCase } from "../../../src/application/use-cases/install-framework-plugins-use-case.js";
import { SetupUseCase } from "../../../src/application/use-cases/setup-use-case.js";
import type { FrameworkResolver } from "../../../src/domain/ports/framework-resolver.js";
import { type ToolId, VALID_TOOL_IDS } from "../../../src/domain/tools/registry.js";
import { SilentPrompterAdapter } from "../../../src/infrastructure/adapters/prompter-adapter.js";
import {
  buildDeps,
  cleanupTempProject,
  createTempProject,
  FIXTURE_DIR,
  initAndInstall,
  initProject,
  linuxPlatform,
} from "./helpers.js";

describe("setup without TTY", () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    ({ tempDir, projectRoot } = await createTempProject());
  });

  afterEach(async () => {
    await cleanupTempProject(tempDir);
  });

  function makeResolver(latestVersion = "test"): FrameworkResolver {
    return {
      resolve: vi
        .fn()
        .mockResolvedValue({ path: FIXTURE_DIR, version: latestVersion, source: "local" }),
      fetchLatestVersion: vi.fn().mockResolvedValue(latestVersion),
      getDefaultRepo: vi.fn().mockReturnValue(undefined),
    };
  }

  function makeInstallFrameworkPluginsUseCase(): InstallFrameworkPluginsUseCase {
    return {
      execute: vi
        .fn()
        .mockResolvedValue({ installedCount: 0, skippedCount: 0, deletedCount: 0, warnings: [] }),
    } as unknown as InstallFrameworkPluginsUseCase;
  }

  function buildUseCase(resolver: FrameworkResolver) {
    const deps = buildDeps(projectRoot);
    return new SetupUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      linuxPlatform,
      new SilentPrompterAdapter(),
      resolver,
      makeInstallFrameworkPluginsUseCase()
    );
  }

  async function seedAdoptSignal() {
    const commandDir = join(projectRoot, ".claude", "commands");
    await mkdir(commandDir, { recursive: true });
    await writeFile(
      join(commandDir, "implement.md"),
      "---\nname: aidd:04:implement\ndescription: test\n---\nbody"
    );
  }

  it("fresh project with all tools flag initializes and installs all tools", async () => {
    const result = await buildUseCase(makeResolver()).execute({
      projectRoot,
      path: FIXTURE_DIR,
      interactive: false,
      toolIds: [...VALID_TOOL_IDS],
    });

    expect(result.kind).toBe("initialized");
    if (result.kind === "initialized") {
      expect(result.install.results.length).toBeGreaterThan(0);
    }
  });

  it("fresh project without tool flags initializes docs only and installs no tools", async () => {
    const result = await buildUseCase(makeResolver()).execute({
      projectRoot,
      path: FIXTURE_DIR,
      interactive: false,
    });

    expect(result.kind).toBe("initialized");
    if (result.kind === "initialized") {
      expect(result.install.results).toHaveLength(0);
    }
  });

  it("existing tool files detected with tools and from flags registers the tool in manifest", async () => {
    await seedAdoptSignal();

    const result = await buildUseCase(makeResolver()).execute({
      projectRoot,
      path: FIXTURE_DIR,
      interactive: false,
      toolIds: ["claude" as ToolId],
      from: "test",
    });

    expect(result.kind).toBe("adopted");
  });

  it("existing tool files detected without from flag fails with a clear error", async () => {
    await seedAdoptSignal();

    await expect(
      buildUseCase(makeResolver()).execute({
        projectRoot,
        path: FIXTURE_DIR,
        interactive: false,
        toolIds: [...VALID_TOOL_IDS],
      })
    ).rejects.toThrow(/from/i);
  });

  it("error message includes triggering signal paths when adopt requires version", async () => {
    await seedAdoptSignal();

    await expect(
      buildUseCase(makeResolver()).execute({
        projectRoot,
        path: FIXTURE_DIR,
        interactive: false,
        toolIds: [...VALID_TOOL_IDS],
      })
    ).rejects.toThrow(".claude/commands/implement.md");
  });

  it("aidd_docs exists without tool signals routes to init and installs tools", async () => {
    await mkdir(join(projectRoot, "aidd_docs"), { recursive: true });

    const result = await buildUseCase(makeResolver()).execute({
      projectRoot,
      path: FIXTURE_DIR,
      interactive: false,
      toolIds: [...VALID_TOOL_IDS],
    });

    expect(result.kind).toBe("initialized");
    if (result.kind === "initialized") {
      expect(result.install.results.length).toBeGreaterThan(0);
    }
  });

  it("existing tool files detected without tools flag fails with a clear error", async () => {
    await seedAdoptSignal();

    await expect(
      buildUseCase(makeResolver()).execute({
        projectRoot,
        path: FIXTURE_DIR,
        interactive: false,
      })
    ).rejects.toThrow("--ai or --ide");
  });

  it("manifest exists but no tools installed and all tools flag installs all tools", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    const result = await buildUseCase(makeResolver()).execute({
      projectRoot,
      path: FIXTURE_DIR,
      interactive: false,
      toolIds: [...VALID_TOOL_IDS],
    });

    expect(result.kind).toBe("installed");
    if (result.kind === "installed") {
      expect(result.install.results.length).toBeGreaterThan(0);
    }
  });

  it("manifest exists but no tools installed without tool flags installs nothing", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    const result = await buildUseCase(makeResolver()).execute({
      projectRoot,
      path: FIXTURE_DIR,
      interactive: false,
    });

    expect(result.kind).toBe("installed");
    if (result.kind === "installed") {
      expect(result.install.results).toHaveLength(0);
    }
  });

  it("newer version available updates silently without offering additional tools", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    // "test" is not semver, "v2.0.0" is semver → triggers needs-update
    const result = await buildUseCase(makeResolver("v2.0.0")).execute({
      projectRoot,
      path: FIXTURE_DIR,
      interactive: false,
    });

    expect(result.kind).toBe("updated");
    if (result.kind === "updated") {
      expect(result.additionalInstall).toBeUndefined();
    }
  });

  it("project already up to date — exits without asking to install more tools", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    const result = await buildUseCase(makeResolver()).execute({
      projectRoot,
      path: FIXTURE_DIR,
      interactive: false,
    });

    expect(result.kind).toBe("up-to-date");
  });

  // Regression tests for issue #141:
  // After uninstalling tools, aidd_docs/ and .aidd/ remain but manifest is gone.
  // Running `aidd setup` previously crashed with "Directory '.opencode/' not found for tool 'opencode'".
  describe("issue #141 — post-uninstall regression", () => {
    async function seedPostUninstallState() {
      // Simulate: aidd_docs/ survives uninstall, .aidd/ dir exists but no manifest
      await mkdir(join(projectRoot, "aidd_docs"), { recursive: true });
      await mkdir(join(projectRoot, ".aidd"), { recursive: true });
    }

    it("succeeds when aidd_docs/ and .aidd/ exist but no manifest and no tool dirs", async () => {
      await seedPostUninstallState();

      const result = await buildUseCase(makeResolver()).execute({
        projectRoot,
        path: FIXTURE_DIR,
        interactive: false,
        toolIds: ["claude" as ToolId],
      });

      expect(result.kind).toBe("initialized");
    });

    it("installs selected tools when only aidd_docs/ survives uninstall", async () => {
      await seedPostUninstallState();

      const result = await buildUseCase(makeResolver()).execute({
        projectRoot,
        path: FIXTURE_DIR,
        interactive: false,
        toolIds: ["opencode" as ToolId],
      });

      expect(result.kind).toBe("initialized");
      if (result.kind === "initialized") {
        const opencodeTool = result.install.results.find((r) => r.toolId === "opencode");
        expect(opencodeTool).toBeDefined();
        expect(opencodeTool?.skipped).toBe(false);
      }
    });

    it("does not route to adopt when only aidd_docs/ exists (no tool signal files)", async () => {
      await seedPostUninstallState();

      const result = await buildUseCase(makeResolver()).execute({
        projectRoot,
        path: FIXTURE_DIR,
        interactive: false,
      });

      // Must not be "adopted" — no tool signals exist, adopt flow is wrong here
      expect(result.kind).not.toBe("adopted");
      expect(result.kind).toBe("initialized");
    });

    it("docs in aidd_docs/ are tracked in manifest after setup", async () => {
      await seedPostUninstallState();
      await writeFile(join(projectRoot, "aidd_docs", "README.md"), "my custom readme");

      await buildUseCase(makeResolver()).execute({
        projectRoot,
        path: FIXTURE_DIR,
        interactive: false,
        toolIds: ["claude" as ToolId],
      });

      const { manifestRepo } = buildDeps(projectRoot);
      const manifest = await manifestRepo.load();
      expect(manifest).not.toBeNull();
      const docsFiles = manifest?.getDocsFiles() ?? [];
      expect(docsFiles.some((f) => f.relativePath === "aidd_docs/README.md")).toBe(true);
    });
  });
});
