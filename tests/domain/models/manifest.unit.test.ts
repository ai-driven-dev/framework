import { describe, expect, it } from "vitest";
import { FileHash } from "../../../src/domain/models/file-hash.js";
import { GeneratedFile } from "../../../src/domain/models/generated-file.js";
import { Manifest } from "../../../src/domain/models/manifest.js";
import type { McpExclusion } from "../../../src/domain/models/mcp-exclusion.js";
import type { MergeFileEntry } from "../../../src/domain/models/merge-entry.js";
import type { ToolId } from "../../../src/domain/models/tool-config.js";

const makeHash = (hex: string): FileHash => new FileHash(hex.padEnd(32, "0"));

const makeFile = (path: string, hashHex: string): GeneratedFile =>
  new GeneratedFile({
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
      manifest.addTool("claude" as ToolId, "3.0.0", claudeFiles);
      expect(manifest.hasTool("claude" as ToolId)).toBe(true);
    });

    it("replaces an existing tool entry", () => {
      const manifest = Manifest.create();
      manifest.addTool("claude" as ToolId, "3.0.0", claudeFiles);
      const newFiles = [makeFile(".claude/agents/new-agent.md", "112233")];
      manifest.addTool("claude" as ToolId, "3.1.0", newFiles);
      expect(manifest.getToolVersion("claude" as ToolId)).toBe("3.1.0");
    });
  });

  describe("removeTool()", () => {
    it("removes only the specified tool", () => {
      const manifest = Manifest.create();
      manifest.addTool("claude" as ToolId, "3.0.0", claudeFiles);
      manifest.addTool("cursor" as ToolId, "3.0.0", [
        makeFile(".cursor/rules/naming.md", "445566"),
      ]);
      manifest.removeTool("claude" as ToolId);
      expect(manifest.hasTool("claude" as ToolId)).toBe(false);
      expect(manifest.hasTool("cursor" as ToolId)).toBe(true);
    });

    it("aborts when removing a tool that is not installed", () => {
      const manifest = Manifest.create();
      expect(() => manifest.removeTool("claude" as ToolId)).toThrow();
    });
  });

  describe("hasTool()", () => {
    it("returns true when tool is installed", () => {
      const manifest = Manifest.create();
      manifest.addTool("claude" as ToolId, "3.0.0", claudeFiles);
      expect(manifest.hasTool("claude" as ToolId)).toBe(true);
    });

    it("returns false when tool is not installed", () => {
      const manifest = Manifest.create();
      expect(manifest.hasTool("claude" as ToolId)).toBe(false);
    });
  });

  describe("getToolVersion()", () => {
    it("returns version for installed tool", () => {
      const manifest = Manifest.create();
      manifest.addTool("claude" as ToolId, "3.0.0", claudeFiles);
      expect(manifest.getToolVersion("claude" as ToolId)).toBe("3.0.0");
    });

    it("returns undefined for missing tool", () => {
      const manifest = Manifest.create();
      expect(manifest.getToolVersion("claude" as ToolId)).toBeUndefined();
    });
  });

  describe("serialization round-trip", () => {
    it("fromJSON() rejects unsupported manifest version", () => {
      const manifest = Manifest.create();
      manifest.addTool("claude" as ToolId, "3.0.0", claudeFiles);
      const json = manifest.toJSON();
      const badVersion = { ...json, version: 99 };
      expect(() => Manifest.fromJSON(badVersion)).toThrow(/version/);
    });

    it("toJSON() / fromJSON() preserves tool entries", () => {
      const manifest = Manifest.create();
      manifest.addTool("claude" as ToolId, "3.0.0", claudeFiles);
      manifest.addTool("cursor" as ToolId, "3.0.0", [
        makeFile(".cursor/rules/naming.md", "445566"),
      ]);

      const json = manifest.toJSON();
      const restored = Manifest.fromJSON(json);

      expect(restored.hasTool("claude" as ToolId)).toBe(true);
      expect(restored.hasTool("cursor" as ToolId)).toBe(true);
      expect(restored.getToolVersion("claude" as ToolId)).toBe("3.0.0");
      expect(restored.getToolVersion("cursor" as ToolId)).toBe("3.0.0");
    });

    it("docsDir is always stored in manifest JSON", () => {
      const manifest = Manifest.create("custom_docs");
      const json = manifest.toJSON();
      expect(json.docsDir).toBe("custom_docs");

      const defaultManifest = Manifest.create(Manifest.DEFAULT_DOCS_DIR);
      const defaultJson = defaultManifest.toJSON();
      expect(defaultJson.docsDir).toBe(Manifest.DEFAULT_DOCS_DIR);
    });

    it("file hashes are preserved after round-trip", () => {
      const manifest = Manifest.create();
      manifest.addTool("claude" as ToolId, "3.0.0", claudeFiles);

      const restored = Manifest.fromJSON(manifest.toJSON());
      const restoredJson = restored.toJSON();

      expect(restoredJson.tools.claude).toBeDefined();
      expect(restoredJson.tools.claude.files).toHaveLength(2);
      expect(restoredJson.tools.claude.files[0].hash).toBe(`aabbcc${"0".repeat(26)}`);
    });

    it("fromJSON() reports an error on invalid data", () => {
      expect(() => Manifest.fromJSON(null)).toThrow();
    });
  });

  const docsFiles = [
    makeFile(`${Manifest.DEFAULT_DOCS_DIR}/CLAUDE.md`, "112233"),
    makeFile(`${Manifest.DEFAULT_DOCS_DIR}/memory/project.md`, "445566"),
  ];

  describe("isFileTracked()", () => {
    it("returns true for a file tracked by a tool", () => {
      const manifest = Manifest.create();
      manifest.addTool("claude" as ToolId, "3.0.0", claudeFiles);
      expect(manifest.isFileTracked(".claude/agents/code-reviewer.md")).toBe(true);
    });

    it("returns false for a file not in the manifest", () => {
      const manifest = Manifest.create();
      manifest.addTool("claude" as ToolId, "3.0.0", claudeFiles);
      expect(manifest.isFileTracked("some/unknown/file.md")).toBe(false);
    });

    it("returns true for a file tracked by docs", () => {
      const manifest = Manifest.create();
      manifest.addDocs("3.0.0", docsFiles);
      expect(manifest.isFileTracked(`${Manifest.DEFAULT_DOCS_DIR}/CLAUDE.md`)).toBe(true);
    });

    it("returns true for a file tracked by scripts", () => {
      const manifest = Manifest.create();
      const scriptsFiles = [makeFile("scripts/setup.sh", "778899")];
      manifest.addScripts("1.0.0", scriptsFiles);
      expect(manifest.isFileTracked("scripts/setup.sh")).toBe(true);
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
      manifest.addTool("claude" as ToolId, "3.0.0", claudeFiles, mergeFiles);
      expect(manifest.getMergeFiles("claude" as ToolId)).toHaveLength(1);
      expect(manifest.getMergeFiles("claude" as ToolId)[0].relativePath).toBe(".mcp.json");
    });

    it("getMergeFiles returns empty array for tool without merge files", () => {
      const manifest = Manifest.create();
      manifest.addTool("claude" as ToolId, "3.0.0", claudeFiles);
      expect(manifest.getMergeFiles("claude" as ToolId)).toEqual([]);
    });

    it("getMergeFiles returns empty array for missing tool", () => {
      const manifest = Manifest.create();
      expect(manifest.getMergeFiles("claude" as ToolId)).toEqual([]);
    });

    it("isFileTracked returns true for merge file paths", () => {
      const manifest = Manifest.create();
      manifest.addTool("claude" as ToolId, "3.0.0", claudeFiles, mergeFiles);
      expect(manifest.isFileTracked(".mcp.json")).toBe(true);
    });

    it("serialization round-trip preserves mergeFiles", () => {
      const manifest = Manifest.create();
      manifest.addTool("claude" as ToolId, "3.0.0", claudeFiles, mergeFiles);
      const restored = Manifest.fromJSON(manifest.toJSON());
      const restoredMerge = restored.getMergeFiles("claude" as ToolId);
      expect(restoredMerge).toHaveLength(1);
      expect(restoredMerge[0].relativePath).toBe(".mcp.json");
      expect(restoredMerge[0].sectionKey).toBe("mcpServers");
      expect(Object.keys(restoredMerge[0].entries)).toEqual(["playwright", "github"]);
      expect(restoredMerge[0].entries.playwright.value).toBe(`aabb11${"0".repeat(26)}`);
    });

    it("toJSON produces version 2", () => {
      const manifest = Manifest.create();
      manifest.addTool("claude" as ToolId, "3.0.0", claudeFiles);
      expect(manifest.toJSON().version).toBe(2);
    });
  });

  describe("version validation", () => {
    it("rejects unsupported manifest version", () => {
      const badData = { version: 99, docsDir: "aidd_docs", tools: {}, docs: null, scripts: null };
      expect(() => Manifest.fromJSON(badData)).toThrow(/version/);
    });
  });

  describe("MCP exclusion tracking", () => {
    const exclusionA: McpExclusion = { configPath: ".mcp.json", entryKey: "playwright" };
    const exclusionB: McpExclusion = { configPath: ".mcp.json", entryKey: "github" };

    it("addTool with excludedMcp stores exclusions", () => {
      const manifest = Manifest.create();
      manifest.addTool("claude" as ToolId, "3.0.0", claudeFiles, [], [exclusionA]);
      expect(manifest.getExcludedMcp("claude" as ToolId)).toEqual([exclusionA]);
    });

    it("getExcludedMcp returns empty array for tool without exclusions", () => {
      const manifest = Manifest.create();
      manifest.addTool("claude" as ToolId, "3.0.0", claudeFiles);
      expect(manifest.getExcludedMcp("claude" as ToolId)).toEqual([]);
    });

    it("addExcludedMcp appends and deduplicates", () => {
      const manifest = Manifest.create();
      manifest.addTool("claude" as ToolId, "3.0.0", claudeFiles);
      manifest.addExcludedMcp("claude" as ToolId, [exclusionA]);
      manifest.addExcludedMcp("claude" as ToolId, [exclusionA, exclusionB]);
      const result = manifest.getExcludedMcp("claude" as ToolId);
      expect(result).toHaveLength(2);
      expect(result).toEqual([exclusionA, exclusionB]);
    });

    it("addExcludedMcp throws for uninstalled tool", () => {
      const manifest = Manifest.create();
      expect(() => manifest.addExcludedMcp("claude" as ToolId, [exclusionA])).toThrow(
        /not installed/
      );
    });

    it("removeExcludedMcp removes matching entries", () => {
      const manifest = Manifest.create();
      manifest.addTool("claude" as ToolId, "3.0.0", claudeFiles, [], [exclusionA, exclusionB]);
      manifest.removeExcludedMcp("claude" as ToolId, [exclusionA]);
      expect(manifest.getExcludedMcp("claude" as ToolId)).toEqual([exclusionB]);
    });

    it("removeExcludedMcp throws for uninstalled tool", () => {
      const manifest = Manifest.create();
      expect(() => manifest.removeExcludedMcp("claude" as ToolId, [exclusionA])).toThrow(
        /not installed/
      );
    });

    it("clearExcludedMcp empties the list", () => {
      const manifest = Manifest.create();
      manifest.addTool("claude" as ToolId, "3.0.0", claudeFiles, [], [exclusionA, exclusionB]);
      manifest.clearExcludedMcp("claude" as ToolId);
      expect(manifest.getExcludedMcp("claude" as ToolId)).toEqual([]);
    });

    it("clearExcludedMcp throws for uninstalled tool", () => {
      const manifest = Manifest.create();
      expect(() => manifest.clearExcludedMcp("claude" as ToolId)).toThrow(/not installed/);
    });

    it("toJSON/fromJSON round-trip preserves excludedMcp", () => {
      const manifest = Manifest.create();
      manifest.addTool("claude" as ToolId, "3.0.0", claudeFiles, [], [exclusionA, exclusionB]);
      const restored = Manifest.fromJSON(manifest.toJSON());
      expect(restored.getExcludedMcp("claude" as ToolId)).toEqual([exclusionA, exclusionB]);
    });

    it("fromJSON handles missing excludedMcp (backward compat)", () => {
      const manifest = Manifest.create();
      manifest.addTool("claude" as ToolId, "3.0.0", claudeFiles);
      const json = manifest.toJSON();
      const restored = Manifest.fromJSON(json);
      expect(restored.getExcludedMcp("claude" as ToolId)).toEqual([]);
    });

    it("toJSON omits excludedMcp when empty", () => {
      const manifest = Manifest.create();
      manifest.addTool("claude" as ToolId, "3.0.0", claudeFiles);
      const json = manifest.toJSON();
      expect(json.tools.claude).not.toHaveProperty("excludedMcp");
    });

    it("updateToolMergeFiles replaces merge files without touching regular files", () => {
      const mergeEntry: MergeFileEntry = {
        relativePath: ".mcp.json",
        sectionKey: "mcpServers",
        entries: { playwright: makeHash("aabb") },
      };
      const manifest = Manifest.create();
      manifest.addTool("claude" as ToolId, "3.0.0", claudeFiles, [mergeEntry], [exclusionA]);
      const updatedMerge: MergeFileEntry = {
        relativePath: ".mcp.json",
        sectionKey: "mcpServers",
        entries: {},
      };
      manifest.updateToolMergeFiles("claude" as ToolId, [updatedMerge]);
      expect(manifest.getMergeFiles("claude" as ToolId)).toEqual([updatedMerge]);
      expect(manifest.getToolFiles("claude" as ToolId)).toHaveLength(2);
      expect(manifest.getExcludedMcp("claude" as ToolId)).toEqual([exclusionA]);
    });

    it("updateToolMergeFiles throws for uninstalled tool", () => {
      const manifest = Manifest.create();
      expect(() => manifest.updateToolMergeFiles("claude" as ToolId, [])).toThrow(/not installed/);
    });
  });

  describe("migration v1 → v2", () => {
    const HASH_EXT = "abc123".padEnd(32, "0");
    const HASH_KEY = "def456".padEnd(32, "0");
    const HASH_SET = "fed789".padEnd(32, "0");
    const HASH_CPL = "aabbcc".padEnd(32, "0");

    const v1WithVscode = {
      version: 1,
      docsDir: "aidd_docs",
      tools: {
        copilot: {
          toolId: "copilot",
          version: "1.0.0",
          files: [
            { relativePath: ".vscode/extensions.json", hash: HASH_EXT },
            { relativePath: ".vscode/keybindings.json", hash: HASH_KEY },
            { relativePath: ".vscode/settings.json", hash: HASH_SET },
            { relativePath: ".github/copilot-instructions.md", hash: HASH_CPL },
          ],
          mergeFiles: [],
        },
      },
      docs: null,
      scripts: null,
    };

    const v1CopilotOnly = {
      version: 1,
      docsDir: "aidd_docs",
      tools: {
        copilot: {
          toolId: "copilot",
          version: "1.0.0",
          files: [{ relativePath: ".github/copilot-instructions.md", hash: HASH_CPL }],
          mergeFiles: [],
        },
      },
      docs: null,
      scripts: null,
    };

    const v1NoCopilot = {
      version: 1,
      docsDir: "aidd_docs",
      tools: {},
      docs: null,
      scripts: null,
    };

    const v0 = { version: 0, docsDir: "aidd_docs", tools: {}, docs: null, scripts: null };

    it("moves .vscode/ files from copilot to vscode after migration", () => {
      const manifest = Manifest.fromJSON(JSON.parse(JSON.stringify(v1WithVscode)));
      expect(manifest.hasTool("vscode" as ToolId)).toBe(true);
      const vscodeFiles = manifest.getToolFiles("vscode" as ToolId);
      expect(vscodeFiles).toHaveLength(3);
      const paths = vscodeFiles.map((f) => f.relativePath);
      expect(paths).toContain(".vscode/extensions.json");
      expect(paths).toContain(".vscode/keybindings.json");
      expect(paths).toContain(".vscode/settings.json");
    });

    it("removes .vscode/ files from copilot after migration", () => {
      const manifest = Manifest.fromJSON(JSON.parse(JSON.stringify(v1WithVscode)));
      const copilotFiles = manifest.getToolFiles("copilot" as ToolId);
      expect(copilotFiles).toHaveLength(1);
      expect(copilotFiles[0].relativePath).toBe(".github/copilot-instructions.md");
    });

    it("migration is no-op when copilot has no .vscode/ files", () => {
      const manifest = Manifest.fromJSON(JSON.parse(JSON.stringify(v1CopilotOnly)));
      expect(manifest.hasTool("vscode" as ToolId)).toBe(false);
      expect(manifest.getToolFiles("copilot" as ToolId)).toHaveLength(1);
    });

    it("migration is no-op when no copilot entry exists", () => {
      const manifest = Manifest.fromJSON(JSON.parse(JSON.stringify(v1NoCopilot)));
      expect(manifest.hasTool("vscode" as ToolId)).toBe(false);
      expect(manifest.hasTool("copilot" as ToolId)).toBe(false);
    });

    it("v2 manifest loads without migration", () => {
      const manifest = Manifest.create();
      manifest.addTool("copilot" as ToolId, "1.0.0", []);
      const json = manifest.toJSON();
      expect(json.version).toBe(2);
      expect(() => Manifest.fromJSON(json)).not.toThrow();
    });

    it("v0 manifest throws ManifestValidationError", () => {
      expect(() => Manifest.fromJSON(v0)).toThrow(/version/);
    });

    it("isFileTracked returns true for migrated .vscode/ file", () => {
      const manifest = Manifest.fromJSON(JSON.parse(JSON.stringify(v1WithVscode)));
      expect(manifest.isFileTracked(".vscode/extensions.json")).toBe(true);
    });

    it("getToolVersion returns copilot version for migrated vscode entry", () => {
      const manifest = Manifest.fromJSON(JSON.parse(JSON.stringify(v1WithVscode)));
      expect(manifest.getToolVersion("vscode" as ToolId)).toBe("1.0.0");
    });

    it("does not duplicate files when vscode entry already exists before migration", () => {
      const v1PartiallyMigrated = {
        version: 1,
        docsDir: "aidd_docs",
        tools: {
          copilot: {
            toolId: "copilot",
            version: "1.0.0",
            files: [
              { relativePath: ".vscode/extensions.json", hash: HASH_EXT },
              { relativePath: ".vscode/keybindings.json", hash: HASH_KEY },
              { relativePath: ".github/copilot-instructions.md", hash: HASH_CPL },
            ],
            mergeFiles: [],
          },
          vscode: {
            toolId: "vscode",
            version: "1.0.0",
            files: [{ relativePath: ".vscode/extensions.json", hash: HASH_EXT }],
            mergeFiles: [],
          },
        },
        docs: null,
        scripts: null,
      };

      const manifest = Manifest.fromJSON(JSON.parse(JSON.stringify(v1PartiallyMigrated)));
      const vscodeFiles = manifest.getToolFiles("vscode" as ToolId);
      const paths = vscodeFiles.map((f) => f.relativePath);

      expect(paths.filter((p) => p === ".vscode/extensions.json")).toHaveLength(1);
      expect(paths).toContain(".vscode/keybindings.json");
    });
  });

  describe("addDocs()", () => {
    it("adds docs entry with tracked files", () => {
      const manifest = Manifest.create();
      manifest.addDocs("3.0.0", docsFiles);
      const json = manifest.toJSON();
      expect(json.docs).not.toBeNull();
      expect(json.docs?.version).toBe("3.0.0");
      expect(json.docs?.files).toHaveLength(2);
    });

    it("replaces existing docs entry", () => {
      const manifest = Manifest.create();
      manifest.addDocs("3.0.0", docsFiles);
      manifest.addDocs("3.1.0", [makeFile(`${Manifest.DEFAULT_DOCS_DIR}/CLAUDE.md`, "aabbcc")]);
      const json = manifest.toJSON();
      expect(json.docs?.version).toBe("3.1.0");
      expect(json.docs?.files).toHaveLength(1);
    });

    it("docs serialization round-trip preserves entries", () => {
      const manifest = Manifest.create();
      manifest.addDocs("3.0.0", docsFiles);
      const restored = Manifest.fromJSON(manifest.toJSON());
      const json = restored.toJSON();
      expect(json.docs?.version).toBe("3.0.0");
      expect(json.docs?.files).toHaveLength(2);
    });
  });
});
