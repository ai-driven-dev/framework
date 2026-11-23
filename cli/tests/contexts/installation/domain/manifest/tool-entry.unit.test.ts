import { describe, expect, it } from "vitest";
import {
  DuplicatePluginError,
  PluginNotFoundError,
} from "../../../../../src/contexts/installation/contract/installation.error.js";
import {
  createToolEntry,
  parseToolEntry,
  removePluginFromEntry,
  serializeToolEntry,
  type ToolEntry,
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

  describe("when a tool entry is serialized", () => {
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

    it("refuses a document that records one plugin twice", () => {
      expect(() =>
        parseToolEntry(TOOL.claude, {
          toolId: "claude",
          version: "3.0.0",
          files: [],
          plugins: [storedPlugin({}), storedPlugin({ version: "2.0.0" })],
        })
      ).toThrow(DuplicatePluginError);
    });

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

    it("leaves out an empty component map and server map", () => {
      const empty = storedPlugin({ componentPaths: {}, mcpEntries: {} });

      expect(rewritten(empty)).toBe(JSON.stringify([storedPlugin({})]));
    });
  });
});
