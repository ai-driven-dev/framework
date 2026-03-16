import { describe, expect, it } from "vitest";
import { opencodeToolConfig } from "../../../src/domain/tools/opencode.js";

describe("opencodeToolConfig", () => {
  describe("rewriteContent()", () => {
    it("replaces {{TOOLS}}/ with .opencode/", () => {
      const result = opencodeToolConfig.rewriteContent("{{TOOLS}}/agents/", "aidd_docs");
      expect(result).toBe(".opencode/agents/");
    });

    it("replaces {{DOCS}}/ with docsDir/", () => {
      const result = opencodeToolConfig.rewriteContent("{{DOCS}}/memory/", "aidd_docs");
      expect(result).toBe("aidd_docs/memory/");
    });

    it("replaces @{{TOOLS}}/ with @.opencode/", () => {
      const result = opencodeToolConfig.rewriteContent("@{{TOOLS}}/agents/alexia.md", "aidd_docs");
      expect(result).toBe("@.opencode/agents/alexia.md");
    });

    it("replaces @{{DOCS}}/ with @docsDir/", () => {
      const result = opencodeToolConfig.rewriteContent("@{{DOCS}}/memory/project.md", "aidd_docs");
      expect(result).toBe("@aidd_docs/memory/project.md");
    });
  });

  describe("reverseRewriteContent()", () => {
    it("reverses @.opencode/ to @{{TOOLS}}/", () => {
      const result = opencodeToolConfig.reverseRewriteContent(
        "@.opencode/agents/alexia.md",
        "aidd_docs"
      );
      expect(result).toBe("@{{TOOLS}}/agents/alexia.md");
    });

    it("roundtrip: rewrite then reverse produces canonical content", () => {
      const canonical = "Use @{{TOOLS}}/agents/alexia.md and @{{DOCS}}/CATALOG.md";
      const rewritten = opencodeToolConfig.rewriteContent(canonical, "aidd_docs");
      const reversed = opencodeToolConfig.reverseRewriteContent(rewritten, "aidd_docs");
      expect(reversed).toBe(canonical);
    });
  });

  describe("agents().buildFilePath()", () => {
    it("builds path under .opencode/agents/", () => {
      const path = opencodeToolConfig.agents().buildFilePath("code-reviewer.md");
      expect(path).toBe(".opencode/agents/code-reviewer.md");
    });

    it("strips .opencode.md tool suffix", () => {
      const path = opencodeToolConfig.agents().buildFilePath("alexia.opencode.md");
      expect(path).toBe(".opencode/agents/alexia.md");
    });
  });

  describe("agents().convertFrontmatter()", () => {
    it("outputs only description — name comes from filename in OpenCode", () => {
      const fm = { name: "alexia", description: "Act like the user", mode: "subagent" };
      const result = opencodeToolConfig.agents().convertFrontmatter(fm);
      expect(result).toEqual({ description: "Act like the user" });
    });

    it("sync round-trip: name is not recoverable from opencode frontmatter (known trade-off)", () => {
      // claude → opencode drops name (filename is the name in OpenCode).
      // opencode → claude reverse cannot recover name from frontmatter alone.
      const claudeFm = { name: "alexia", description: "Act like the user" };
      const opencodeFm = opencodeToolConfig.agents().convertFrontmatter(claudeFm);
      const canonical = opencodeToolConfig.agents().reverseConvertFrontmatter(opencodeFm);
      expect(canonical).not.toHaveProperty("name");
      expect(canonical).toEqual({ description: "Act like the user" });
    });
  });

  describe("commands().buildFilePath()", () => {
    it("builds path under .opencode/commands/", () => {
      const path = opencodeToolConfig.commands().buildFilePath("04_code/implement.md");
      expect(path).toBe(".opencode/commands/04_code/implement.md");
    });
  });

  describe("commands().convertFrontmatter()", () => {
    it("outputs only description — name comes from filename in OpenCode", () => {
      const fm = { name: "implement", description: "Implement a plan", model: "gpt-4o" };
      const result = opencodeToolConfig.commands().convertFrontmatter(fm, "04_code/implement.md");
      expect(result).toEqual({ description: "Implement a plan" });
    });
  });

  describe("rules().buildFilePath()", () => {
    it("builds path under .opencode/rules/", () => {
      const path = opencodeToolConfig.rules().buildFilePath("01-standards/naming.md");
      expect(path).toBe(".opencode/rules/01-standards/naming.md");
    });
  });

  describe("rules().convertFrontmatter()", () => {
    it("returns empty frontmatter regardless of input", () => {
      const result = opencodeToolConfig.rules().convertFrontmatter({ paths: ["src/**/*.ts"] });
      expect(result).toEqual({});
    });

    it("returns empty frontmatter for always-apply rules", () => {
      const result = opencodeToolConfig.rules().convertFrontmatter({ description: "always" });
      expect(result).toEqual({});
    });
  });

  describe("skills().buildFilePath()", () => {
    it("builds path under .opencode/skills/", () => {
      const path = opencodeToolConfig.skills().buildFilePath("my-skill/SKILL.md");
      expect(path).toBe(".opencode/skills/my-skill/SKILL.md");
    });
  });

  describe("skills().convertFrontmatter()", () => {
    it("preserves all frontmatter fields", () => {
      const fm = { name: "my-skill", description: "A skill" };
      expect(opencodeToolConfig.skills().convertFrontmatter(fm)).toEqual(fm);
    });
  });

  describe("config().outputPath()", () => {
    it("maps opencode config to opencode.json", () => {
      expect(opencodeToolConfig.config().outputPath("opencode")).toBe("opencode.json");
    });

    it("maps mcp config to opencode.json for MCP transform", () => {
      expect(opencodeToolConfig.config().outputPath("mcp")).toBe("opencode.json");
    });

    it("returns null for unknown config names", () => {
      expect(opencodeToolConfig.config().outputPath("unknown")).toBeNull();
    });
  });

  describe("config().shouldMerge()", () => {
    it("merges opencode config", () => {
      expect(opencodeToolConfig.config().shouldMerge("opencode")).toBe(true);
    });

    it("merges mcp config (transformed into opencode.json)", () => {
      expect(opencodeToolConfig.config().shouldMerge("mcp")).toBe(true);
    });
  });

  describe("config().transformContent()", () => {
    it("is defined on the OpenCode config handler", () => {
      expect(opencodeToolConfig.config().transformContent).toBeDefined();
    });

    const transform =
      opencodeToolConfig.config().transformContent ??
      (() => {
        throw new Error("transformContent not defined");
      });

    it("transforms mcpServers to OpenCode mcp format with env", () => {
      const input = JSON.stringify({
        mcpServers: {
          "my-server": {
            command: "npx",
            args: ["-y", "@some/mcp-server"],
            env: { API_KEY: "secret" },
          },
        },
      });
      expect(JSON.parse(transform("mcp", input))).toEqual({
        mcp: {
          "my-server": {
            type: "local",
            command: ["npx", "-y", "@some/mcp-server"],
            enabled: true,
            environment: { API_KEY: "secret" },
          },
        },
      });
    });

    it("omits environment when env field is absent", () => {
      const input = JSON.stringify({
        mcpServers: { server: { command: "node", args: ["server.js"] } },
      });
      expect(JSON.parse(transform("mcp", input)).mcp.server).not.toHaveProperty("environment");
    });

    it("omits environment when env is explicitly empty", () => {
      const input = JSON.stringify({
        mcpServers: { server: { command: "node", env: {} } },
      });
      expect(JSON.parse(transform("mcp", input)).mcp.server).not.toHaveProperty("environment");
    });

    it("produces empty mcp object when mcpServers is empty", () => {
      const input = JSON.stringify({ mcpServers: {} });
      expect(JSON.parse(transform("mcp", input))).toEqual({ mcp: {} });
    });

    it("throws with context on malformed JSON", () => {
      expect(() => transform("mcp", "not-json")).toThrow("Cannot parse MCP config:");
    });

    it("throws when root is not an object (array)", () => {
      expect(() => transform("mcp", "[]")).toThrow("MCP config must be a JSON object");
    });

    it("transforms url-based server to remote format", () => {
      const input = JSON.stringify({
        mcpServers: { figma: { url: "https://mcp.figma.com/mcp", type: "http" } },
      });
      expect(JSON.parse(transform("mcp", input))).toEqual({
        mcp: { figma: { type: "remote", url: "https://mcp.figma.com/mcp", enabled: true } },
      });
    });

    it("handles mixed local and remote servers in the same config", () => {
      const input = JSON.stringify({
        mcpServers: {
          local: { command: "npx", args: ["-y", "pkg"] },
          remote: { url: "https://example.com/mcp" },
        },
      });
      const result = JSON.parse(transform("mcp", input));
      expect(result.mcp.local.type).toBe("local");
      expect(result.mcp.remote.type).toBe("remote");
    });

    it("throws when a server has neither command nor url", () => {
      const input = JSON.stringify({ mcpServers: { bad: { token: "abc" } } });
      expect(() => transform("mcp", input)).toThrow(
        'MCP server "bad" must have either a "command" or "url" field'
      );
    });

    it("returns non-mcp content unchanged", () => {
      const content = '{"instructions":[".opencode/rules/**/*.md"]}';
      expect(transform("opencode", content)).toBe(content);
    });
  });

  describe("memoryBank().outputPath()", () => {
    it("returns AGENTS.md for agentsMd template", () => {
      expect(opencodeToolConfig.memoryBank().outputPath("agentsMd")).toBe("AGENTS.md");
    });

    it("returns null for unknown template names", () => {
      expect(opencodeToolConfig.memoryBank().outputPath("unknown")).toBeNull();
    });
  });

  describe("memoryBank().rewriteContent()", () => {
    it("applies content rewriting to memory bank content", () => {
      const result = opencodeToolConfig
        .memoryBank()
        .rewriteContent("@{{TOOLS}}/agents/", "aidd_docs");
      expect(result).toBe("@.opencode/agents/");
    });
  });

  describe("detectUserFileSectionKey()", () => {
    it("detects agents section", () => {
      const key = opencodeToolConfig.detectUserFileSectionKey(".opencode/agents/alexia.md");
      expect(key).toEqual({ section: "agents", key: "alexia.md" });
    });

    it("detects commands section", () => {
      const key = opencodeToolConfig.detectUserFileSectionKey(
        ".opencode/commands/04_code/implement.md"
      );
      expect(key).toEqual({ section: "commands", key: "04_code/implement.md" });
    });

    it("detects rules section", () => {
      const key = opencodeToolConfig.detectUserFileSectionKey(
        ".opencode/rules/01-standards/naming.md"
      );
      expect(key).toEqual({ section: "rules", key: "01-standards/naming.md" });
    });

    it("detects skills section", () => {
      const key = opencodeToolConfig.detectUserFileSectionKey(".opencode/skills/my-skill/SKILL.md");
      expect(key).toEqual({ section: "skills", key: "my-skill/SKILL.md" });
    });

    it("returns null for unrecognised paths", () => {
      expect(opencodeToolConfig.detectUserFileSectionKey("opencode.json")).toBeNull();
      expect(opencodeToolConfig.detectUserFileSectionKey("AGENTS.md")).toBeNull();
    });
  });
});
