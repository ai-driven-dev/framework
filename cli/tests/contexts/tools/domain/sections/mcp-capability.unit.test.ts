import { describe, expect, it } from "vitest";
import { McpCapability } from "../../../../../src/contexts/tools/domain/sections/mcp-capability.js";

const sampleMcpJson = JSON.stringify({
  mcpServers: {
    "my-server": { command: "npx", args: ["my-package"] },
  },
});

const existingJson = JSON.stringify({
  mcpServers: {
    "existing-server": { command: "npx", args: ["existing"] },
  },
});

describe("McpCapability", () => {
  describe("outputPath / accepts", () => {
    it("accepts the exact output path", () => {
      const cap = new McpCapability({ outputPath: ".claude/mcp.json", format: "json" });
      expect(cap.accepts(".claude/mcp.json")).toBe(true);
    });

    it("rejects paths that do not match exactly", () => {
      const cap = new McpCapability({ outputPath: ".claude/mcp.json", format: "json" });
      expect(cap.accepts(".claude/other.json")).toBe(false);
    });
  });

  describe("transform", () => {
    it("returns JSON as-is when format is json", () => {
      const cap = new McpCapability({ outputPath: ".claude/mcp.json", format: "json" });
      expect(cap.transform(sampleMcpJson)).toBe(sampleMcpJson);
    });

    it("converts JSON to TOML when format is toml", () => {
      const cap = new McpCapability({ outputPath: "config.toml", format: "toml" });
      const result = cap.transform(sampleMcpJson);
      expect(result).toContain("my-server");
      expect(result).not.toContain('"mcpServers"');
    });
  });

  describe("merge", () => {
    it("uses injected mergeFn when provided", () => {
      const mergeFn = (_existing: string, incoming: string) => incoming;
      const cap = new McpCapability({ outputPath: ".mcp.json", format: "json", mergeFn });
      expect(cap.merge(existingJson, sampleMcpJson)).toBe(sampleMcpJson);
    });

    it("returns incoming when mergeStrategy is none", () => {
      const cap = new McpCapability({
        outputPath: ".mcp.json",
        format: "json",
        mergeStrategy: "none",
      });
      expect(cap.merge(existingJson, sampleMcpJson)).toBe(sampleMcpJson);
    });

    it("user-prime: existing keys win over incoming keys", () => {
      const existing = JSON.stringify({ key: "existing-value", shared: "keep-me" });
      const incoming = JSON.stringify({ key: "new-value", extra: "added" });
      const cap = new McpCapability({
        outputPath: ".mcp.json",
        format: "json",
        mergeStrategy: "user-prime",
      });
      const result = JSON.parse(cap.merge(existing, incoming)) as Record<string, unknown>;
      expect(result.key).toBe("existing-value");
      expect(result.extra).toBe("added");
      expect(result.shared).toBe("keep-me");
    });
  });

  describe("equals", () => {
    it("returns true for identical params", () => {
      const a = new McpCapability({ outputPath: ".mcp.json", format: "json" });
      const b = new McpCapability({ outputPath: ".mcp.json", format: "json" });
      expect(a.equals(b)).toBe(true);
    });

    it("returns false when outputPath differs", () => {
      const a = new McpCapability({ outputPath: ".mcp.json", format: "json" });
      const b = new McpCapability({ outputPath: "config.toml", format: "json" });
      expect(a.equals(b)).toBe(false);
    });

    it("returns false when format differs", () => {
      const a = new McpCapability({ outputPath: "config.toml", format: "json" });
      const b = new McpCapability({ outputPath: "config.toml", format: "toml" });
      expect(a.equals(b)).toBe(false);
    });
  });
});

describe("McpCapability declarations", () => {
  it("consumes nothing unless told otherwise", () => {
    expect(new McpCapability({ outputPath: ".mcp.json", format: "json" }).consumes("mcp")).toBe(
      false
    );
    expect(
      new McpCapability({ outputPath: ".mcp.json", format: "json", consumes: ["mcp"] }).consumes(
        "mcp"
      )
    ).toBe(true);
  });

  it("is not equal to a capability that differs in mergeStrategy alone", () => {
    const base = { outputPath: ".mcp.json", format: "json" as const };
    const cap = new McpCapability({ ...base, mergeStrategy: "user-prime" });

    expect(cap.equals(new McpCapability({ ...base, mergeStrategy: "user-prime" }))).toBe(true);
    expect(cap.equals(new McpCapability({ ...base, mergeStrategy: "none" }))).toBe(false);
  });
});

