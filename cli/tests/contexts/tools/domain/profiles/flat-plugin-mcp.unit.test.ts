import { describe, expect, it } from "vitest";
import { McpSection } from "../../../../../src/contexts/tools/domain/sections/mcp-section.js";
import { registeredAiConfig, registeredAiProfile } from "../../testing/catalog-of.js";
import { aProfile, flatPlugins } from "../../testing/profiles.js";

describe("AiToolProfile.flatPluginMcp()", () => {
  it("answers the MCP capability of a flat tool merging framework-prime", () => {
    expect(registeredAiProfile("opencode").flatPluginMcp()).toBe(
      registeredAiConfig("opencode").section("mcp")
    );
    expect(registeredAiProfile("kilo").flatPluginMcp()).toBe(
      registeredAiConfig("kilo").section("mcp")
    );
  });

  it("answers null for a native tool merging framework-prime", () => {
    expect(registeredAiProfile("copilot").flatPluginMcp()).toBeNull();
  });

  it("answers null for a tool whose MCP does not merge framework-prime", () => {
    expect(registeredAiProfile("claude").flatPluginMcp()).toBeNull();
  });

  it("answers null for a flat tool whose MCP is the user's to merge", () => {
    const profile = aProfile("opencode")
      .withPlugins(flatPlugins("accepts"))
      .withMcp(
        new McpSection({ outputPath: "mcp.json", format: "json", mergeStrategy: "user-prime" })
      )
      .build();

    expect(profile.flatPluginMcp()).toBeNull();
  });
});
