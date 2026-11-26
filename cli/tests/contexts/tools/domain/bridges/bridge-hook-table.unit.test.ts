import { describe, expect, it } from "vitest";
import {
  parseHooksJsonForBridge,
  replaysNothing,
} from "../../../../../src/contexts/tools/domain/bridges/bridge-hook-table.js";
import { hooksOf, ROOT } from "../../testing/bridged-hosts.builder.js";

const stopCalls = (...commands: (string | undefined)[]) =>
  parseHooksJsonForBridge(hooksOf("Stop", ...commands)).callsOf("Stop");

describe("reading a hooks file for the bridge", () => {
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

  it("reads each of the five mapped events and ignores any other", () => {
    const group = [{ hooks: [{ command: `node ${ROOT}/hooks/a.cjs` }] }];
    const table = parseHooksJsonForBridge(
      JSON.stringify({
        hooks: {
          SessionStart: group,
          PostToolUse: group,
          PreToolUse: group,
          UserPromptSubmit: group,
          SessionEnd: group,
        },
      })
    );

    expect([
      table.callsOf("SessionStart").length,
      table.callsOf("Stop").length,
      table.callsOf("PostToolUse").length,
      table.callsOf("PreToolUse").length,
      table.callsOf("UserPromptSubmit").length,
    ]).toEqual([1, 0, 1, 1, 1]);
  });
});

describe("when no event has a replayable command", () => {
  it.each([
    ["no hooks key", "{}"],
    ["no event", JSON.stringify({ hooks: {} })],
    ["an event with an empty group", JSON.stringify({ hooks: { SessionStart: [{}] } })],
    ["an event with no groups", JSON.stringify({ hooks: { Stop: [] } })],
    ["only an unmapped event", hooksOf("SessionEnd", `node ${ROOT}/hooks/a.cjs`)],
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

describe("telling which events of a hooks file a bridge leaves out", () => {
  it("names each event outside the five a bridge replays, replayable command or not", () => {
    const hooksJson = JSON.stringify({
      hooks: { Stop: [], SessionEnd: [], PreToolUse: [], SubagentStop: [], UserPromptSubmit: [] },
    });

    expect(parseHooksJsonForBridge(hooksJson).unrelayed).toStrictEqual([
      "SessionEnd",
      "SubagentStop",
    ]);
  });

  it("names none when the file has no hooks", () => {
    expect(parseHooksJsonForBridge("{}").unrelayed).toStrictEqual([]);
  });
});
