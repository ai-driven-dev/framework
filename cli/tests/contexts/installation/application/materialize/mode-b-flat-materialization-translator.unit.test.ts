import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ModeBFlatMaterializationTranslator } from "../../../../../src/contexts/installation/application/materialize/mode-b-flat-materialization-translator.js";
import { ProjectScopeUnsupportedError } from "../../../../../src/contexts/installation/domain/installation.error.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import {
  errnoError,
  FaultingFileAdapter,
} from "../../../../shared/testing/faulting-file-adapter.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { saying } from "../../../../shared/testing/saying.builder.js";
import { translateDistribution } from "../../testing/fake-build-sources.fake.js";

const PROJECT_ROOT = "/test-project";

function buildDist(name = "test-plugin"): PluginDistribution {
  return new PluginDistribution({
    manifest: { name, version: "1.0.0" },
    format: TOOL.claude,
    files: [
      { relativePath: "commands/hello.md", content: "---\nname: aidd:01:hello\n---\n# Hello" },
    ],
    components: {
      commands: [
        { relativePath: "commands/hello.md", content: "---\nname: aidd:01:hello\n---\n# Hello" },
      ],
      agents: [],
      rules: [],
      skills: [],
      hooks: [],
      mcp: [],
    },
  });
}

function buildAdapter(homedir = "/stub-home") {
  const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
  return {
    adapter: new ModeBFlatMaterializationTranslator(fs, () => homedir, translateDistribution),
    fs,
  };
}

