import { describe, expect, it } from "vitest";
import { McpCapability } from "../../../../../src/contexts/tools/domain/capabilities/mcp-capability.js";
import { kilo } from "../../../../../src/contexts/tools/domain/profiles/kilo/profile.js";
import { opencode } from "../../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import { KiloDualConfigError, OpencodeDualConfigError } from "../../../../../src/kernel/errors.js";

describe("the config files a tool's MCP output may live in", () => {
  it("declares none for a tool whose output path is fixed", () => {
    const fixed = new McpCapability({ outputPath: ".mcp.json", format: "json" });

    expect(fixed.outputPathCandidates()).toBeNull();
  });

  it("lists opencode's two root files as one tier, falling back to the JSON one", () => {
    const candidates = opencode.capabilities.mcp?.outputPathCandidates();

    expect(candidates?.tiers).toStrictEqual([["opencode.json", "opencode.jsonc"]]);
    expect(candidates?.fallback).toBe("opencode.json");
    expect(() => candidates?.conflict()).toThrow(OpencodeDualConfigError);
  });

  it("lists kilo's project tier before its legacy root tier, falling back to project JSONC", () => {
    const candidates = kilo.capabilities.mcp?.outputPathCandidates();

    expect(candidates?.tiers).toStrictEqual([
      [".kilo/kilo.json", ".kilo/kilo.jsonc"],
      ["kilo.json", "kilo.jsonc"],
    ]);
    expect(candidates?.fallback).toBe(".kilo/kilo.jsonc");
    expect(() => candidates?.conflict()).toThrow(KiloDualConfigError);
  });
});
