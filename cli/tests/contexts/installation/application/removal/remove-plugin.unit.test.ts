import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PluginDistributionLoader } from "../../../../../src/contexts/installation/application/plugin/plugin-distribution-loader.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import {
  InstalledPlugin,
  type PluginEntryData,
} from "../../../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { PluginNotFoundError } from "../../../../../src/shared/domain/errors.js";
import { FileHash } from "../../../../../src/shared/domain/file.js";
import type { AiToolId } from "../../../../../src/shared/domain/tool.js";
import { pluginRemover } from "../../../../helpers/plugin-remover.js";
import { buildAddPlugin } from "../../../../helpers/ports/build-add-plugin.js";
import { buildUnitDeps, initAndInstall } from "../../../../helpers/ports/build-unit-deps.js";
import { fakeBuildSources } from "../../../../helpers/ports/fake-build-sources.js";
import { InMemoryManifestRepository } from "../../../../helpers/ports/in-memory-manifest-repository.js";
import { seedFromDirectory } from "../../../../helpers/ports/seed-from-directory.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.js";
import { cursorHookScriptDir } from "../../testing/cursor-hook-scripts.js";

class RecordingFileAdapter extends InMemoryFileAdapter {
  readonly deletedPaths: string[] = [];
  readonly writtenPaths: string[] = [];

  override async deleteFile(path: string): Promise<void> {
    this.deletedPaths.push(path);
    return super.deleteFile(path);
  }

  override async writeFile(path: string, content: string): Promise<void> {
    this.writtenPaths.push(path);
    return super.writeFile(path, content);
  }
}

class UnreadableFileAdapter extends InMemoryFileAdapter {
  constructor(private readonly unreadablePath: string) {
    super();
  }

  override async readFile(path: string): Promise<string> {
    if (path === this.unreadablePath) {
      throw Object.assign(new Error(`EACCES: permission denied, open '${path}'`), {
        code: "EACCES",
      });
    }
    return super.readFile(path);
  }
}

