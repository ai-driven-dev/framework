import { describe, expect, it } from "vitest";
import { Manifest } from "../../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { FileHash } from "../../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../../src/shared/domain/installation-file.js";
import type { MergeFileEntry } from "../../../../src/shared/domain/merge.js";
import { ToolNotInManifestError } from "../../../../src/shared/domain/shared.error.js";
import { resolveRegisteredToolId, TOOL } from "../../../shared/testing/registered-tools.builder.js";
import { saying } from "../../../shared/testing/saying.builder.js";

const makeHash = (hex: string): FileHash => new FileHash(hex.padEnd(32, "0"));

const makeFile = (path: string, hashHex: string): InstallationFile =>
  new InstallationFile({
    relativePath: path,
    content: "content",
    hash: makeHash(hashHex),
  });

const claudeFiles = [
  makeFile(".claude/agents/code-reviewer.md", "aabbcc"),
  makeFile(".claude/rules/naming.md", "ddeeff"),
];

describe("Manifest", () => {
  describe("addTool()", () => {
    it("adds a new tool entry", () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "3.0.0", claudeFiles);
      expect(manifest.hasTool(TOOL.claude)).toBe(true);
    });

    it("replaces an existing tool entry", () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "3.0.0", claudeFiles);
      const newFiles = [makeFile(".claude/agents/new-agent.md", "112233")];
      manifest.addTool(TOOL.claude, "3.1.0", newFiles);
      expect(manifest.getToolVersion(TOOL.claude)).toBe("3.1.0");
    });
  });

  describe("removeTool()", () => {
    it("removes only the specified tool", () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "3.0.0", claudeFiles);
      manifest.addTool(TOOL.cursor, "3.0.0", [makeFile(".cursor/rules/naming.md", "445566")]);
      manifest.removeTool(TOOL.claude);
      expect(manifest.hasTool(TOOL.claude)).toBe(false);
      expect(manifest.hasTool(TOOL.cursor)).toBe(true);
    });

    it("aborts when removing a tool that is not installed", () => {
      const manifest = Manifest.create();
      expect(() => manifest.removeTool(TOOL.claude)).toThrow();
    });
  });

  describe("hasTool()", () => {
    it("returns true when tool is installed", () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "3.0.0", claudeFiles);
      expect(manifest.hasTool(TOOL.claude)).toBe(true);
    });

    it("returns false when tool is not installed", () => {
      const manifest = Manifest.create();
      expect(manifest.hasTool(TOOL.claude)).toBe(false);
    });
  });

  describe("getToolVersion()", () => {
    it("returns version for installed tool", () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "3.0.0", claudeFiles);
      expect(manifest.getToolVersion(TOOL.claude)).toBe("3.0.0");
    });

    it("returns undefined for missing tool", () => {
      const manifest = Manifest.create();
      expect(manifest.getToolVersion(TOOL.claude)).toBeUndefined();
    });
  });

  describe("isFileTracked()", () => {
    it("returns true for a file tracked by a tool", () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "3.0.0", claudeFiles);
      expect(manifest.isFileTracked(".claude/agents/code-reviewer.md")).toBe(true);
    });

    it("returns false for a file not in the manifest", () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "3.0.0", claudeFiles);
      expect(manifest.isFileTracked("some/unknown/file.md")).toBe(false);
    });
  });

  describe("ownerOf()", () => {
    const mergeFiles: MergeFileEntry[] = [
      {
        relativePath: ".mcp.json",
        sectionKey: "mcpServers",
        entries: { playwright: makeHash("aabb11"), github: makeHash("ccdd22") },
      },
    ];

    it("answers from the entries it holds, naming the keys of a merge file", () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "3.0.0", claudeFiles);
      manifest.updateToolMergeFiles(TOOL.claude, mergeFiles);

      expect(manifest.ownerOf(".mcp.json")).toStrictEqual({
        owner: "co-owned",
        keys: ["playwright", "github"],
      });
    });
  });

  describe("mergeFiles", () => {
    const mergeFiles: MergeFileEntry[] = [
      {
        relativePath: ".mcp.json",
        sectionKey: "mcpServers",
        entries: {
          playwright: makeHash("aabb11"),
          github: makeHash("ccdd22"),
        },
      },
    ];

    it("addTool stores mergeFiles entries", () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "3.0.0", claudeFiles);
      manifest.updateToolMergeFiles(TOOL.claude, mergeFiles);
      expect(manifest.getMergeFiles(TOOL.claude)).toHaveLength(1);
      expect(manifest.getMergeFiles(TOOL.claude)[0].relativePath).toBe(".mcp.json");
    });

    it("getMergeFiles returns empty array for tool without merge files", () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "3.0.0", claudeFiles);
      expect(manifest.getMergeFiles(TOOL.claude)).toEqual([]);
    });

    it("getMergeFiles returns empty array for missing tool", () => {
      const manifest = Manifest.create();
      expect(manifest.getMergeFiles(TOOL.claude)).toEqual([]);
    });

    it("isFileTracked returns true for merge file paths", () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "3.0.0", claudeFiles);
      manifest.updateToolMergeFiles(TOOL.claude, mergeFiles);
      expect(manifest.isFileTracked(".mcp.json")).toBe(true);
    });

    it("serialization round-trip preserves mergeFiles", () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "3.0.0", claudeFiles);
      manifest.updateToolMergeFiles(TOOL.claude, mergeFiles);
      const restored = Manifest.fromJSON(manifest.toJSON(), resolveRegisteredToolId);
      const restoredMerge = restored.getMergeFiles(TOOL.claude);
      expect(restoredMerge).toHaveLength(1);
      expect(restoredMerge[0].relativePath).toBe(".mcp.json");
      expect(restoredMerge[0].sectionKey).toBe("mcpServers");
      expect(Object.keys(restoredMerge[0].entries)).toEqual(["playwright", "github"]);
      expect(restoredMerge[0].entries.playwright.value).toBe(`aabb11${"0".repeat(26)}`);
    });

    it("toJSON produces version 7", () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "3.0.0", claudeFiles);
      expect(manifest.toJSON().version).toBe(8);
    });
  });

  describe("updateToolMergeFiles()", () => {
    it("updateToolMergeFiles replaces merge files without touching regular files", () => {
      const mergeEntry: MergeFileEntry = {
        relativePath: ".mcp.json",
        sectionKey: "mcpServers",
        entries: { playwright: makeHash("aabb") },
      };
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "3.0.0", claudeFiles);
      manifest.updateToolMergeFiles(TOOL.claude, [mergeEntry]);
      const updatedMerge: MergeFileEntry = {
        relativePath: ".mcp.json",
        sectionKey: "mcpServers",
        entries: {},
      };
      manifest.updateToolMergeFiles(TOOL.claude, [updatedMerge]);
      expect(manifest.getMergeFiles(TOOL.claude)).toEqual([updatedMerge]);
      expect(manifest.getToolFiles(TOOL.claude)).toHaveLength(2);
    });

    it("updateToolMergeFiles throws for uninstalled tool", () => {
      const manifest = Manifest.create();
      expect(() => manifest.updateToolMergeFiles(TOOL.claude, [])).toThrow(saying(/not installed/));
    });
  });

  describe("recordFileHash()", () => {
    it("updates the hash when the file is already tracked", () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "3.0.0", claudeFiles);
      manifest.recordFileHash(TOOL.claude, ".claude/agents/code-reviewer.md", makeHash("999999"));
      const tracked = manifest
        .getToolFiles(TOOL.claude)
        .find((f) => f.relativePath === ".claude/agents/code-reviewer.md");
      expect(tracked?.hash.value).toBe(makeHash("999999").value);
    });

    it("appends a new tracked file entry when the path is not yet tracked", () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.codex, "3.0.0", []);
      manifest.recordFileHash(TOOL.codex, ".codex/config.json", makeHash("abcdef"));
      expect(manifest.isFileTracked(".codex/config.json")).toBe(true);
      const tracked = manifest
        .getToolFiles(TOOL.codex)
        .find((f) => f.relativePath === ".codex/config.json");
      expect(tracked?.hash.value).toBe(makeHash("abcdef").value);
    });

    it("is a no-op when the tool is not installed", () => {
      const manifest = Manifest.create();
      expect(() =>
        manifest.recordFileHash(TOOL.claude, ".claude/settings.json", makeHash("111111"))
      ).not.toThrow();
      expect(manifest.hasTool(TOOL.claude)).toBe(false);
    });
  });

  describe("a tool that is not installed", () => {
    it("has no tracked files", () => {
      expect(Manifest.create().getToolFiles(TOOL.claude)).toStrictEqual([]);
    });

    it("has no native registrations", () => {
      expect(Manifest.create().getNativeRegistrations(TOOL.claude)).toBeUndefined();
    });

    it("refuses native registrations, naming the tool", () => {
      const manifest = Manifest.create();

      expect(() =>
        manifest.setNativeRegistrations(TOOL.claude, {
          binary: "claude",
          marketplaces: [],
          pluginRefs: [],
        })
      ).toThrow(new ToolNotInManifestError("claude").message);
      expect(() =>
        manifest.setNativeRegistrations(TOOL.claude, {
          binary: "claude",
          marketplaces: [],
          pluginRefs: [],
        })
      ).toThrow(ToolNotInManifestError);
    });
  });

  describe("native registrations", () => {
    it("survive a round trip through the document", () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "3.0.0", claudeFiles);
      manifest.setNativeRegistrations(TOOL.claude, {
        binary: "claude",
        marketplaces: [{ alias: "aidd-framework", hostName: "ai-driven-dev" }],
        pluginRefs: ["aidd-context@ai-driven-dev"],
      });

      const restored = Manifest.fromJSON(manifest.toJSON(), resolveRegisteredToolId);

      expect(restored.getNativeRegistrations(TOOL.claude)).toStrictEqual({
        binary: "claude",
        marketplaces: [{ alias: "aidd-framework", hostName: "ai-driven-dev" }],
        pluginRefs: ["aidd-context@ai-driven-dev"],
      });
    });
  });

  describe("re-adding a tool", () => {
    it("keeps its plugins and drops its native registrations", () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "3.0.0", claudeFiles);
      manifest.addPlugin(
        TOOL.claude,
        RecordedPlugin.fromJSON({
          name: "aidd-context",
          source: { kind: "local", path: "/fixture" },
          version: "1.0.0",
          strict: false,
          files: {},
          scope: "project",
        })
      );
      manifest.setNativeRegistrations(TOOL.claude, {
        binary: "claude",
        marketplaces: [],
        pluginRefs: ["aidd-context@ai-driven-dev"],
      });

      manifest.addTool(TOOL.claude, "3.1.0", claudeFiles);

      expect(manifest.getPlugins(TOOL.claude)).toHaveLength(1);
      expect(manifest.getNativeRegistrations(TOOL.claude)).toBeUndefined();
    });
  });

  describe("re-adding a tool, what it keeps", () => {
    it("replaces version and files, empties merge files, keeps plugins", () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "3.0.0", claudeFiles);
      manifest.updateToolMergeFiles(TOOL.claude, [
        { relativePath: ".mcp.json", sectionKey: "mcpServers", entries: {} },
      ]);
      manifest.addPlugin(
        TOOL.claude,
        RecordedPlugin.fromJSON({
          name: "aidd-context",
          source: { kind: "local", path: "/fixture" },
          version: "1.0.0",
          strict: false,
          files: {},
          scope: "project",
        })
      );

      manifest.addTool(TOOL.claude, "3.1.0", [makeFile(".claude/agents/new-agent.md", "112233")]);

      expect(manifest.getToolVersion(TOOL.claude)).toBe("3.1.0");
      expect(manifest.getToolFiles(TOOL.claude).map((f) => f.relativePath)).toStrictEqual([
        ".claude/agents/new-agent.md",
      ]);
      expect(manifest.getMergeFiles(TOOL.claude)).toStrictEqual([]);
      expect(manifest.getPlugins(TOOL.claude).map((p) => p.name)).toStrictEqual(["aidd-context"]);
    });
  });

  describe("getTrackedPathsInDirectory()", () => {
    it("lists the tracked, merged and plugin files under the directory, across tools, and no other", () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "3.0.0", [
        makeFile(".claude/rules/a.md", "aa"),
        makeFile("CLAUDE.md", "bb"),
      ]);
      manifest.updateToolMergeFiles(TOOL.claude, [
        { relativePath: ".claude/settings.json", sectionKey: "hooks", entries: {} },
        { relativePath: ".mcp.json", sectionKey: "mcpServers", entries: {} },
      ]);
      manifest.addTool(TOOL.cursor, "1.0.0", [makeFile(".cursor/rules/b.mdc", "cc")]);
      manifest.addPlugin(
        TOOL.claude,
        RecordedPlugin.fromJSON({
          name: "aidd-context",
          source: { kind: "local", path: "/fixture" },
          version: "1.0.0",
          strict: false,
          files: { ".claude/skills/x.md": "d".repeat(32), "AGENTS.md": "e".repeat(32) },
          scope: "project",
        })
      );

      expect([...manifest.getTrackedPathsInDirectory(".claude/")]).toStrictEqual([
        ".claude/rules/a.md",
        ".claude/settings.json",
        ".claude/skills/x.md",
      ]);
    });
  });

  describe("getInstalledDirectories()", () => {
    it("names each top-level directory a tracked file sits under, with its trailing slash", () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "3.0.0", claudeFiles);
      manifest.addTool(TOOL.cursor, "1.0.0", [makeFile(".cursor/rules/b.mdc", "cc")]);

      expect([...manifest.getInstalledDirectories()]).toStrictEqual([".claude/", ".cursor/"]);
    });
  });
});
