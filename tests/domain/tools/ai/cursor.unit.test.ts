import { describe, expect, it } from "vitest";
import { cursor } from "../../../../src/domain/tools/ai/cursor.js";

describe("cursor", () => {
  describe("rewriteContent()", () => {
    it("installed content uses the .cursor/ tool directory path", () => {
      const result = cursor.rewriteContent("{{TOOLS}}/rules/", "aidd_docs");
      expect(result).toBe(".cursor/rules/");
    });

    it("installed content uses the configured docs directory path", () => {
      const result = cursor.rewriteContent("{{DOCS}}/memory/", "aidd_docs");
      expect(result).toBe("aidd_docs/memory/");
    });

    it("rule include references in installed content use .mdc extension for Cursor", () => {
      const result = cursor.rewriteContent("@{{TOOLS}}/rules/naming.md", "aidd_docs");
      expect(result).toBe("@.cursor/rules/naming.mdc");
    });

    it("command cross-references in installed content use the AIDD-namespaced path", () => {
      const result = cursor.rewriteContent(
        "See @.cursor/commands/04_code/implement.md for reference",
        "aidd_docs"
      );
      expect(result).toBe("See @.cursor/commands/aidd/04/implement.md for reference");
    });

    it("skills listing bare command paths produce working references in installed content", () => {
      const result = cursor.rewriteContent(
        "1. Brainstorm: {{TOOLS}}/commands/02_context/brainstorm.md",
        "aidd_docs"
      );
      expect(result).toBe("1. Brainstorm: .cursor/commands/aidd/02/brainstorm.md");
    });
  });

  describe("capabilities.rules.convertFrontmatter()", () => {
    it("converts paths: to globs: as JSON inline string and adds alwaysApply: false", () => {
      const result = cursor.capabilities.rules?.convertFrontmatter({
        paths: ["src/**/*.ts"],
      });
      expect(result).toEqual({ globs: '["src/**/*.ts"]', alwaysApply: false });
    });

    it("returns empty frontmatter for rules without paths (always apply)", () => {
      const result = cursor.capabilities.rules?.convertFrontmatter({
        description: "desc",
        alwaysApply: true,
      });
      expect(result).toEqual({});
    });

    it("keeps description and alwaysApply false when no globs are specified", () => {
      const result = cursor.capabilities.rules?.convertFrontmatter({
        description: "Apply when editing command files.",
        alwaysApply: false,
      });
      expect(result).toEqual({
        description: "Apply when editing command files.",
        alwaysApply: false,
      });
    });
  });

  describe("capabilities.agents.convertFrontmatter()", () => {
    it("strips extra fields for agents sections — only name and description", () => {
      const fm = { name: "alexia", description: "Agent", model: "opus" };
      const result = cursor.capabilities.agents.convertFrontmatter(fm);
      expect(result).toEqual({ name: "alexia", description: "Agent" });
    });
  });

  describe("capabilities.commands.convertFrontmatter()", () => {
    it("prefixes name with aidd:<phase>: and strips extra fields", () => {
      const fm = { name: "implement", description: "Implement", model: "sonnet" };
      const result = cursor.capabilities.commands?.convertFrontmatter(fm, "04_code/implement.md");
      expect(result).toEqual({ name: "aidd:04:implement", description: "Implement" });
    });
  });

  describe("capabilities.commands.buildInstallPath()", () => {
    it("maps phase-prefixed path to aidd/<phase>/ subfolder", () => {
      const path = cursor.capabilities.commands?.buildInstallPath("04_code/implement.md");
      expect(path).toBe(".cursor/commands/aidd/04/implement.md");
    });

    it("maps top-level file to aidd/ subfolder without phase", () => {
      const path = cursor.capabilities.commands?.buildInstallPath("commit.md");
      expect(path).toBe(".cursor/commands/aidd/commit.md");
    });
  });

  describe("capabilities.commands.reverseConvertFrontmatter()", () => {
    it("strips aidd:<phase>: prefix from name", () => {
      const result = cursor.capabilities.commands?.reverseConvertFrontmatter({
        name: "aidd:04:implement",
        description: "Impl",
      });
      expect(result).toEqual({ name: "implement", description: "Impl" });
    });
  });

  describe("reverseRewriteContent()", () => {
    it("reverses @.cursor/ to @{{TOOLS}}/", () => {
      const input = "See @.cursor/agents/alexia.md for more";
      const result = cursor.reverseRewriteContent(input, "aidd_docs");
      expect(result).toContain("@{{TOOLS}}/agents/alexia.md");
    });

    it("reverses .mdc extension back to .md in @-references", () => {
      const input = "@.cursor/rules/01-standards/naming.mdc";
      const result = cursor.reverseRewriteContent(input, "aidd_docs");
      expect(result).toContain("@{{TOOLS}}/rules/01-standards/naming.md");
      expect(result).not.toContain(".mdc");
    });

    it("roundtrip: rewrite then reverse produces canonical content", () => {
      const canonical = "Use @{{TOOLS}}/agents/alexia.md and @{{DOCS}}/CATALOG.md";
      const rewritten = cursor.rewriteContent(canonical, "aidd_docs");
      const reversed = cursor.reverseRewriteContent(rewritten, "aidd_docs");
      expect(reversed).toContain("@{{TOOLS}}/agents/alexia.md");
      expect(reversed).toContain("@{{DOCS}}/CATALOG.md");
    });
  });

  describe("capabilities.memory.buildInstallPath()", () => {
    it("returns AGENTS.md for agentsMd template", () => {
      expect(cursor.capabilities.memory.buildInstallPath("agentsMd")).toBe("AGENTS.md");
    });

    it("returns null for unknown template names", () => {
      expect(cursor.capabilities.memory.buildInstallPath("unknown")).toBeNull();
    });
  });

  describe("capabilities.rules.buildInstallPath()", () => {
    it("builds path for rules section with .mdc extension", () => {
      const path = cursor.capabilities.rules?.buildInstallPath("01-standards/naming.md");
      expect(path).toBe(".cursor/rules/01-standards/naming.mdc");
    });
  });

  describe("capabilities.agents.buildInstallPath()", () => {
    it("keeps .md extension for agents", () => {
      const path = cursor.capabilities.agents.buildInstallPath("code-reviewer.md");
      expect(path).toBe(".cursor/agents/code-reviewer.md");
    });
  });

  describe("capabilities.plugins", () => {
    it("has a plugins capability", () => {
      expect("plugins" in cursor.capabilities).toBe(true);
    });

    it("is native mode", () => {
      expect(cursor.capabilities.plugins.mode).toBe("native");
    });

    it("uses .cursor/plugins/ as plugins directory", () => {
      expect(cursor.capabilities.plugins.pluginsDir).toBe(".cursor/plugins/");
    });

    it("uses plugin.json as plugin manifest path", () => {
      expect(cursor.capabilities.plugins.pluginManifestRelativePath).toBe("plugin.json");
    });

    it("pluginOutputDir returns correct path for a plugin name", () => {
      expect(cursor.capabilities.plugins.pluginOutputDir("my-plugin")).toBe(
        ".cursor/plugins/my-plugin/"
      );
    });
  });
});
