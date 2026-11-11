import { describe, expect, it } from "vitest";
import { opencode } from "../../../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import { FileHash } from "../../../../../../src/kernel/file.js";
import type { FileReader } from "../../../../../../src/kernel/ports/file-reader.js";

function _makeFs(existingPaths: string[]): FileReader {
  return {
    fileExists: async (path: string) => existingPaths.some((p) => path.endsWith(p)),
    isExecutable: async () => false,
    realpath: async (path: string) => path,
    readFile: async () => "",
    readFileHash: async () => new FileHash("00000000000000000000000000000000"),
    listDirectory: async () => [],
    listFilesRecursive: async () => [],
  };
}

describe("opencode mcp", () => {
  describe("capabilities.mcp", () => {
    it("maps both opencode and mcp config names to opencode.json", () => {
      expect(opencode.section("mcp").outputPath()).toBe("opencode.json");
      expect(opencode.section("mcp").consumes("opencode")).toBe(true);
      expect(opencode.section("mcp").consumes("mcp")).toBe(true);
    });

    it("does not consume unknown config names", () => {
      expect(opencode.section("mcp").consumes("unknown")).toBe(false);
    });

    it("uses framework-prime merge strategy", () => {
      expect(opencode.section("mcp").mergeStrategy()).toBe("framework-prime");
    });

    it("writes its config as JSON", () => {
      expect(opencode.section("mcp").format()).toBe("json");
    });
  });

  describe("capabilities.mcp.transform() (MCP transform)", () => {
    it("rewrites the servers the OpenCode mcp capability is given", () => {
      const input = JSON.stringify({ mcpServers: { a: { command: "node" } } });
      expect(opencode.section("mcp").transformContent(input)).not.toBe(input);
    });

    const transform = (configName: string, content: string): string => {
      if (configName !== "mcp") return content;
      return opencode.section("mcp").transformContent(content);
    };

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

    it("sets enabled: false on local server with disabled: true", () => {
      const input = JSON.stringify({
        mcpServers: { "my-server": { command: "node", args: ["server.js"], disabled: true } },
      });
      expect(JSON.parse(transform("mcp", input)).mcp["my-server"].enabled).toBe(false);
    });

    it("sets enabled: false on remote server with disabled: true", () => {
      const input = JSON.stringify({
        mcpServers: { figma: { url: "https://mcp.figma.com/mcp", disabled: true } },
      });
      expect(JSON.parse(transform("mcp", input)).mcp.figma.enabled).toBe(false);
    });

    it("preserves mixed enabled/disabled servers correctly", () => {
      const input = JSON.stringify({
        mcpServers: {
          enabled: { command: "node", args: ["on.js"] },
          disabled: { command: "node", args: ["off.js"], disabled: true },
        },
      });
      const result = JSON.parse(transform("mcp", input));
      expect(result.mcp.enabled.enabled).toBe(true);
      expect(result.mcp.disabled.enabled).toBe(false);
    });

    it("sets enabled: true when disabled is explicitly false", () => {
      const input = JSON.stringify({
        mcpServers: { "my-server": { command: "node", disabled: false } },
      });
      expect(JSON.parse(transform("mcp", input)).mcp["my-server"].enabled).toBe(true);
    });
  });
});