describe("ModeBFlatMaterializationTranslator", () => {
  describe("mode discriminant", () => {
    it("exposes mode as flat", () => {
      const { adapter } = buildAdapter();
      expect(adapter.mode).toBe("flat");
    });
  });

  describe("when tool is flat mode", () => {
    it("materializes plugin files in the correct output directory", async () => {
      const { adapter, fs } = buildAdapter();
      const manifest = Manifest.create();
      manifest.addTool(TOOL.opencode, "test", []);
      const dist = buildDist("test-plugin");
      await adapter.addPlugin({
        dist,
        tool: registeredTools().aiProfile(TOOL.opencode),
        source: { kind: "local", path: "/plugin-source" },
        projectRoot: PROJECT_ROOT,
        manifest,
        marketplace: undefined,
      });
      const expectedPath = join(PROJECT_ROOT, ".opencode/commands/test-plugin/hello.md");
      expect(fs.has(expectedPath)).toBe(true);
    });

    it("registers plugin in manifest with non-empty files", async () => {
      const { adapter } = buildAdapter();
      const manifest = Manifest.create();
      manifest.addTool(TOOL.opencode, "test", []);
      const dist = buildDist("test-plugin");
      await adapter.addPlugin({
        dist,
        tool: registeredTools().aiProfile(TOOL.opencode),
        source: { kind: "local", path: "/plugin-source" },
        projectRoot: PROJECT_ROOT,
        manifest,
        marketplace: undefined,
      });
      const plugins = manifest.getRecordedPlugins(TOOL.opencode);
      const installed = plugins.find((p) => p.plugin.name === "test-plugin");
      expect(installed).toBeDefined();
      expect(installed?.plugin.files.size).toBeGreaterThan(0);
    });
  });

  describe("when plugin distribution produces no files for the tool", () => {
    it("writes no files and does not add plugin to manifest", async () => {
      const { adapter, fs } = buildAdapter();
      const manifest = Manifest.create();
      manifest.addTool(TOOL.opencode, "test", []);
      const emptyDist = new PluginDistribution({
        manifest: { name: "empty-plugin", version: "1.0.0" },
        format: TOOL.claude,
        files: [],
        components: { commands: [], agents: [], rules: [], skills: [], hooks: [], mcp: [] },
      });
      await adapter.addPlugin({
        dist: emptyDist,
        tool: registeredTools().aiProfile(TOOL.opencode),
        source: { kind: "local", path: "/plugin-source" },
        projectRoot: PROJECT_ROOT,
        manifest,
        marketplace: undefined,
      });
      expect(fs.listAll().length).toBe(0);
      const plugins = manifest.getRecordedPlugins(TOOL.opencode);
      expect(plugins.find((p) => p.plugin.name === "empty-plugin")).toBeUndefined();
    });
  });

  describe("when tool has native mode and project-scope (not user-scope)", () => {
    it("throws ProjectScopeUnsupportedError", async () => {
      const { adapter } = buildAdapter();
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "test", []);
      const dist = buildDist("test-plugin");
      await expect(
        adapter.addPlugin({
          dist,
          tool: registeredTools().aiProfile(TOOL.claude),
          source: { kind: "local", path: "/plugin-source" },
          projectRoot: PROJECT_ROOT,
          manifest,
          marketplace: undefined,
        })
      ).rejects.toThrow(ProjectScopeUnsupportedError);
    });
  });

  describe("when a flat tool is given the project scope", () => {
    it("does not refuse the project scope the way a native tool does", async () => {
      const { adapter } = buildAdapter();
      const manifest = Manifest.create();
      manifest.addTool(TOOL.antigravity, "test", []);
      const added = adapter.addPlugin({
        dist: buildDist("test-plugin"),
        tool: registeredTools().aiProfile(TOOL.antigravity),
        source: { kind: "local", path: "/plugin-source" },
        projectRoot: PROJECT_ROOT,
        manifest,
        marketplace: undefined,
      });

      await expect(added).resolves.toEqual({ skipped: [] });
    });
  });

  describe("when plugin distribution produces zero translated files", () => {
    it("does nothing for a tool that does not translate any files", async () => {
      const { adapter, fs } = buildAdapter();
      const manifest = Manifest.create();
      manifest.addTool(TOOL.opencode, "test", []);
      // A distribution with mcp-only content which flat mode doesn't translate
      const mcpOnlyDist = new PluginDistribution({
        manifest: { name: "mcp-plugin", version: "1.0.0" },
        format: TOOL.claude,
        files: [{ relativePath: ".mcp.json", content: "{}" }],
        components: {
          commands: [],
          agents: [],
          rules: [],
          skills: [],
          hooks: [],
          mcp: [{ relativePath: ".mcp.json", content: "{}" }],
        },
      });
      await adapter.addPlugin({
        dist: mcpOnlyDist,
        tool: registeredTools().aiProfile(TOOL.opencode),
        source: { kind: "local", path: "/plugin-source" },
        projectRoot: PROJECT_ROOT,
        manifest,
        marketplace: undefined,
      });
      expect(fs.listAll().length).toBe(0);
      const plugins = manifest.getRecordedPlugins(TOOL.opencode);
      expect(plugins.find((p) => p.plugin.name === "mcp-plugin")).toBeUndefined();
    });
  });

  describe("when the tool merges the plugin's hooks into the project", () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the Claude hook placeholder the merge rewrites
    const PLUGIN_ROOT_VAR = "${CLAUDE_PLUGIN_ROOT}";
    const SCRIPT_CONTENT = "module.exports = () => {};";

    function hooksDist(): PluginDistribution {
      const hooks = [
        {
          relativePath: "hooks/hooks.json",
          content: JSON.stringify({
            hooks: {
              PreToolUse: [
                { hooks: [{ type: "command", command: `node ${PLUGIN_ROOT_VAR}/hooks/pre.js` }] },
              ],
            },
          }),
        },
        { relativePath: "hooks/pre.js", content: SCRIPT_CONTENT },
      ];
      return new PluginDistribution({
        manifest: { name: "hooks-plugin", version: "1.0.0" },
        format: TOOL.claude,
        files: hooks,
        components: { commands: [], agents: [], rules: [], skills: [], hooks, mcp: [] },
      });
    }

    it("restores an edited project hook script only when told to overwrite edits", async () => {
      const { adapter, fs } = buildAdapter();
      const cursorManifest = () => {
        const manifest = Manifest.create();
        manifest.addTool(TOOL.cursor, "test", []);
        return manifest;
      };
      const manifest = cursorManifest();
      const source = { kind: "local", path: "/plugin-source" } as const;
      const scriptPath = join(PROJECT_ROOT, ".cursor/hooks/hooks-plugin/pre.js");
      await adapter.addPlugin({
        dist: hooksDist(),
        tool: registeredTools().aiProfile(TOOL.cursor),
        source,
        projectRoot: PROJECT_ROOT,
        manifest,
        marketplace: undefined,
      });
      const installed = manifest
        .getRecordedPlugins(TOOL.cursor)
        .find((p) => p.plugin.name === "hooks-plugin");
      fs.setFile(scriptPath, "user edit");
      const reinstall = (guard?: { overwriteEdited: boolean }) =>
        adapter.addPlugin({
          dist: hooksDist(),
          tool: registeredTools().aiProfile(TOOL.cursor),
          source,
          projectRoot: PROJECT_ROOT,
          manifest: cursorManifest(),
          marketplace: undefined,
          previousMcpEntries: new Map(),
          userScopeDirTaken: false,
          previousProjectHooks: installed?.provenance.projectHooks,
          hooksGuard: guard,
        });

      await expect(reinstall()).rejects.toThrow(saying(/edited after install/));
      expect(fs.getFile(scriptPath)).toBe("user edit");

      await reinstall({ overwriteEdited: true });
      expect(fs.getFile(scriptPath)).toBe(SCRIPT_CONTENT);
    });
  });

  describe("when the tool's MCP config merges the plugin's servers", () => {
    function mcpDist(mcpServers: Record<string, unknown>): PluginDistribution {
      const content = JSON.stringify({ mcpServers });
      return new PluginDistribution({
        manifest: { name: "mcp-plugin", version: "1.0.0" },
        format: TOOL.claude,
        files: [{ relativePath: ".mcp.json", content }],
        components: {
          commands: [],
          agents: [],
          rules: [],
          skills: [],
          hooks: [],
          mcp: [{ relativePath: ".mcp.json", content }],
        },
      });
    }

    it("refuses to unmerge an old server whose recorded digest cannot prove its current bytes", async () => {
      const { adapter, fs } = buildAdapter();
      const configPath = join(PROJECT_ROOT, "opencode.json");
      const userContent = JSON.stringify({ mcp: { "old-tool": { type: "local" } } });
      fs.setFile(configPath, userContent);
      const manifest = Manifest.create();
      manifest.addTool(TOOL.opencode, "test", []);

      await expect(
        adapter.addPlugin({
          dist: mcpDist({}),
          tool: registeredTools().aiProfile(TOOL.opencode),
          source: { kind: "local", path: "/plugin-source" },
          projectRoot: PROJECT_ROOT,
          manifest,
          marketplace: undefined,
          previousMcpEntries: new Map([["old-tool", "digest-of-old-tool"]]),
        })
      ).rejects.toThrow(saying(/edited after install/));

      expect(fs.getFile(configPath)).toBe(userContent);
      expect(manifest.getRecordedPlugins(TOOL.opencode)).toEqual([]);
    });

    it("propagates a failure to read the MCP config other than the file being absent", async () => {
      const fs = new FaultingFileAdapter();
      fs.failOn("readFile", join(PROJECT_ROOT, "opencode.json"), errnoError("EACCES"));
      const adapter = new ModeBFlatMaterializationTranslator(
        fs,
        () => "/stub-home",
        translateDistribution
      );
      const manifest = Manifest.create();
      manifest.addTool(TOOL.opencode, "test", []);

      await expect(
        adapter.addPlugin({
          dist: mcpDist({ "local-tool": { command: "node", args: ["./server.js"] } }),
          tool: registeredTools().aiProfile(TOOL.opencode),
          source: { kind: "local", path: "/plugin-source" },
          projectRoot: PROJECT_ROOT,
          manifest,
          marketplace: undefined,
        })
      ).rejects.toThrow("EACCES: planted by the test");
    });
  });
});
