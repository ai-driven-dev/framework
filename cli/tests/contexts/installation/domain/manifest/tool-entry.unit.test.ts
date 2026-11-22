import { describe, expect, it } from "vitest";
import { PluginNotFoundError } from "../../../../../src/contexts/installation/domain/installation.error.js";
import {
  createToolEntry,
  parseToolEntry,
  removePluginFromEntry,
  serializeToolEntry,
  type ToolEntry,
  trackedPathsInDirectory,
  updatePluginInEntry,
} from "../../../../../src/contexts/installation/domain/manifest/tool-entry.js";
import type { PluginEntryData } from "../../../../../src/contexts/installation/domain/plugins/plugin-entry.js";
import { RecordedPlugin } from "../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../../../src/shared/domain/installation-file.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const makePlugin = (name: string, version = "1.0.0"): RecordedPlugin =>
  RecordedPlugin.fromJSON({
    name,
    source: { kind: "github", repo: `owner/${name}` },
    version,
    strict: false,
    files: { [`.claude/plugins/${name}/README.md`]: "c".repeat(32) },
    scope: "project",
  });

const makeEntry = (plugins: RecordedPlugin[]): ToolEntry =>
  createToolEntry({
    toolId: TOOL.claude,
    version: "3.0.0",
    files: [
      new InstallationFile({
        relativePath: ".claude/CLAUDE.md",
        content: "content",
        hash: new FileHash("a".repeat(32)),
      }),
    ],
    mergeFiles: [{ relativePath: ".mcp.json", sectionKey: "mcpServers", entries: {} }],
    existingPlugins: plugins,
  });

describe("a tool's manifest entry", () => {
  describe("removing a plugin", () => {
    it("keeps every other plugin", () => {
      const entry = makeEntry([makePlugin("keep-a"), makePlugin("drop"), makePlugin("keep-b")]);

      const updated = removePluginFromEntry(entry, "drop");

      expect(updated.plugins.map((p) => p.plugin.name)).toStrictEqual(["keep-a", "keep-b"]);
    });

    it("refuses a plugin that is not installed even while others are", () => {
      const entry = makeEntry([makePlugin("installed")]);

      expect(() => removePluginFromEntry(entry, "ghost")).toThrow(PluginNotFoundError);
    });
  });

  describe("updating a plugin", () => {
    it("replaces only the plugin of that name", () => {
      const entry = makeEntry([makePlugin("other"), makePlugin("target")]);

      const updated = updatePluginInEntry(entry, makePlugin("target", "2.0.0"));

      expect(updated.plugins.map((p) => [p.plugin.name, p.plugin.version])).toStrictEqual([
        ["other", "1.0.0"],
        ["target", "2.0.0"],
      ]);
    });

    it("refuses a plugin that is not installed", () => {
      const entry = makeEntry([makePlugin("installed")]);

      expect(() => updatePluginInEntry(entry, makePlugin("ghost"))).toThrow(PluginNotFoundError);
    });
  });

  describe("serialized", () => {
    it("carries what the tool's own CLI was asked to register through a round trip", () => {
      const entry: ToolEntry = {
        ...makeEntry([]),
        nativeRegistrations: {
          binary: "claude",
          marketplaces: [{ alias: "aidd-framework", hostName: "ai-driven-dev" }],
          pluginRefs: ["aidd-context@ai-driven-dev"],
        },
      };

      const data = serializeToolEntry(entry);

      expect(data.nativeRegistrations).toStrictEqual({
        binary: "claude",
        marketplaces: [{ alias: "aidd-framework", hostName: "ai-driven-dev" }],
        pluginRefs: ["aidd-context@ai-driven-dev"],
      });
      expect(parseToolEntry(TOOL.claude, data).nativeRegistrations).toStrictEqual(
        entry.nativeRegistrations
      );
    });

    const storedPlugin = (extra: Record<string, unknown>): PluginEntryData => ({
      name: "aidd-dev",
      source: { kind: "github", repo: "owner/aidd-dev" },
      version: "1.0.0",
      strict: false,
      files: { "a.md": "h1" },
      scope: "user",
      ...extra,
    });
    const rewritten = (plugin: PluginEntryData): string =>
      JSON.stringify(
        serializeToolEntry(
          parseToolEntry(TOOL.claude, {
            toolId: "claude",
            version: "3.0.0",
            files: [],
            plugins: [plugin],
          })
        ).plugins
      );

    it("writes every field of a stored plugin back in its stored order", () => {
      const full = storedPlugin({
        componentPaths: { "a.md": "rules/a.md" },
        mcpEntries: { srv: "d" },
        projectHooks: { entries: [{ event: "e", command: "c", digest: "d" }], scripts: { s: "h" } },
        marketplace: "aidd-framework",
        dependents: ["/project"],
      });

      expect(rewritten(full)).toBe(JSON.stringify([full]));
    });

    it("leaves out an empty component map, server map and dependent list", () => {
      const empty = storedPlugin({ componentPaths: {}, mcpEntries: {}, dependents: [] });

      expect(rewritten(empty)).toBe(JSON.stringify([storedPlugin({})]));
    });
  });
});

describe("trackedPathsInDirectory", () => {
  it("collects the files, merge files and plugin files under the directory across entries", () => {
    const entry = makeEntry([makePlugin("aidd-dev")]);

    expect([...trackedPathsInDirectory([entry], ".claude/")].sort()).toEqual([
      ".claude/CLAUDE.md",
      ".claude/plugins/aidd-dev/README.md",
    ]);
  });

  it("leaves out a path outside the directory", () => {
    expect([...trackedPathsInDirectory([makeEntry([])], ".cursor/")]).toEqual([]);
  });
});
