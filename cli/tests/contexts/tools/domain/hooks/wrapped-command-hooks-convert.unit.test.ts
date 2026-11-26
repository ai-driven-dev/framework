import { describe, expect, it } from "vitest";
import {
  convert,
  type WrappedCommandHooksTarget,
} from "../../../../../src/contexts/tools/domain/hooks/wrapped-command-hooks-convert.js";

const target: WrappedCommandHooksTarget = {
  label: "Host",
  descriptor: {
    flat: { scriptsDir: ".h/hooks/" },
    eventMap: { SessionStart: "SessionStart", PostToolUse: "PostToolUse" },
    toolNames: new Map([["Write", "put"]]),
  },
};
const relaying: WrappedCommandHooksTarget = { ...target, releasesPostToolAnswersAt: "Later" };
const relayingInside: WrappedCommandHooksTarget = {
  ...relaying,
  runsFrom: { projectRoot: "../..", pluginDir: (plugin) => `.h/plugins/${plugin}/` },
};

const post = (matcher: string) =>
  JSON.stringify({
    hooks: { PostToolUse: [{ matcher, hooks: [{ type: "command", command: "run", timeout: 5 }] }] },
  });

const handlersOf = (on: WrappedCommandHooksTarget, json: string, hostAdapter?: boolean) =>
  convert(on, { json, plugin: "p", hostAdapter }).handlers;

/** The handler at the later event: its wrapper's command, and what the wrapper runs. */
function released(on: WrappedCommandHooksTarget, matcher: string) {
  const [handler] = handlersOf(on, post(matcher), true).Later ?? [];
  const command = handler !== undefined && "command" in handler ? handler.command : "";
  return {
    handler,
    command,
    runs: Buffer.from(command.split(" ").at(-1) ?? "", "base64").toString(),
  };
}

describe("a host that takes a PostToolUse answer only at a later event", () => {
  it("adds a handler at that event, running the plugin's own copy of the host adapter", () => {
    const { handler, runs } = released(relaying, "Write");

    expect([handler, runs]).toEqual([
      expect.objectContaining({ type: "command", timeout: 5 }),
      "node ./.h/hooks/p/lib/host.cjs",
    ]);
  });

  it("runs it from the plugin's own directory for a host that runs a handler from there", () => {
    const { runs, command } = released(relayingInside, "Write");

    expect([runs, command]).toEqual([
      "node ./.h/plugins/p/hooks/lib/host.cjs",
      expect.stringContaining("cwd:'../..'"),
    ]);
  });

  it.each([false, undefined])("adds nothing for a plugin whose host adapter is %s", (shipped) => {
    expect(handlersOf(relaying, post("Write"), shipped)).not.toHaveProperty("Later");
  });

  it("adds nothing for a plugin with no PostToolUse handler", () => {
    const json = JSON.stringify({
      hooks: { SessionStart: [{ hooks: [{ type: "command", command: "run" }] }] },
    });

    expect(handlersOf(relaying, json, true)).not.toHaveProperty("Later");
  });

  it("adds nothing when every PostToolUse group is skipped", () => {
    expect(handlersOf(relaying, post("Delete"), true)).toEqual({});
  });

  it("adds nothing for a host that names no such event", () => {
    expect(Object.keys(handlersOf(target, post("Write"), true))).toEqual(["PostToolUse"]);
  });
});
