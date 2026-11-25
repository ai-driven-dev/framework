import { describe, expect, it } from "vitest";
import { REGISTERED_PROFILES } from "../../../../../src/composition/tool-profiles/index.js";
import { generateKiloHooksBridge } from "../../../../../src/contexts/tools/domain/behaviours/kilo/kilo-hooks-bridge.model.js";
import { generateOpencodeHooksBridge } from "../../../../../src/contexts/tools/domain/behaviours/opencode/opencode-hooks-bridge.model.js";
import { BRIDGE_EVENTS } from "../../../../../src/contexts/tools/domain/bridges/bridge-hook-table.js";
import { pascalCasePluginName } from "../../../../../src/contexts/tools/domain/bridges/event-bridge.js";

const ROOT = "$" + "{CLAUDE_PLUGIN_ROOT}";
const hooksOf = (event: string, ...commands: (string | undefined)[]) =>
  JSON.stringify({
    hooks: { [event]: [{ hooks: commands.map((command) => ({ type: "command", command })) }] },
  });

describe("naming a plugin in Pascal case", () => {
  it.each([
    ["aidd-sample", "AiddSample"],
    ["aidd--sample", "AiddSample"],
  ])("writes %s as %s", (plugin, stem) => {
    expect(pascalCasePluginName(plugin)).toBe(stem);
  });
});

describe.each([
  ["OpenCode", generateOpencodeHooksBridge],
  ["Kilo", generateKiloHooksBridge],
])("the bridge generator of %s", (_host, generate) => {
  it("writes no module for a hooks.json no mapped event of which is replayable", () => {
    expect(generate(hooksOf("Stop", `${ROOT}/hooks/a.sh`), "aidd-test").content).toBeNull();
    expect(
      generate(hooksOf("SessionEnd", `node ${ROOT}/hooks/a.cjs`), "aidd-test").content
    ).toBeNull();
  });

  it.each(["SessionStart", "Stop", "PostToolUse", "PreToolUse", "UserPromptSubmit"])(
    "writes a module for %s alone",
    (event) => {
      expect(
        generate(hooksOf(event, `node ${ROOT}/hooks/a.cjs`), "aidd-test").content
      ).not.toBeNull();
    }
  );

  it("tells the events no bridge replays, with the module or without", () => {
    const hooks = JSON.stringify({
      hooks: { Stop: [{ hooks: [{ command: `node ${ROOT}/hooks/a.cjs` }] }], SessionEnd: [] },
    });

    expect([
      generate(hooks, "aidd-test").unrelayed,
      generate(hooksOf("SubagentStop"), "aidd-test").unrelayed,
    ]).toStrictEqual([["SessionEnd"], ["SubagentStop"]]);
  });

  it("ships no pointer to a repository file or a tracking tag", () => {
    const text = generate(hooksOf("Stop", `node ${ROOT}/hooks/a.cjs`), "aidd-test").content ?? "";

    expect(text).not.toMatch(/\.(ts|md)\b|skipHooksJson|hooks-bridge|\bF\d+\b|hooks\/hooks\.json/);
  });
});

describe.each(["opencode", "kilo"])("the events %s routes through its bridge", (toolId) => {
  it("are the ones a bridge replays, no more and no fewer", () => {
    const profile = REGISTERED_PROFILES.find((registered) => registered.toolId === toolId);
    const events = profile?.kind === "ai" ? [...(profile.hooks?.events.keys() ?? [])] : [];

    expect(events.sort()).toStrictEqual([...BRIDGE_EVENTS].sort());
  });
});
