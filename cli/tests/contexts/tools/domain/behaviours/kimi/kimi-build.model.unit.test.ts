import { describe, expect, it } from "vitest";
import { kimi } from "../../../../../../src/composition/tool-profiles/kimi.js";
import { present } from "../../../../../shared/testing/present.builder.js";

describe("building Kimi's flat contract", () => {
  it("ships no hooks, and says Kimi reads them from the user config or a local plugin, never a project", () => {
    const { hooks } = present(kimi.buildContracts.flat)().artifacts;

    expect(hooks).toEqual({
      supported: false,
      reason: expect.stringContaining("local plugin"),
    });
  });
});

const PRESENCE = {
  hasAgents: true,
  agentsList: ["reviewer.md"],
  skillsList: ["commit"],
  hasHooksJson: true,
  hasMcpJson: true,
  mcpServers: {
    docs: { url: "https://example.com/mcp" },
    local: { command: "$" + "{CLAUDE_PLUGIN_ROOT}/bin/serve.js", args: ["--stdio"] },
  },
};

describe("building Kimi's plugin contract", () => {
  const contract = () => present(kimi.buildContracts.marketplace)();
  const synthesize = () => present(contract().synthesizeManifest ?? undefined);

  it("writes the manifest where Kimi reads it, with the source identity and no repository", () => {
    expect(contract().manifestFileRelative).toBe(".kimi-plugin/plugin.json");
    expect(
      synthesize()(
        { name: "aidd-test", version: "1.2.3", description: "d", repository: "https://x" },
        PRESENCE
      )
    ).toMatchObject({ name: "aidd-test", version: "1.2.3", description: "d" });
    expect(
      synthesize()({ name: "aidd-test", repository: "https://x" }, PRESENCE)
    ).not.toHaveProperty("repository");
  });

  it("names the skills folder with a ./ path, leaves agents to Kimi's discovery and carries the servers inline", () => {
    const manifest = synthesize()({ name: "aidd-test" }, PRESENCE);

    expect(manifest.skills).toBe("./skills/");
    expect(manifest).not.toHaveProperty("agents");
    expect(manifest).not.toHaveProperty("hooks");
    expect(manifest.mcpServers).toEqual({
      docs: { url: "https://example.com/mcp" },
      local: { command: "./bin/serve.js", args: ["--stdio"] },
    });
  });

  it("names no skills and no servers for a plugin holding none", () => {
    const manifest = synthesize()(
      { name: "aidd-test" },
      { ...PRESENCE, skillsList: [], hasMcpJson: false, mcpServers: {} }
    );

    expect(manifest).toEqual({ name: "aidd-test" });
  });

  it("ships no hooks, with the same reason as the flat contract", () => {
    expect(contract().artifacts.hooks).toEqual(present(kimi.buildContracts.flat)().artifacts.hooks);
  });
});
