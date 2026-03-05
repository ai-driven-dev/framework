import { describe, expect, it } from "vitest";
import { FrameworkDescriptor } from "../../../src/domain/models/framework-descriptor.js";

function makeDescriptor() {
  return new FrameworkDescriptor({
    version: "3.2.2",
    contentSections: [
      { name: "agents", directory: "agents", entryFile: null },
      { name: "commands", directory: "commands", entryFile: null },
      { name: "rules", directory: "rules", entryFile: null },
      { name: "skills", directory: "skills", entryFile: "SKILL.md" },
    ],
    templateRefs: [{ name: "agentsMd", path: "aidd_docs/templates/AGENTS.md" }],
    configRefs: [
      { name: "mcp", path: "config/mcp.json" },
      { name: "vscodeDir", path: "config/.vscode" },
    ],
  });
}

describe("FrameworkDescriptor", () => {
  describe("constructor", () => {
    it("stores version", () => {
      const d = makeDescriptor();
      expect(d.version).toBe("3.2.2");
    });

    it("freezes contentSections", () => {
      const d = makeDescriptor();
      expect(Object.isFrozen(d.contentSections)).toBe(true);
    });
  });

  describe("getContentSection()", () => {
    const descriptor = makeDescriptor();

    it("returns agents section", () => {
      const section = descriptor.getContentSection("agents");
      expect(section).toBeDefined();
      expect(section?.name).toBe("agents");
      expect(section?.directory).toBe("agents");
      expect(section?.entryFile).toBeNull();
    });

    it("returns commands section", () => {
      const section = descriptor.getContentSection("commands");
      expect(section).toBeDefined();
      expect(section?.directory).toBe("commands");
    });

    it("returns rules section", () => {
      const section = descriptor.getContentSection("rules");
      expect(section).toBeDefined();
      expect(section?.directory).toBe("rules");
    });

    it("returns skills section with entryFile", () => {
      const section = descriptor.getContentSection("skills");
      expect(section).toBeDefined();
      expect(section?.entryFile).toBe("SKILL.md");
    });

    it("returns undefined for unknown section name", () => {
      expect(descriptor.getContentSection("nonexistent")).toBeUndefined();
    });
  });

  describe("getTemplate()", () => {
    const descriptor = makeDescriptor();

    it("returns agentsMd template", () => {
      const template = descriptor.getTemplate("agentsMd");
      expect(template).toBeDefined();
      expect(template?.path).toBe("aidd_docs/templates/AGENTS.md");
    });

    it("returns undefined for unknown template name", () => {
      expect(descriptor.getTemplate("unknown")).toBeUndefined();
    });
  });

  describe("getConfig()", () => {
    const descriptor = makeDescriptor();

    it("returns mcp config", () => {
      const config = descriptor.getConfig("mcp");
      expect(config).toBeDefined();
      expect(config?.path).toBe("config/mcp.json");
    });

    it("returns vscodeDir config", () => {
      const config = descriptor.getConfig("vscodeDir");
      expect(config).toBeDefined();
      expect(config?.path).toBe("config/.vscode");
    });

    it("returns undefined for unknown config name", () => {
      expect(descriptor.getConfig("unknown")).toBeUndefined();
    });
  });
});
