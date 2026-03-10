import { describe, expect, it } from "vitest";
import { FileHash } from "../../../src/domain/models/file-hash.js";
import { GeneratedFile } from "../../../src/domain/models/generated-file.js";
import { Manifest } from "../../../src/domain/models/manifest.js";
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
      const badVersion = { ...json, version: "99" };
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

      const defaultManifest = Manifest.create("aidd_docs");
      const defaultJson = defaultManifest.toJSON();
      expect(defaultJson.docsDir).toBe("aidd_docs");
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
