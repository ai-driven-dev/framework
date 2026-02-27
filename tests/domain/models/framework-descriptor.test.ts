import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FrameworkDescriptor } from "../../../src/domain/models/framework-descriptor.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(__dirname, "../../fixtures/framework.json");
const fixtureData = JSON.parse(readFileSync(fixturePath, "utf-8")) as unknown;

describe("FrameworkDescriptor", () => {
  describe("fromJson()", () => {
    it("constructs from valid fixture data", () => {
      const descriptor = FrameworkDescriptor.fromJson(fixtureData);
      expect(descriptor.version).toBe("3.0.0");
    });

    it("throws on null input", () => {
      expect(() => FrameworkDescriptor.fromJson(null)).toThrow();
    });

    it("throws on missing version", () => {
      expect(() =>
        FrameworkDescriptor.fromJson({
          content: { agents: { directory: "x", organizationType: "flat", entryFile: null } },
        })
      ).toThrow(/version/);
    });

    it("throws on empty version string", () => {
      expect(() =>
        FrameworkDescriptor.fromJson({
          version: "",
          content: { agents: { directory: "x", organizationType: "flat", entryFile: null } },
        })
      ).toThrow(/version/);
    });

    it("throws on missing content", () => {
      expect(() => FrameworkDescriptor.fromJson({ version: "1.0.0" })).toThrow(/content/);
    });

    it("throws on empty content sections", () => {
      expect(() => FrameworkDescriptor.fromJson({ version: "1.0.0", content: {} })).toThrow(
        /content/
      );
    });

    it("throws on invalid organizationType", () => {
      expect(() =>
        FrameworkDescriptor.fromJson({
          version: "1.0.0",
          content: { agents: { directory: "x", organizationType: "invalid", entryFile: null } },
        })
      ).toThrow(/organizationType/);
    });
  });

  describe("getContentSection()", () => {
    const descriptor = FrameworkDescriptor.fromJson(fixtureData);

    it("returns agents section", () => {
      const section = descriptor.getContentSection("agents");
      expect(section).toBeDefined();
      expect(section?.name).toBe("agents");
      expect(section?.directory).toBe("content/agents");
      expect(section?.organizationType).toBe("flat");
      expect(section?.entryFile).toBeNull();
    });

    it("returns commands section", () => {
      const section = descriptor.getContentSection("commands");
      expect(section).toBeDefined();
      expect(section?.organizationType).toBe("phased");
    });

    it("returns rules section", () => {
      const section = descriptor.getContentSection("rules");
      expect(section).toBeDefined();
      expect(section?.organizationType).toBe("categorized");
    });

    it("returns skills section with entryFile", () => {
      const section = descriptor.getContentSection("skills");
      expect(section).toBeDefined();
      expect(section?.organizationType).toBe("subfoldered");
      expect(section?.entryFile).toBe("SKILL.md");
    });

    it("returns undefined for unknown section name", () => {
      expect(descriptor.getContentSection("nonexistent")).toBeUndefined();
    });
  });

  describe("getTemplate()", () => {
    const descriptor = FrameworkDescriptor.fromJson(fixtureData);

    it("returns memoryBank template", () => {
      const template = descriptor.getTemplate("memoryBank");
      expect(template).toBeDefined();
      expect(template?.path).toBe("templates/memory-bank.md");
    });

    it("returns docsReadme template", () => {
      const template = descriptor.getTemplate("docsReadme");
      expect(template).toBeDefined();
      expect(template?.path).toBe("templates/docs-readme.md");
    });

    it("returns undefined for unknown template name", () => {
      expect(descriptor.getTemplate("unknown")).toBeUndefined();
    });
  });

  describe("getConfig()", () => {
    const descriptor = FrameworkDescriptor.fromJson(fixtureData);

    it("returns mcp config", () => {
      const config = descriptor.getConfig("mcp");
      expect(config).toBeDefined();
      expect(config?.path).toBe(".mcp.json");
    });

    it("returns vscodeDir config", () => {
      const config = descriptor.getConfig("vscodeDir");
      expect(config).toBeDefined();
      expect(config?.path).toBe(".vscode");
    });

    it("returns undefined for unknown config name", () => {
      expect(descriptor.getConfig("unknown")).toBeUndefined();
    });
  });
});