describe("McpCapability isFrameworkPrimeJson", () => {
  const json = { outputPath: "opencode.json", format: "json" as const };
  const prime = { ...json, mergeStrategy: "framework-prime" as const };

  it("names the one JSON file whose framework half is written over the person's", () => {
    const cap = new McpCapability(prime);
    expect(cap.isFrameworkPrimeJson("opencode.json")).toBe(true);
    expect(cap.isFrameworkPrimeJson("other.json")).toBe(false);
  });

  it("refuses a file merged the other way", () => {
    expect(
      new McpCapability({ ...json, mergeStrategy: "user-prime" }).isFrameworkPrimeJson(
        "opencode.json"
      )
    ).toBe(false);
  });

  it("refuses a file that is not JSON", () => {
    expect(
      new McpCapability({ ...prime, format: "toml" }).isFrameworkPrimeJson("opencode.json")
    ).toBe(false);
  });
});

function transformFor(platform: string): ((content: string) => string) | undefined {
  return new McpCapability({ outputPath: ".mcp.json", format: "json" }).launchTransformFor(
    platform
  );
}

function makeConfig(servers: Record<string, object>): string {
  return JSON.stringify({ mcpServers: servers }, null, 2);
}

describe("transformFor()", () => {
  it("returns undefined for linux", () => {
    expect(transformFor("linux")).toBeUndefined();
  });

  it("returns undefined for darwin", () => {
    expect(transformFor("darwin")).toBeUndefined();
  });

  it("returns a transform for win32", () => {
    expect(transformFor("win32")).toBeDefined();
  });

  describe("win32 transform", () => {
    // biome-ignore lint/style/noNonNullAssertion: win32 is asserted defined in the test above
    const transform = transformFor("win32")!;

    it("transforms npx without existing args", () => {
      const result = JSON.parse(transform(makeConfig({ server: { command: "npx", args: [] } })));
      expect(result.mcpServers.server.command).toBe("cmd");
      expect(result.mcpServers.server.args).toEqual(["/c", "npx"]);
    });

    it("transforms npx with existing args", () => {
      const result = JSON.parse(
        transform(makeConfig({ server: { command: "npx", args: ["-y", "some-pkg"] } }))
      );
      expect(result.mcpServers.server.command).toBe("cmd");
      expect(result.mcpServers.server.args).toEqual(["/c", "npx", "-y", "some-pkg"]);
    });

    it("transforms uvx command", () => {
      const result = JSON.parse(transform(makeConfig({ server: { command: "uvx" } })));
      expect(result.mcpServers.server.command).toBe("uvx.exe");
    });

    it("transforms uv command", () => {
      const result = JSON.parse(
        transform(makeConfig({ server: { command: "uv", args: ["run", "mcp"] } }))
      );
      expect(result.mcpServers.server.command).toBe("uv.exe");
      expect(result.mcpServers.server.args).toEqual(["run", "mcp"]);
    });

    it("leaves node command unchanged", () => {
      const result = JSON.parse(
        transform(makeConfig({ server: { command: "node", args: ["server.js"] } }))
      );
      expect(result.mcpServers.server.command).toBe("node");
    });

    it("leaves docker command unchanged", () => {
      const result = JSON.parse(
        transform(makeConfig({ server: { command: "docker", args: ["run", "img"] } }))
      );
      expect(result.mcpServers.server.command).toBe("docker");
    });

    it("leaves http server entries unchanged", () => {
      const result = JSON.parse(
        transform(makeConfig({ server: { url: "http://localhost:3000" } }))
      );
      expect(result.mcpServers.server).toEqual({ url: "http://localhost:3000" });
    });

    it("handles empty mcpServers", () => {
      const result = JSON.parse(transform(JSON.stringify({ mcpServers: {} })));
      expect(result.mcpServers).toEqual({});
    });

    it("throws on invalid JSON", () => {
      expect(() => transform("not-json")).toThrow();
    });
  });
});

describe("the win32 transform on a config without servers", () => {
  it("re-serializes the document untouched", () => {
    const transform = transformFor("win32");
    if (transform === undefined) throw new Error("win32 declares a transform");

    expect(transform('{"other":{"command":"npx"}}')).toBe(
      JSON.stringify({ other: { command: "npx" } }, null, 2)
    );
  });
});