const PLUGIN_FIXTURE = join(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");
const EXTRA_PLUGIN_FIXTURE = join(
  process.cwd(),
  "tests/fixtures/plugins/claude-format/extra-plugin"
);
const PROJECT_ROOT = "/test-project";
const OPENCODE_JSON = join(PROJECT_ROOT, "opencode.json");

async function installPlugin(
  deps: Awaited<ReturnType<typeof buildUnitDeps>>,
  fixture = PLUGIN_FIXTURE
): Promise<void> {
  await seedFromDirectory(deps.fs, fixture, { useAbsolutePaths: true });
  const addUseCase = buildAddPlugin(
    { fs: deps.fs, logger: deps.logger },
    { project: deps.manifestRepo, user: deps.userManifestRepo },
    {
      distributionLoader: new PluginDistributionLoader(
        deps.pluginFetcher,
        deps.pluginDistributionReader
      ),
      marketplaceRegistry: deps.marketplaceRegistry,
      ...fakeBuildSources(),
    },
    registeredTools()
  );
  await addUseCase.execute({
    source: { kind: "local", path: fixture },
    toolIds: [TOOL.claude],
    projectRoot: PROJECT_ROOT,
    interactive: false,
  });
}

function manifestHolding(
  toolId: AiToolId,
  entry: Partial<PluginEntryData> & { name: string }
): InMemoryManifestRepository {
  const manifest = Manifest.create();
  manifest.addTool(toolId, "1.0.0", []);
  manifest.addPlugin(
    toolId,
    InstalledPlugin.fromJSON({
      source: { kind: "local", path: "/some/path" },
      version: "1.0.0",
      strict: false,
      files: {},
      scope: "project",
      ...entry,
    })
  );
  return new InMemoryManifestRepository(manifest, PROJECT_ROOT);
}

function removeUseCaseOver(
  fs: InMemoryFileAdapter,
  manifestRepo: InMemoryManifestRepository
): ReturnType<typeof pluginRemover> {
  return pluginRemover({ fs, manifestRepo });
}

describe("RemovePlugin", () => {
  describe("remove installed plugin", () => {
    it("deletes plugin files and updates manifest", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
      await installPlugin(deps);

      const removeUseCase = pluginRemover({
        fs: deps.fs,
        manifestRepo: deps.manifestRepo,
        logger: deps.logger,
        activators: deps.nativePluginActivators,
      });
      await removeUseCase.execute({
        pluginName: "sample-plugin",
        toolIds: [TOOL.claude],
        projectRoot: PROJECT_ROOT,
      });

      expect(
        deps.fs.has(join(PROJECT_ROOT, ".claude/plugins/sample-plugin/commands/greet.md"))
      ).toBe(false);
      const manifest = await deps.manifestRepo.load();
      const plugins = manifest?.getPlugins(TOOL.claude) ?? [];
      expect(plugins.some((p) => p.name === "sample-plugin")).toBe(false);
    });
  });

  describe("remove missing plugin", () => {
    it("throws PluginNotFoundError", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);

      const removeUseCase = pluginRemover({
        fs: deps.fs,
        manifestRepo: deps.manifestRepo,
        logger: deps.logger,
        activators: deps.nativePluginActivators,
      });
      await expect(
        removeUseCase.execute({
          pluginName: "nonexistent-plugin",
          toolIds: [TOOL.claude],
          projectRoot: PROJECT_ROOT,
        })
      ).rejects.toThrow(PluginNotFoundError);
    });
  });

  describe("scope from the manifest wins over the tool's current profile", () => {
    it("deletes a cursor plugin's files under projectRoot when the manifest says scope: project, never under ~/.cursor/plugins/local", async () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.cursor, "1.0.0", []);
      const pluginKey = "aidd-context/commands/hello.md";
      manifest.addPlugin(
        TOOL.cursor,
        InstalledPlugin.fromJSON({
          name: "aidd-context",
          source: { kind: "local", path: "/some/path" },
          version: "1.0.0",
          strict: false,
          files: { [pluginKey]: "abc123abc123abc123abc123abc123ab" },
          // Disagrees with cursor's own profile, which declares installScope "user".
          scope: "project",
        })
      );
      const fs = new RecordingFileAdapter();
      const manifestRepo = new InMemoryManifestRepository(manifest, PROJECT_ROOT);
      const removeUseCase = pluginRemover({ fs, manifestRepo });

      await removeUseCase.execute({
        pluginName: "aidd-context",
        toolIds: [TOOL.cursor],
        projectRoot: PROJECT_ROOT,
      });

      expect(fs.deletedPaths).toContain(join(PROJECT_ROOT, pluginKey));
      expect(fs.deletedPaths.some((p) => p.includes(join(".cursor", "plugins", "local")))).toBe(
        false
      );
    });
  });

  describe("only the named plugin", () => {
    it("deletes only the named plugin's files when another plugin is installed", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
      await installPlugin(deps);
      await installPlugin(deps, EXTRA_PLUGIN_FIXTURE);
      const greet = join(PROJECT_ROOT, ".claude/plugins/sample-plugin/commands/greet.md");
      const bye = join(PROJECT_ROOT, ".claude/plugins/extra-plugin/commands/bye.md");

      await pluginRemover({
        fs: deps.fs,
        manifestRepo: deps.manifestRepo,
        logger: deps.logger,
        activators: deps.nativePluginActivators,
      }).execute({
        pluginName: "extra-plugin",
        toolIds: [TOOL.claude],
        projectRoot: PROJECT_ROOT,
      });

      expect([deps.fs.has(greet), deps.fs.has(bye)]).toStrictEqual([true, false]);
      expect(
        deps.manifestRepo
          .getCurrent()
          ?.getPlugins(TOOL.claude)
          .map((p) => p.name)
      ).toStrictEqual(["sample-plugin"]);
    });
  });

  describe("a tool without native activation", () => {
    it("removes a cursor plugin recorded with a marketplace without driving any host CLI", async () => {
      const manifestRepo = manifestHolding(TOOL.cursor, {
        name: "aidd-context",
        marketplace: "mkt",
      });

      await removeUseCaseOver(new InMemoryFileAdapter(), manifestRepo).execute({
        pluginName: "aidd-context",
        toolIds: [TOOL.cursor],
        projectRoot: PROJECT_ROOT,
      });

      expect(manifestRepo.getCurrent()?.getPlugins(TOOL.cursor)).toStrictEqual([]);
    });
  });

  describe("a tool holding several plugins", () => {
    it("proves removable only the named plugin's hooks, not another plugin's edited ones", async () => {
      const script = `${cursorHookScriptDir("other")}run.js`;
      const manifest = Manifest.create();
      manifest.addTool(TOOL.cursor, "1.0.0", []);
      manifest.addPlugin(
        TOOL.cursor,
        InstalledPlugin.withProjectHooks(
          InstalledPlugin.fromJSON({
            name: "other",
            source: { kind: "local", path: "/other" },
            version: "1.0.0",
            strict: false,
            files: {},
            scope: "project",
          }),
          {
            entries: [],
            scripts: new Map([[script, FileHash.of("// installed").value]]),
          }
        )
      );
      manifest.addPlugin(
        TOOL.cursor,
        InstalledPlugin.fromJSON({
          name: "target",
          source: { kind: "local", path: "/target" },
          version: "1.0.0",
          strict: false,
          files: {},
          scope: "project",
        })
      );
      const fs = new InMemoryFileAdapter();
      fs.setFile(join(PROJECT_ROOT, script), "// edited");
      const manifestRepo = new InMemoryManifestRepository(manifest, PROJECT_ROOT);

      await removeUseCaseOver(fs, manifestRepo).execute({
        pluginName: "target",
        toolIds: [TOOL.cursor],
        projectRoot: PROJECT_ROOT,
      });

      expect(
        manifestRepo
          .getCurrent()
          ?.getPlugins(TOOL.cursor)
          .map((p) => p.name)
      ).toEqual(["other"]);
    });
  });

  describe("MCP entries on removal", () => {
    it("does not rewrite opencode's config when the plugin carries no MCP entries", async () => {
      const fs = new RecordingFileAdapter();
      fs.setFile(OPENCODE_JSON, JSON.stringify({ mcp: { mine: { type: "local" } } }));
      const manifestRepo = manifestHolding(TOOL.opencode, { name: "aidd-context" });

      await removeUseCaseOver(fs, manifestRepo).execute({
        pluginName: "aidd-context",
        toolIds: [TOOL.opencode],
        projectRoot: PROJECT_ROOT,
      });

      expect(fs.writtenPaths).toStrictEqual([]);
    });

    it("leaves a native tool's own MCP file untouched when the plugin carries MCP entries", async () => {
      const fs = new InMemoryFileAdapter();
      const mcpFile = join(PROJECT_ROOT, ".mcp.json");
      const content = JSON.stringify({ mcpServers: { srv: { command: "node" } } });
      fs.setFile(mcpFile, content);
      const manifestRepo = manifestHolding(TOOL.claude, {
        name: "aidd-context",
        mcpEntries: { srv: "abc123" },
      });

      await removeUseCaseOver(fs, manifestRepo).execute({
        pluginName: "aidd-context",
        toolIds: [TOOL.claude],
        projectRoot: PROJECT_ROOT,
      });

      expect(fs.getFile(mcpFile)).toBe(content);
    });

    it("removes the plugin's servers from the opencode config the project already owns", async () => {
      const fs = new InMemoryFileAdapter();
      const ownedConfig = join(PROJECT_ROOT, "opencode.jsonc");
      const server = { type: "local" };
      fs.setFile(ownedConfig, JSON.stringify({ mcp: { srv: server, mine: {} } }));
      const manifestRepo = manifestHolding(TOOL.opencode, {
        name: "aidd-context",
        mcpEntries: { srv: FileHash.of(JSON.stringify(server)).value },
      });

      await removeUseCaseOver(fs, manifestRepo).execute({
        pluginName: "aidd-context",
        toolIds: [TOOL.opencode],
        projectRoot: PROJECT_ROOT,
      });

      expect(JSON.parse(fs.getFile(ownedConfig) ?? "{}")).toEqual({ mcp: { mine: {} } });
    });

    it("propagates a read failure of opencode's config that is not an absence", async () => {
      const fs = new UnreadableFileAdapter(OPENCODE_JSON);
      fs.setFile(OPENCODE_JSON, "{}");
      const manifestRepo = manifestHolding(TOOL.opencode, {
        name: "aidd-context",
        mcpEntries: { srv: "abc123" },
      });

      await expect(
        removeUseCaseOver(fs, manifestRepo).execute({
          pluginName: "aidd-context",
          toolIds: [TOOL.opencode],
          projectRoot: PROJECT_ROOT,
        })
      ).rejects.toThrow("EACCES: permission denied");
    });
  });
});
