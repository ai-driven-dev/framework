import { describe, expect, it } from "vitest";
import { resolveMcpOutputPath } from "../../../../src/contexts/tools/application/resolve-mcp-output-path.js";
import { McpCapability } from "../../../../src/contexts/tools/domain/capabilities/mcp-capability.js";
import { kilo } from "../../../../src/contexts/tools/domain/profiles/kilo/profile.js";
import { opencode } from "../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import { KiloDualConfigError, OpencodeDualConfigError } from "../../../../src/kernel/errors.js";
import { InMemoryFileAdapter } from "../../../helpers/ports/index.js";

const ROOT = "/project";
const withFiles = (...relPaths: string[]) =>
  new InMemoryFileAdapter(Object.fromEntries(relPaths.map((path) => [`${ROOT}/${path}`, "{}"])));

describe("the file a tool's MCP config goes in", () => {
  it("is the fixed output path for a tool declaring no candidates, reading nothing", async () => {
    const fixed = new McpCapability({ outputPath: ".mcp.json", format: "json" });

    expect(await resolveMcpOutputPath(withFiles(".mcp.jsonc"), fixed, ROOT)).toBe(".mcp.json");
  });

  describe("opencode", () => {
    const resolve = (...files: string[]) =>
      resolveMcpOutputPath(withFiles(...files), opencode.section("mcp"), ROOT);

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
      resolveMcpOutputPath(withFiles(...files), kilo.section("mcp"), ROOT);

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
