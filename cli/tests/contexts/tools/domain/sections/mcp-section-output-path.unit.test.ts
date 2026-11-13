import { describe, expect, it } from "vitest";
import { kilo } from "../../../../../src/contexts/tools/domain/profiles/kilo/profile.js";
import { opencode } from "../../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import { McpConfigPart } from "../../../../../src/contexts/tools/domain/sections/mcp-section.js";
import {
  KiloDualConfigError,
  OpencodeDualConfigError,
} from "../../../../../src/shared/domain/errors.js";
import { DeterministicHasher } from "../../../../helpers/ports/deterministic-hasher.js";

const withFiles =
  (...relPaths: string[]) =>
  async (relativePath: string) =>
    relPaths.includes(relativePath);

describe("the file a tool's MCP config goes in", () => {
  it("is the fixed output path for a tool declaring no candidates, reading nothing", async () => {
    const fixed = new McpConfigPart({ outputPath: ".mcp.json", format: "json" });

    expect(await fixed.resolveOutputPath(withFiles(".mcp.jsonc"))).toBe(".mcp.json");
  });

  describe("opencode", () => {
    const resolve = (...files: string[]) =>
      opencode.section("mcp").config?.resolveOutputPath(withFiles(...files));

    it("falls back to opencode.json when neither config file exists", async () => {
      expect(await resolve()).toBe("opencode.json");
    });

    it("reuses opencode.json when only it exists", async () => {
      expect(await resolve("opencode.json")).toBe("opencode.json");
    });

    it("reuses opencode.jsonc when only it exists", async () => {
      expect(await resolve("opencode.jsonc")).toBe("opencode.jsonc");
    });

    it("refuses when both opencode.json and opencode.jsonc exist", async () => {
      await expect(resolve("opencode.json", "opencode.jsonc")).rejects.toThrow(
        OpencodeDualConfigError
      );
    });
  });

  describe("kilo", () => {
    const resolve = (...files: string[]) =>
      kilo.section("mcp").config?.resolveOutputPath(withFiles(...files));

    it("falls back to project-local JSONC when no config exists", async () => {
      expect(await resolve()).toBe(".kilo/kilo.jsonc");
    });

    it("reuses an existing project-local config", async () => {
      expect(await resolve(".kilo/kilo.json")).toBe(".kilo/kilo.json");
    });

    it("reuses an existing root-level config", async () => {
      expect(await resolve("kilo.jsonc")).toBe("kilo.jsonc");
    });

    it("prefers the project-local config over a root-level one", async () => {
      expect(await resolve("kilo.json", ".kilo/kilo.jsonc")).toBe(".kilo/kilo.jsonc");
    });

    it("refuses when both files of the answering tier exist", async () => {
      await expect(resolve("kilo.json", "kilo.jsonc")).rejects.toThrow(KiloDualConfigError);
      await expect(resolve(".kilo/kilo.json", ".kilo/kilo.jsonc")).rejects.toThrow(
        KiloDualConfigError
      );
    });
  });
});

function opencodeMcp(): McpConfigPart {
  const config = opencode.section("mcp").config;
  if (config === undefined) throw new Error("opencode declares no mcp config");
  return config;
}

describe("the opencode file an McpConfigPart merges into", () => {
  const hasher = new DeterministicHasher();
  const incoming = JSON.stringify({ mcp: { added: { type: "remote", url: "https://a" } } });

  it("contributes a plugin's servers and hands back what to remove them by", () => {
    const merged = opencodeMcp().mergePluginServers(null, incoming, new Map(), hasher);

    expect([...merged.contributedEntries.keys()]).toStrictEqual(["added"]);
    const removed = opencodeMcp().removePluginServers(
      merged.mergedContent,
      merged.contributedEntries
    );
    expect(JSON.parse(removed)).toStrictEqual({ mcp: {} });
  });

  it("keeps a person's own keys beside the framework's config", () => {
    const config = opencodeMcp().frameworkConfigOver('{"theme":"base"}', '{"mine":1}', {});

    expect(JSON.parse(config)).toStrictEqual({ theme: "base", mine: 1 });
  });
});
