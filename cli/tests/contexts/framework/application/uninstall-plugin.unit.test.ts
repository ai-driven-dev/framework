import { createHash } from "node:crypto";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import "../../../../src/contexts/tools/domain/profiles/claude/profile.js";
import "../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import "../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import { PluginAddUseCase } from "../../../../src/contexts/framework/application/plugin/plugin-add-use-case.js";
import { UninstallPluginUseCase } from "../../../../src/contexts/framework/application/uninstall/uninstall-plugin-use-case.js";
import { UninstallUseCase } from "../../../../src/contexts/framework/application/uninstall/uninstall-use-case.js";
import { Manifest } from "../../../../src/contexts/framework/domain/manifest.js";
import { InstalledPlugin } from "../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import { PluginDistributionReaderAdapter } from "../../../../src/contexts/framework/infrastructure/plugin-distribution-reader-adapter.js";
import { NoManifestError, PluginNotFoundError } from "../../../../src/kernel/errors.js";
import { buildUnitDeps, initAndInstall } from "../../../helpers/ports/build-unit-deps.js";
import { fakeEnsureBuiltMarketplace } from "../../../helpers/ports/fake-ensure-built-marketplace.js";
import { errnoError, FaultingFileAdapter } from "../../../helpers/ports/faulting-file-adapter.js";
import { InMemoryFileAdapter } from "../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../../helpers/ports/in-memory-manifest-repository.js";

const PLUGIN_FIXTURE = join(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");
const PROJECT_ROOT = "/test-project";

describe("UninstallUseCase — plugin scope", () => {
  it("removes plugin files and unregisters from manifest when --plugin <name> given", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    const { seedFromDirectory } = await import("../../../helpers/ports/seed-from-directory.js");
    await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });

    await initAndInstall(deps, PROJECT_ROOT, "claude");

    const reader = new PluginDistributionReaderAdapter(deps.fs);
    await new PluginAddUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.pluginFetcher,
      reader,
      deps.hasher,
      deps.logger,
      deps.marketplaceRegistry,
      fakeEnsureBuiltMarketplace(),
      deps.userManifestRepo
    ).execute({
      source: { kind: "local", path: PLUGIN_FIXTURE },
      toolIds: ["claude"],
      projectRoot: PROJECT_ROOT,
      interactive: false,
    });

    const pluginFile = join(PROJECT_ROOT, ".claude/plugins/sample-plugin/commands/greet.md");
    expect(deps.fs.has(pluginFile)).toBe(true);

    await new UninstallUseCase(deps.fs, deps.manifestRepo, deps.logger).execute({
      toolIds: [],
      projectRoot: PROJECT_ROOT,
      pluginName: "sample-plugin",
    });

    expect(deps.fs.has(pluginFile)).toBe(false);
    const manifest = await deps.manifestRepo.load();
    expect(manifest?.getPlugins("claude").find((p) => p.name === "sample-plugin")).toBeUndefined();
  });

  it("throws PluginNotFoundError when the plugin is not installed on any tool", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initAndInstall(deps, PROJECT_ROOT, "claude");

    await expect(
      new UninstallUseCase(deps.fs, deps.manifestRepo, deps.logger).execute({
        toolIds: [],
        projectRoot: PROJECT_ROOT,
        pluginName: "nonexistent",
      })
    ).rejects.toThrow(PluginNotFoundError);
  });
});

