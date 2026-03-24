import { describe, expect, it } from "vitest";
import { ConfigConflictError } from "../../../src/domain/errors.js";
import type { FileSystem } from "../../../src/domain/ports/file-system.js";
import { opencodeToolConfig } from "../../../src/domain/tools/opencode.js";

function makeFs(existingPaths: string[]): FileSystem {
  return {
    fileExists: async (path: string) => existingPaths.some((p) => path.endsWith(p)),
  } as unknown as FileSystem;
}

describe("opencodeToolConfig", () => {
  describe("rewriteContent()", () => {
    it("installed content uses the .opencode/ tool directory path", () => {
      const result = opencodeToolConfig.rewriteContent("{{TOOLS}}/agents/", "aidd_docs");
      expect(result).toBe(".opencode/agents/");
    });

    it("installed content uses the configured docs directory path", () => {
      const result = opencodeToolConfig.rewriteContent("{{DOCS}}/memory/", "aidd_docs");
      expect(result).toBe("aidd_docs/memory/");
    });

    it("include references in installed content point to the tool directory", () => {
      const result = opencodeToolConfig.rewriteContent("@{{TOOLS}}/agents/alexia.md", "aidd_docs");
      expect(result).toBe("@.opencode/agents/alexia.md");
    });

    it("include references in installed content point to the docs directory", () => {
      const result = opencodeToolConfig.rewriteContent("@{{DOCS}}/memory/project.md", "aidd_docs");
      expect(result).toBe("@aidd_docs/memory/project.md");
    });

    it("command cross-references in installed content use the AIDD-namespaced path", () => {
      const result = opencodeToolConfig.rewriteContent(
        "@{{TOOLS}}/commands/04_code/assert.md",
        "aidd_docs"
      );
      expect(result).toBe("@.opencode/commands/aidd/04/assert.md");
    });
  });

  describe("reverseRewriteContent()", () => {
    it("tool include paths are restored to canonical placeholders when syncing back", () => {
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
    it("adds mode subagent to OpenCode agent frontmatter", () => {
      const fm = { name: "alexia", description: "Act like the user" };
      const result = opencodeToolConfig.agents().convertFrontmatter(fm);
      expect(result).toEqual({ description: "Act like the user", mode: "subagent" });
    });

    it("does not carry OpenCode specific fields back to canonical format", () => {
      // claude → opencode drops name (filename is the name in OpenCode), adds mode: subagent.
      // opencode → claude reverse strips mode and cannot recover name from frontmatter alone.
      const claudeFm = { name: "alexia", description: "Act like the user" };
      const opencodeFm = opencodeToolConfig.agents().convertFrontmatter(claudeFm);
      const canonical = opencodeToolConfig.agents().reverseConvertFrontmatter(opencodeFm);
      expect(canonical).not.toHaveProperty("name");
      expect(canonical).not.toHaveProperty("mode");
      expect(canonical).toEqual({ description: "Act like the user" });
    });
  });

  describe("commands output path", () => {
    it("builds AIDD-namespaced path under .opencode/commands/aidd/<phase>/", () => {
      const path = opencodeToolConfig.commands().buildFilePath("04_code/implement.md");
      expect(path).toBe(".opencode/commands/aidd/04/implement.md");
    });

    it("falls back to aidd/<baseName> for top-level files without a phase directory", () => {
      const path = opencodeToolConfig.commands().buildFilePath("implement.md");
      expect(path).toBe(".opencode/commands/aidd/implement.md");
    });
  });

  describe("commands().convertFrontmatter()", () => {
    it("emits name prefixed with aidd:<phase>: and description", () => {
      const fm = { name: "implement", description: "Implement a plan", model: "gpt-4o" };
      const result = opencodeToolConfig.commands().convertFrontmatter(fm, "04_code/implement.md");
      expect(result).toEqual({ name: "aidd:04:implement", description: "Implement a plan" });
    });

    it("emits bare name when relativeFileName has no leading-digit phase", () => {
      const fm = { name: "implement", description: "Implement a plan" };
      const result = opencodeToolConfig.commands().convertFrontmatter(fm, "implement.md");
      expect(result).toEqual({ name: "implement", description: "Implement a plan" });
    });
  });

  describe("commands().reverseConvertFrontmatter()", () => {
    it("strips aidd:<phase>: prefix from name", () => {
      const fm = { name: "aidd:04:implement", description: "Implement a plan" };
      const result = opencodeToolConfig.commands().reverseConvertFrontmatter(fm);
      expect(result).toEqual({ name: "implement", description: "Implement a plan" });
    });

    it("preserves name unchanged when prefix is absent", () => {
      const fm = { name: "implement", description: "Implement a plan" };
      const result = opencodeToolConfig.commands().reverseConvertFrontmatter(fm);
      expect(result).toEqual({ name: "implement", description: "Implement a plan" });
    });
  });

  describe("rules().buildFilePath()", () => {
    it("builds path under .opencode/rules/", () => {
      const path = opencodeToolConfig.rules().buildFilePath("01-standards/naming.md");
      expect(path).toBe(".opencode/rules/01-standards/naming.md");
    });
  });

  describe("rules().convertFrontmatter()", () => {
    it("returns empty frontmatter regardless of input (paths, always-apply)", () => {
      const result = opencodeToolConfig.rules().convertFrontmatter({ paths: ["src/**/*.ts"] });
      expect(result).toEqual({});
    });

    it("returns empty frontmatter for always-apply rules", () => {
      const result = opencodeToolConfig.rules().convertFrontmatter({ description: "always" });
      expect(result).toEqual({});
    });

    it("keeps description when alwaysApply is false and no paths are specified", () => {
      const result = opencodeToolConfig.rules().convertFrontmatter({
        description: "Apply when editing command files.",
        alwaysApply: false,
      });
      expect(result).toEqual({ description: "Apply when editing command files." });
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

  describe("config().resolveOutputPath()", () => {
    const PROJECT_ROOT = "/project";
    const configHandler = opencodeToolConfig.config();

    async function resolve(configName: string, fs: FileSystem): Promise<string | null> {
      if (!configHandler.resolveOutputPath) throw new Error("resolveOutputPath not defined");
      return configHandler.resolveOutputPath(configName, PROJECT_ROOT, fs);
    }

    it("returns opencode.json when neither config file exists", async () => {
      expect(await resolve("opencode", makeFs([]))).toBe("opencode.json");
    });

    it("returns opencode.json when only opencode.json exists", async () => {
      expect(await resolve("opencode", makeFs(["opencode.json"]))).toBe("opencode.json");
    });

    it("returns opencode.jsonc when only opencode.jsonc exists", async () => {
      expect(await resolve("opencode", makeFs(["opencode.jsonc"]))).toBe("opencode.jsonc");
    });

    it("throws ConfigConflictError when both opencode.json and opencode.jsonc exist", async () => {
      await expect(
        resolve("opencode", makeFs(["opencode.json", "opencode.jsonc"]))
      ).rejects.toThrow(ConfigConflictError);
    });

    it("returns null for a config name that is not handled", async () => {
      expect(await resolve("unknown", makeFs([]))).toBeNull();
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

    it("detects commands section and strips aidd/ prefix", () => {
      const key = opencodeToolConfig.detectUserFileSectionKey(
        ".opencode/commands/aidd/04/implement.md"
      );
      expect(key).toEqual({ section: "commands", key: "04/implement.md" });
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
