import { describe, expect, it } from "vitest";
import { CONFIG_MCP } from "../../../../../../src/contexts/tools/domain/capabilities/config-refs.js";
import { copilot } from "../../../../../../src/contexts/tools/domain/profiles/copilot/profile.js";
import { nativeActivationOf } from "../../../../../../src/contexts/tools/domain/registry.js";

describe("copilot declarations the rest of the CLI reads", () => {
  it("probes a plugin manifest in the three places Copilot reads one, in its order", () => {
    expect(copilot.distributionProbes?.manifest).toStrictEqual([
      ".plugin/plugin.json",
      ".github/plugin/plugin.json",
      "plugin.json",
    ]);
  });

  it("writes agents as markdown", () => {
    expect(copilot.capabilities.agents.params.format).toBe("markdown");
  });

  it("writes its MCP servers as JSON under `servers`", () => {
    expect(copilot.capabilities.mcp.params).toMatchObject({
      format: "json",
      entrySection: "servers",
    });
    expect(copilot.capabilities.mcp.consumes).toStrictEqual([CONFIG_MCP]);
  });

  it("translates plugins for its own marketplace", () => {
    expect(copilot.capabilities.plugins.translationMode).toBe("marketplace");
  });

  it("drives its own CLI with the verbs it answers to", () => {
    expect(nativeActivationOf("copilot")).toMatchObject({
      binary: "copilot",
      upgradeVerb: "update",
      updateVerb: "update",
      enableVerb: "install",
      disableVerb: "uninstall",
      sourceCheckVerb: "update",
      forceRemoveArgs: ["--force"],
    });
  });
});