describe("UninstallPluginUseCase — which plugin, on which tools", () => {
  it.each([
    { name: "missing", error: null },
    { name: "unreadable", error: errnoError("EACCES") },
  ])("handles an $name OpenCode MCP config without losing the project record", async (scenario) => {
    const manifest = Manifest.create();
    manifest.addTool("opencode", "1.0.0", []);
    manifest.addPlugin(
      "opencode",
      InstalledPlugin.fromJSON({
        name: "sample",
        source: { kind: "local", path: "/some/path" },
        version: "1.0.0",
        strict: false,
        files: {},
        mcpEntries: {
          mine: createHash("md5")
            .update(JSON.stringify({ type: "local" }))
            .digest("hex"),
        },
        scope: "project",
      })
    );
    const fs = new FaultingFileAdapter();
    if (scenario.error !== null)
      fs.failOn("readFile", join(PROJECT_ROOT, "opencode.json"), scenario.error);
    const repo = new InMemoryManifestRepository(manifest);
    const operation = new UninstallPluginUseCase(fs, repo).execute({
      pluginName: "sample",
      toolIds: ["opencode"],
      projectRoot: PROJECT_ROOT,
    });

    if (scenario.error === null) {
      await expect(operation).resolves.toEqual([
        { toolId: "opencode", fileCount: 0, deletedFiles: [] },
      ]);
      expect(repo.getCurrent()?.getPlugins("opencode")).toEqual([]);
    } else {
      await expect(operation).rejects.toThrow(/EACCES/);
      expect(repo.getCurrent()?.getPlugins("opencode")).toHaveLength(1);
      expect(repo.saveCount).toBe(0);
    }
  });

  it("retains the OpenCode plugin projection when its local MCP config cannot be rewritten", async () => {
    const mcpPath = join(PROJECT_ROOT, "opencode.json");
    const content = JSON.stringify({ mcp: { mine: { type: "local" } } });
    class RefusingMcpWriteAdapter extends InMemoryFileAdapter {
      override async writeFile(path: string, value: string): Promise<void> {
        if (path === mcpPath) throw new Error("MCP write refused");
        return super.writeFile(path, value);
      }
    }
    const fs = new RefusingMcpWriteAdapter({ [mcpPath]: content });
    const manifest = Manifest.create();
    manifest.addTool("opencode", "1.0.0", []);
    manifest.addPlugin(
      "opencode",
      InstalledPlugin.fromJSON({
        name: "sample",
        source: { kind: "local", path: "/some/path" },
        version: "1.0.0",
        strict: false,
        files: {},
        mcpEntries: {
          mine: createHash("md5")
            .update(JSON.stringify({ type: "local" }))
            .digest("hex"),
        },
        scope: "project",
      })
    );
    const repo = new InMemoryManifestRepository(manifest);

    await expect(
      new UninstallPluginUseCase(fs, repo).execute({
        pluginName: "sample",
        toolIds: ["opencode"],
        projectRoot: PROJECT_ROOT,
      })
    ).rejects.toThrow(/MCP write refused/);

    expect(repo.saveCount).toBe(0);
    expect(repo.getCurrent()?.getPlugins("opencode")).toHaveLength(1);
    expect(fs.getFile(mcpPath)).toBe(content);
  });

  it("unmerges only the installed plugin's OpenCode MCP contribution", async () => {
    const manifest = Manifest.create();
    manifest.addTool("opencode", "1.0.0", []);
    manifest.addPlugin(
      "opencode",
      InstalledPlugin.fromJSON({
        name: "sample",
        source: { kind: "local", path: "/some/path" },
        version: "1.0.0",
        strict: false,
        files: {},
        mcpEntries: {
          mine: createHash("md5")
            .update(JSON.stringify({ type: "local" }))
            .digest("hex"),
        },
        scope: "project",
      })
    );
    const mcpPath = join(PROJECT_ROOT, "opencode.json");
    const fs = new InMemoryFileAdapter({
      [mcpPath]: JSON.stringify({ mcp: { mine: { type: "local" }, theirs: { type: "remote" } } }),
    });
    const repo = new InMemoryManifestRepository(manifest);

    fs.setFile(
      mcpPath,
      JSON.stringify({ mcp: { mine: { type: "user-edited" }, theirs: { type: "remote" } } })
    );
    await expect(
      new UninstallPluginUseCase(fs, repo).execute({
        pluginName: "sample",
        toolIds: ["opencode"],
        projectRoot: PROJECT_ROOT,
      })
    ).rejects.toThrow(/edited/);
    expect(repo.getCurrent()?.getPlugins("opencode")).toHaveLength(1);
    fs.setFile(
      mcpPath,
      JSON.stringify({ mcp: { mine: { type: "local" }, theirs: { type: "remote" } } })
    );

    await new UninstallPluginUseCase(fs, repo).execute({
      pluginName: "sample",
      toolIds: ["opencode"],
      projectRoot: PROJECT_ROOT,
    });

    expect(JSON.parse(fs.getFile(mcpPath) ?? "null")).toEqual({
      mcp: { theirs: { type: "remote" } },
    });
    expect((await repo.load())?.getPlugins("opencode")).toEqual([]);
  });

  const HASH = "abc123abc123abc123abc123abc123ab";

  function pluginNamed(name: string): InstalledPlugin {
    return InstalledPlugin.fromJSON({
      name,
      source: { kind: "local", path: "/some/path" },
      version: "1.0.0",
      strict: false,
      files: { [`commands/${name}.md`]: HASH },
      scope: "project",
    });
  }

  function uninstallOver(manifest: Manifest | null) {
    return new UninstallPluginUseCase(
      new InMemoryFileAdapter(),
      new InMemoryManifestRepository(manifest)
    );
  }

  it("refuses a project that has no manifest", async () => {
    await expect(
      uninstallOver(null).execute({ pluginName: "sample", toolIds: [], projectRoot: PROJECT_ROOT })
    ).rejects.toThrow(NoManifestError);
  });

  it("removes the plugin only from the tools it was asked about", async () => {
    const manifest = Manifest.create();
    manifest.addTool("claude", "1.0.0", []);
    manifest.addTool("codex", "1.0.0", []);
    manifest.addPlugin("claude", pluginNamed("sample"));
    manifest.addPlugin("codex", pluginNamed("sample"));

    const results = await uninstallOver(manifest).execute({
      pluginName: "sample",
      toolIds: ["claude"],
      projectRoot: PROJECT_ROOT,
    });

    expect(results).toStrictEqual([
      { toolId: "claude", fileCount: 1, deletedFiles: ["commands/sample.md"] },
    ]);
    expect(manifest.getPlugins("codex").map((p) => p.name)).toStrictEqual(["sample"]);
  });

  it("removes only the plugin bearing the name asked for", async () => {
    const manifest = Manifest.create();
    manifest.addTool("claude", "1.0.0", []);
    manifest.addPlugin("claude", pluginNamed("sample"));
    manifest.addPlugin("claude", pluginNamed("other"));

    const results = await uninstallOver(manifest).execute({
      pluginName: "other",
      toolIds: [],
      projectRoot: PROJECT_ROOT,
    });

    expect(results).toStrictEqual([
      { toolId: "claude", fileCount: 1, deletedFiles: ["commands/other.md"] },
    ]);
    expect(manifest.getPlugins("claude").map((p) => p.name)).toStrictEqual(["sample"]);
  });
});
