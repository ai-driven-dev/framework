import { describe, expect, it } from "vitest";
import { McpConfigPart } from "../../../../../src/contexts/tools/domain/sections/mcp-section.js";
import { registeredAiConfig, registeredAiProfile, TOOL } from "../../testing/catalog-of.js";
import { flatPlugins } from "../../testing/plugin-mode.js";
import { aProfile } from "../../testing/profiles.js";

describe("AiToolProfile.flatPluginMcp()", () => {
  it("answers the MCP capability of a flat tool merging framework-prime", () => {
    expect(registeredAiProfile(TOOL.opencode).flatPluginMcp()).toBe(
      registeredAiConfig(TOOL.opencode).section("mcp")?.config
    );
    expect(registeredAiProfile(TOOL.kilo).flatPluginMcp()).toBe(
      registeredAiConfig(TOOL.kilo).section("mcp")?.config
    );
  });

  it("answers null for a native tool merging framework-prime", () => {
    expect(registeredAiProfile(TOOL.copilot).flatPluginMcp()).toBeNull();
  });

  it("answers null for a tool whose MCP does not merge framework-prime", () => {
    expect(registeredAiProfile(TOOL.claude).flatPluginMcp()).toBeNull();
  });

  it("answers null for a flat tool whose MCP is the user's to merge", () => {
    const profile = aProfile(TOOL.opencode)
      .withPlugins(flatPlugins("accepts"))
      .withMcp({
        config: new McpConfigPart({
          outputPath: "mcp.json",
          format: "json",
          mergeStrategy: "user-prime",
        }),
      })
      .build();

    expect(profile.flatPluginMcp()).toBeNull();
  });
});
