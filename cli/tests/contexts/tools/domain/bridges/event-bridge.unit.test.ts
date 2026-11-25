import { describe, expect, it } from "vitest";
import { REGISTERED_PROFILES } from "../../../../../src/composition/tool-profiles/index.js";
import { generateKiloHooksBridge } from "../../../../../src/contexts/tools/domain/behaviours/kilo/kilo-hooks-bridge.model.js";
import { generateOpencodeHooksBridge } from "../../../../../src/contexts/tools/domain/behaviours/opencode/opencode-hooks-bridge.model.js";
import { BRIDGE_EVENTS } from "../../../../../src/contexts/tools/domain/bridges/bridge-hook-table.js";
import { pascalCasePluginName } from "../../../../../src/contexts/tools/domain/bridges/event-bridge.js";
import { hooksOf, ROOT } from "../../testing/event-bridge-host.builder.js";

describe("naming a plugin in Pascal case", () => {
  it.each([
    ["aidd-sample", "AiddSample"],
    ["aidd--sample", "AiddSample"],
  ])("writes %s as %s", (plugin, stem) => {
    expect(pascalCasePluginName(plugin)).toBe(stem);
  });
});

// What every host's generator writes the same way, held once through Kilo's, whose template adds
// nothing to the shared body.
describe("the shared bridge generator", () => {
  const generate = generateKiloHooksBridge;

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

  it("builds the Stop calls once, in the shared builder", () => {
    const source = generate(hooksOf("Stop", `node ${ROOT}/hooks/a.cjs`), "aidd-test").content ?? "";

    expect(source.match(/hook_event_name: "Stop"/g)).toHaveLength(1);
    expect(source).toContain("function stopCallsFor(sessionId, directory) {");
  });
});

describe.each([
  ["OpenCode", generateOpencodeHooksBridge],
  ["Kilo", generateKiloHooksBridge],
])("the module generated for %s", (_host, generate) => {
  it("ships no pointer to a repository file or a tracking tag", () => {
    const text = generate(hooksOf("Stop", `node ${ROOT}/hooks/a.cjs`), "aidd-test").content ?? "";

    expect(text).not.toMatch(/\.(ts|md)\b|skipHooksJson|hooks-bridge|\bF\d+\b|hooks\/hooks\.json/);
  });

  it("declares no function it never calls", () => {
    const source = generate(hooksOf("Stop", `node ${ROOT}/hooks/a.cjs`), "aidd-test").content ?? "";
    // An exposed property such as `Plugin.name = name;` is a reference nobody reads.
    const code = source
      .split("\n")
      .filter((line) => !/^\w+\.\w+ = \w+;$/.test(line))
      .join("\n");
    const unused = [...code.matchAll(/^(?:async )?function (?<name>\w+)\(/gm)]
      .flatMap((match) => (match.groups?.name === undefined ? [] : [match.groups.name]))
      .filter((name) => code.match(new RegExp(`\\b${name}\\b`, "g"))?.length === 1);

    expect(unused).toEqual([]);
  });
});

describe.each(["opencode", "kilo"])("the events %s routes through its bridge", (toolId) => {
  it("are the ones a bridge replays, no more and no fewer", () => {
    const profile = REGISTERED_PROFILES.find((registered) => registered.toolId === toolId);
    const events = profile?.kind === "ai" ? [...(profile.hooks?.events.keys() ?? [])] : [];

    expect(events.sort()).toStrictEqual([...BRIDGE_EVENTS].sort());
  });
});
