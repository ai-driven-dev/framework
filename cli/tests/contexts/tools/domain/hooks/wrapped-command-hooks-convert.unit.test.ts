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

const relaying: WrappedCommandHooksTarget = {
  ...target,
  descriptor: { ...target.descriptor, releasesPostToolAnswersAt: "Later" },
};

const post = (matcher: string) =>
  JSON.stringify({
    hooks: { PostToolUse: [{ matcher, hooks: [{ type: "command", command: "x" }] }] },
  });

const handlersOf = (on: WrappedCommandHooksTarget, json: string) =>
  convert(on, { json, plugin: "p" }).handlers;

/** The command a handler runs, read back out of its wrapper. */
function wrapped(handler: unknown): string {
  if (typeof handler !== "object" || handler === null || !("command" in handler)) return "";
  const { command } = handler;
  return Buffer.from(String(command).split(" ").at(-1) ?? "", "base64").toString();
}

describe("a host that takes a PostToolUse answer only at a later event", () => {
  it("adds a handler at that event, running the plugin's own copy of the host adapter", () => {
    const [handler] = handlersOf(relaying, post("Write")).Later ?? [];

    expect(handler).toMatchObject({ type: "command", timeout: undefined });
    expect(wrapped(handler)).toBe("node ./.h/hooks/p/lib/host.cjs");
  });

  it("adds nothing for a plugin with no PostToolUse handler", () => {
    const json = JSON.stringify({
      hooks: { SessionStart: [{ hooks: [{ type: "command", command: "x" }] }] },
    });

    expect(handlersOf(relaying, json)).not.toHaveProperty("Later");
  });

  it("adds nothing when every PostToolUse group is skipped", () => {
    expect(handlersOf(relaying, post("Delete"))).toEqual({});
  });

  it("adds nothing for a host that names no such event", () => {
    expect(handlersOf(target, post("Write"))).not.toHaveProperty("Later");
  });
});
