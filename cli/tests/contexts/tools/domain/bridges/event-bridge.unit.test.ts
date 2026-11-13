import { describe, expect, it } from "vitest";
import {
  parseHooksJsonForBridge,
  pascalCasePluginName,
  replaysNothing,
} from "../../../../../src/contexts/tools/domain/bridges/event-bridge.js";
import { generateKiloHooksBridge } from "../../../../../src/contexts/tools/domain/profiles/kilo/kilo-hooks-bridge.js";
import { generateOpencodeHooksBridge } from "../../../../../src/contexts/tools/domain/profiles/opencode/opencode-hooks-bridge.js";

const ROOT = "$" + "{CLAUDE_PLUGIN_ROOT}";
const hooksOf = (event: string, ...commands: (string | undefined)[]) =>
  JSON.stringify({
    hooks: { [event]: [{ hooks: commands.map((command) => ({ type: "command", command })) }] },
  });
const stopCalls = (...commands: (string | undefined)[]) =>
  parseHooksJsonForBridge(hooksOf("Stop", ...commands)).stop;

describe("parseHooksJsonForBridge", () => {
  it.each([
    [
      "splits arguments on any run of whitespace",
      `node ${ROOT}/hooks/a.cjs x   --q\t-y`,
      ["x", "--q", "-y"],
    ],
    ["reads a command with surrounding whitespace", `  node ${ROOT}/hooks/a.cjs  `, []],
  ])("%s", (_name, command, args) => {
    expect(stopCalls(command)).toStrictEqual([{ script: "a.cjs", args }]);
  });

  it("keeps a hook beside one that carries no command", () => {
    expect(stopCalls(undefined, `node ${ROOT}/hooks/a.cjs`)).toStrictEqual([
      { script: "a.cjs", args: [] },
    ]);
  });

  it.each([
    ["not run by node", `${ROOT}/hooks/a.sh`],
    ["run by another interpreter", `python ${ROOT}/hooks/a.py`],
    ["outside the plugin's hooks/ folder", `node ${ROOT}/scripts/a.cjs`],
  ])("drops a command %s", (_name, command) => {
    expect(stopCalls(command)).toStrictEqual([]);
  });

  it("reads each of the three mapped events and ignores any other", () => {
    const group = [{ hooks: [{ command: `node ${ROOT}/hooks/a.cjs` }] }];
    const table = parseHooksJsonForBridge(
      JSON.stringify({ hooks: { SessionStart: group, PostToolUse: group, PreToolUse: group } })
    );

    expect([table.sessionStart.length, table.stop.length, table.postToolUse.length]).toEqual([
      1, 0, 1,
    ]);
  });
});

describe("replaysNothing", () => {
  it.each([
    ["no hooks key", "{}"],
    ["no event", JSON.stringify({ hooks: {} })],
    ["an event with an empty group", JSON.stringify({ hooks: { SessionStart: [{}] } })],
    ["an event with no groups", JSON.stringify({ hooks: { Stop: [] } })],
    ["only an unmapped event", hooksOf("PreToolUse", `node ${ROOT}/hooks/a.cjs`)],
    ["only a command no bridge replays", hooksOf("Stop", `${ROOT}/hooks/a.sh`)],
  ])("holds for %s", (_name, hooksJson) => {
    expect(replaysNothing(parseHooksJsonForBridge(hooksJson))).toBe(true);
  });

  it("does not hold once any one mapped event names a replayable command", () => {
    expect(
      replaysNothing(parseHooksJsonForBridge(hooksOf("PostToolUse", `node ${ROOT}/hooks/a.cjs`)))
    ).toBe(false);
  });
  it("does not hold when two events each name a replayable command", () => {
    const hooksJson = JSON.stringify({
      hooks: {
        SessionStart: [{ hooks: [{ type: "command", command: `node ${ROOT}/hooks/a.cjs` }] }],
        Stop: [{ hooks: [{ type: "command", command: `node ${ROOT}/hooks/b.cjs` }] }],
      },
    });

    expect(replaysNothing(parseHooksJsonForBridge(hooksJson))).toBe(false);
  });
});

describe("pascalCasePluginName", () => {
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
    expect(generate(hooksOf("Stop", `${ROOT}/hooks/a.sh`), "aidd-test")).toBeNull();
    expect(generate(hooksOf("PreToolUse", `node ${ROOT}/hooks/a.cjs`), "aidd-test")).toBeNull();
  });

  it.each(["SessionStart", "Stop", "PostToolUse"])("writes a module for %s alone", (event) => {
    expect(generate(hooksOf(event, `node ${ROOT}/hooks/a.cjs`), "aidd-test")).not.toBeNull();
  });
});
