import { describe, expect, it } from "vitest";
import type { RestoreAllPlugins } from "../../../../../src/contexts/installation/application/restore/restore-all-plugins.use-case.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import type { LoadDistribution } from "../../../../../src/contexts/installation/ports/plugin/load-plugin-distribution.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import type { Scope } from "../../../../../src/shared/domain/scope.js";
import type { FileReader } from "../../../../../src/shared/ports/file-reader.js";
import type { FileWriter } from "../../../../../src/shared/ports/file-writer.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { restoreAllPluginsOf } from "../../testing/build-restore.builder.js";
import { fakeBuiltDeps } from "../../testing/fake-build-sources.fake.js";
import { aManifest } from "../../testing/manifest.builder.js";

const noopFs: FileReader & FileWriter = {
  fileExists: async () => false,
  isExecutable: async () => false,
  isDirectory: async () => false,
  realpath: async (path: string) => path,
  readFileHash: async () => new FileHash("00000000000000000000000000000000"),
  readFile: async () => "",
  listDirectory: async () => [],
  listFilesRecursive: async () => [],
  writeFile: async () => {},
  deleteFile: async () => {},
  createDirectory: async () => {},
  deleteEmptyDirectories: async () => {},
  deleteDirectory: async () => {},
};

const emptyDistribution = new PluginDistribution({
  manifest: { name: "aidd-test", version: "1.0.0" },
  format: TOOL.claude,
  files: [],
  components: { skills: [], commands: [], agents: [], rules: [], hooks: [], mcp: [] },
});

const loadEmptyDistribution: LoadDistribution = async () => emptyDistribution;

function nativePlugin(
  files: Record<string, string> = {},
  scope: Scope = "project"
): RecordedPlugin {
  return RecordedPlugin.fromJSON({
    name: "aidd-test",
    source: { kind: "local", path: "/some/path" },
    version: "1.0.0",
    strict: false,
    files,
    scope,
  });
}

describe("RestoreAllPlugins - native-activation tools", () => {
  it("names claude in nativeOnlyToolIds when its only installed plugin tracks zero files", async () => {
    const manifest = aManifest()
      .withTool(TOOL.claude, [])
      .withPlugin(TOOL.claude, nativePlugin({}))
      .build();
    const useCase = restoreAllPluginsOf({
      fs: noopFs,
      loadDistribution: loadEmptyDistribution,
      builtDeps: fakeBuiltDeps(noopFs),
    });

    const result = await useCase.execute({
      projectRoot: "/proj",
      manifest,
      fileFilter: null,
    });

    expect(result.nativeOnlyToolIds).toEqual(["claude"]);
    expect(result.totalFiles).toBe(0);
  });

  it("does not name a tool whose plugin files are actually tracked", async () => {
    const manifest = aManifest()
      .withTool(TOOL.cursor, [])
      .withPlugin(
        TOOL.cursor,
        nativePlugin({ "a/one.md": "00000000000000000000000000000000" }, "user")
      )
      .build();
    const useCase = restoreAllPluginsOf({
      fs: noopFs,
      loadDistribution: loadEmptyDistribution,
      builtDeps: fakeBuiltDeps(noopFs),
    });

    const result = await useCase.execute({
      projectRoot: "/proj",
      manifest,
      fileFilter: null,
    });

    expect(result.nativeOnlyToolIds).toEqual([]);
  });

  it("does not name a tool that has no plugin installed at all", async () => {
    const manifest = Manifest.create();
    manifest.addTool(TOOL.claude, "1.0.0", []);
    const useCase = restoreAllPluginsOf({
      fs: noopFs,
      loadDistribution: loadEmptyDistribution,
      builtDeps: fakeBuiltDeps(noopFs),
    });

    const result = await useCase.execute({
      projectRoot: "/proj",
      manifest,
      fileFilter: null,
    });

    expect(result.nativeOnlyToolIds).toEqual([]);
  });
});

function trackedPlugin(name: string): RecordedPlugin {
  return RecordedPlugin.fromJSON({
    name,
    source: { kind: "local", path: "/some/path" },
    version: "1.0.0",
    strict: false,
    files: { "a/one.md": "00000000000000000000000000000000" },
    scope: "project",
  });
}

describe("RestoreAllPlugins - restricting to one plugin", () => {
  function claudeWithMixedPlugins(): Manifest {
    const manifest = aManifest()
      .withTool(TOOL.claude, [])
      .withPlugin(TOOL.claude, nativePlugin({}))
      .withPlugin(TOOL.claude, trackedPlugin("tracked-plugin"))
      .build();
    return manifest;
  }

  function useCase(): RestoreAllPlugins {
    return restoreAllPluginsOf({
      fs: noopFs,
      loadDistribution: loadEmptyDistribution,
      builtDeps: fakeBuiltDeps(noopFs),
    });
  }

  it("names the tool when the one plugin asked for tracks zero files, whatever its others track", async () => {
    const result = await useCase().execute({
      projectRoot: "/proj",
      manifest: claudeWithMixedPlugins(),
      fileFilter: null,
      pluginName: "aidd-test",
    });

    expect(result.nativeOnlyToolIds).toStrictEqual(["claude"]);
  });

  it("does not name the tool when the plugin asked for tracks files", async () => {
    const result = await useCase().execute({
      projectRoot: "/proj",
      manifest: claudeWithMixedPlugins(),
      fileFilter: null,
      pluginName: "tracked-plugin",
    });

    expect(result.nativeOnlyToolIds).toStrictEqual([]);
  });

  it("does not name the tool when any of its plugins tracks files", async () => {
    const result = await useCase().execute({
      projectRoot: "/proj",
      manifest: claudeWithMixedPlugins(),
      fileFilter: null,
    });

    expect(result.nativeOnlyToolIds).toStrictEqual([]);
  });
});
