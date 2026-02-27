import { describe, expect, it } from "vitest";
import { FileHash } from "../../../src/domain/models/file-hash.js";
import { GeneratedFile } from "../../../src/domain/models/generated-file.js";
import { Manifest } from "../../../src/domain/models/manifest.js";
import { ToolId } from "../../../src/domain/models/tool-spec.js";

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
      manifest.addTool(ToolId.Claude, "3.0.0", claudeFiles);
      expect(manifest.hasTool(ToolId.Claude)).toBe(true);
    });

    it("replaces an existing tool entry", () => {
      const manifest = Manifest.create();
      manifest.addTool(ToolId.Claude, "3.0.0", claudeFiles);
      const newFiles = [makeFile(".claude/agents/new-agent.md", "112233")];
      manifest.addTool(ToolId.Claude, "3.1.0", newFiles);
      expect(manifest.getToolVersion(ToolId.Claude)).toBe("3.1.0");
    });
  });

  describe("removeTool()", () => {
    it("removes only the specified tool", () => {
      const manifest = Manifest.create();
      manifest.addTool(ToolId.Claude, "3.0.0", claudeFiles);
      manifest.addTool(ToolId.Cursor, "3.0.0", [makeFile(".cursor/rules/naming.md", "445566")]);
      manifest.removeTool(ToolId.Claude);
      expect(manifest.hasTool(ToolId.Claude)).toBe(false);
      expect(manifest.hasTool(ToolId.Cursor)).toBe(true);
    });

    it("throws when removing a non-existent tool", () => {
      const manifest = Manifest.create();
      expect(() => manifest.removeTool(ToolId.Claude)).toThrow();
    });
  });

  describe("hasTool()", () => {
    it("returns true when tool is installed", () => {
      const manifest = Manifest.create();
      manifest.addTool(ToolId.Claude, "3.0.0", claudeFiles);
      expect(manifest.hasTool(ToolId.Claude)).toBe(true);
    });

    it("returns false when tool is not installed", () => {
      const manifest = Manifest.create();
      expect(manifest.hasTool(ToolId.Claude)).toBe(false);
    });
  });

  describe("getToolVersion()", () => {
    it("returns version for installed tool", () => {
      const manifest = Manifest.create();
      manifest.addTool(ToolId.Claude, "3.0.0", claudeFiles);
      expect(manifest.getToolVersion(ToolId.Claude)).toBe("3.0.0");
    });

    it("returns undefined for missing tool", () => {
      const manifest = Manifest.create();
      expect(manifest.getToolVersion(ToolId.Claude)).toBeUndefined();
    });
  });

  describe("computeStatus()", () => {
    it("returns empty report when all files are in sync", () => {
      const manifest = Manifest.create();
      manifest.addTool(ToolId.Claude, "3.0.0", claudeFiles);

      const diskHashes = new Map([
        [".claude/agents/code-reviewer.md", makeHash("aabbcc")],
        [".claude/rules/naming.md", makeHash("ddeeff")],
      ]);

      const report = manifest.computeStatus(diskHashes);
      expect(report.isEmpty()).toBe(true);
    });

    it("detects modified file (hash mismatch)", () => {
      const manifest = Manifest.create();
      manifest.addTool(ToolId.Claude, "3.0.0", claudeFiles);

      const diskHashes = new Map([
        [".claude/agents/code-reviewer.md", makeHash("999999")],
        [".claude/rules/naming.md", makeHash("ddeeff")],
      ]);

      const report = manifest.computeStatus(diskHashes);
      expect(report.modified).toContain(".claude/agents/code-reviewer.md");
      expect(report.deleted).toHaveLength(0);
    });

    it("detects deleted file (in manifest but not on disk)", () => {
      const manifest = Manifest.create();
      manifest.addTool(ToolId.Claude, "3.0.0", claudeFiles);

      const diskHashes = new Map([[".claude/rules/naming.md", makeHash("ddeeff")]]);

      const report = manifest.computeStatus(diskHashes);
      expect(report.deleted).toContain(".claude/agents/code-reviewer.md");
    });

    it("detects untracked file (on disk but not in manifest)", () => {
      const manifest = Manifest.create();
      manifest.addTool(ToolId.Claude, "3.0.0", claudeFiles);

      const diskHashes = new Map([
        [".claude/agents/code-reviewer.md", makeHash("aabbcc")],
        [".claude/rules/naming.md", makeHash("ddeeff")],
        [".claude/agents/extra.md", makeHash("ffffff")],
      ]);

      const report = manifest.computeStatus(diskHashes);
      expect(report.untracked).toContain(".claude/agents/extra.md");
    });

    it("handles mixed scenario: modified + deleted + untracked", () => {
      const manifest = Manifest.create();
      manifest.addTool(ToolId.Claude, "3.0.0", claudeFiles);

      const diskHashes = new Map([
        [".claude/agents/code-reviewer.md", makeHash("999999")],
        [".claude/extra.md", makeHash("000000")],
      ]);

      const report = manifest.computeStatus(diskHashes);
      expect(report.modified).toContain(".claude/agents/code-reviewer.md");
      expect(report.deleted).toContain(".claude/rules/naming.md");
      expect(report.untracked).toContain(".claude/extra.md");
    });
  });

  describe("serialization round-trip", () => {
    it("fromJSON() throws on unsupported manifest version", () => {
      const manifest = Manifest.create();
      manifest.addTool(ToolId.Claude, "3.0.0", claudeFiles);
      const json = manifest.toJSON();
      const badVersion = { ...json, version: "99" };
      expect(() => Manifest.fromJSON(badVersion)).toThrow(/version/);
    });

    it("toJSON() / fromJSON() preserves tool entries", () => {
      const manifest = Manifest.create();
      manifest.addTool(ToolId.Claude, "3.0.0", claudeFiles);
      manifest.addTool(ToolId.Cursor, "3.0.0", [makeFile(".cursor/rules/naming.md", "445566")]);

      const json = manifest.toJSON();
      const restored = Manifest.fromJSON(json);

      expect(restored.hasTool(ToolId.Claude)).toBe(true);
      expect(restored.hasTool(ToolId.Cursor)).toBe(true);
      expect(restored.getToolVersion(ToolId.Claude)).toBe("3.0.0");
      expect(restored.getToolVersion(ToolId.Cursor)).toBe("3.0.0");
    });

    it("docsDir is preserved only when non-default", () => {
      const manifest = Manifest.create("custom_docs");
      const json = manifest.toJSON();
      expect(json.docsDir).toBe("custom_docs");

      const defaultManifest = Manifest.create("aidd_docs");
      const defaultJson = defaultManifest.toJSON();
      expect(defaultJson.docsDir).toBeUndefined();
    });

    it("file hashes are preserved after round-trip", () => {
      const manifest = Manifest.create();
      manifest.addTool(ToolId.Claude, "3.0.0", claudeFiles);

      const restored = Manifest.fromJSON(manifest.toJSON());

      const diskHashes = new Map([
        [".claude/agents/code-reviewer.md", makeHash("aabbcc")],
        [".claude/rules/naming.md", makeHash("ddeeff")],
      ]);

      const report = restored.computeStatus(diskHashes);
      expect(report.isEmpty()).toBe(true);
    });

    it("fromJSON() throws on invalid data", () => {
      expect(() => Manifest.fromJSON(null)).toThrow();
    });
  });

  const docsFiles = [
    makeFile("aidd_docs/CLAUDE.md", "112233"),
    makeFile("aidd_docs/memory/project.md", "445566"),
  ];

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
      manifest.addDocs("3.1.0", [makeFile("aidd_docs/CLAUDE.md", "aabbcc")]);
      const json = manifest.toJSON();
      expect(json.docs?.version).toBe("3.1.0");
      expect(json.docs?.files).toHaveLength(1);
    });

    it("docs files appear in computeStatus drift detection", () => {
      const manifest = Manifest.create();
      manifest.addDocs("3.0.0", docsFiles);

      const diskHashes = new Map([
        ["aidd_docs/CLAUDE.md", makeHash("999999")], // modified
        ["aidd_docs/memory/project.md", makeHash("445566")], // unchanged
      ]);

      const report = manifest.computeStatus(diskHashes);
      expect(report.modified).toContain("aidd_docs/CLAUDE.md");
      expect(report.modified).not.toContain("aidd_docs/memory/project.md");
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
