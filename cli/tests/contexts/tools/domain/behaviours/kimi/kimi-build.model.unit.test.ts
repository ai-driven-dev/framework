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
  hooks: {
    SessionStart: [
      {
        hooks: [
          { type: "command", command: "node $" + "{CLAUDE_PLUGIN_ROOT}/hooks/memory.cjs load" },
          {
            type: "command",
            command: "node $" + "{CLAUDE_PLUGIN_ROOT}/hooks/slow.cjs",
            timeout: 20,
          },
        ],
      },
    ],
    UserPromptSubmit: [
      {
        matcher: "",
        hooks: [{ type: "command", command: "node $" + "{CLAUDE_PLUGIN_ROOT}/hooks/ask.cjs" }],
      },
    ],
    PreToolUse: [
      {
        matcher: "Write",
        hooks: [{ type: "command", command: "node $" + "{CLAUDE_PLUGIN_ROOT}/hooks/lock.cjs" }],
      },
    ],
  },
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
    expect(manifest.mcpServers).toEqual({
      docs: { url: "https://example.com/mcp" },
      local: { command: "./bin/serve.js", args: ["--stdio"] },
    });
  });

  it("names no skills and no servers for a plugin holding none", () => {
    const manifest = synthesize()(
      { name: "aidd-test" },
      { ...PRESENCE, skillsList: [], hasMcpJson: false, mcpServers: {}, hooks: {} }
    );

    expect(manifest).toEqual({ name: "aidd-test" });
  });

  it("lists the hooks of the events Kimi fires inline, from the plugin root, with the four fields it takes", () => {
    expect(synthesize()({ name: "aidd-test" }, PRESENCE).hooks).toEqual([
      { event: "SessionStart", command: "node ./hooks/memory.cjs load" },
      { event: "SessionStart", command: "node ./hooks/slow.cjs", timeout: 20 },
      { event: "UserPromptSubmit", command: "node ./hooks/ask.cjs" },
    ]);
  });

  it("names no hooks for a plugin whose events Kimi never fires", () => {
    const { SessionStart: _fired, UserPromptSubmit: _also, ...unfired } = PRESENCE.hooks;

    expect(synthesize()({ name: "aidd-test" }, { ...PRESENCE, hooks: unfired })).not.toHaveProperty(
      "hooks"
    );
  });

  it("ships the plugin's hook scripts with Kimi's adapter in place of Claude Code's", () => {
    const { hooks } = contract().artifacts;
    const script = present(hooks.supported ? hooks.script : undefined);

    expect(script("hooks/lib/host.cjs", "claude's")).toContain('const HOST = "kimi";');
    expect(script("hooks/memory.cjs", "as shipped")).toBe("as shipped");
  });

  it("reports each event Kimi never fires, and ships the hooks file as it is", () => {
    const { hooks } = contract().artifacts;
    const convert = present(hooks.supported ? hooks.convertHooks : undefined);
    const json = JSON.stringify({ hooks: PRESENCE.hooks });

    expect(convert(json, "aidd-test")).toStrictEqual({
      content: json,
      warnings: ["kimi: unmapped event 'PreToolUse' skipped"],
    });
  });
});
