import { describe, expect, it } from "vitest";
import {
  isWrappedCommandHooksFileEmpty,
  mergeWrappedCommandHooks,
  unmergeWrappedCommandHooks,
  type WrappedCommandHooksTarget,
  wrappedCommandHookEntries,
  wrappedCommandHooksScriptDir,
  wrappedCommandHooksScriptPath,
} from "../../../../../src/contexts/tools/domain/hooks/wrapped-command-hooks-merge.js";

const target: WrappedCommandHooksTarget = {
  label: "Host",
  descriptor: { flat: { scriptsDir: ".h/hooks/" }, eventMap: { SessionStart: ["SessionStart"] } },
};

// The token a plugin writes for its own directory.
const ROOT = "$" + "{CLAUDE_PLUGIN_ROOT}";

const pluginHooks = (command: string, event = "SessionStart") =>
  JSON.stringify({ hooks: { [event]: [{ hooks: [{ type: "command", command, timeout: 5 }] }] } });

const merged = (existing: string | null, json: string, plugin = "p") =>
  mergeWrappedCommandHooks(target, existing, json, plugin);

describe("wrapped command hooks", () => {
  it("wraps each command of a mapped event under the plugin's name, keeping its timeout", () => {
    const { content, warnings } = merged(null, pluginHooks("echo hi"));
    const handler = JSON.parse(content).p.SessionStart[0];

    expect([handler.type, handler.timeout, handler.command]).toEqual([
      "command",
      5,
      expect.stringContaining(` ${Buffer.from("echo hi").toString("base64")}`),
    ]);
    expect(warnings).toEqual([]);
  });

  it("skips an event the host does not map, and says so", () => {
    const { content, warnings } = merged(null, pluginHooks("echo hi", "Stop"));

    expect([JSON.parse(content), warnings]).toEqual([{}, ["unmapped event 'Stop' skipped"]]);
  });

  it("replaces its own earlier entries, keeps the plugin's enabled flag and other plugins", () => {
    const existing = JSON.stringify({ p: { enabled: false, SessionStart: [] }, q: { z: [] } });
    const { content } = merged(existing, pluginHooks("echo hi"));
    const file = JSON.parse(content);

    expect([file.p.enabled, file.p.SessionStart.length, file.q]).toEqual([false, 1, { z: [] }]);
  });

  it("drops the plugin's entry when nothing it ships maps", () => {
    const existing = JSON.stringify({ p: { SessionStart: [] }, q: {} });

    expect(JSON.parse(merged(existing, pluginHooks("x", "Stop")).content)).toEqual({ q: {} });
  });

  it("places a path outside hooks/ with locate, and a hooks/ path under the scripts directory", () => {
    const json = pluginHooks(`${ROOT}/hooks/a.sh && ${ROOT}/b.sh`);
    const { content } = mergeWrappedCommandHooks(target, null, json, "p", (path) => `L/${path}`);
    const command = JSON.parse(content).p.SessionStart[0].command as string;
    const wrapped = Buffer.from(command.split(" ").at(-1) as string, "base64").toString();

    expect(wrapped).toBe("./.h/hooks/p/a.sh && ./L/b.sh");
  });

  it("unmerges one plugin and reports the file empty once none is left", () => {
    const file = unmergeWrappedCommandHooks(JSON.stringify({ p: {}, q: {} }), "p");

    expect([JSON.parse(file), isWrappedCommandHooksFileEmpty(file)]).toEqual([{ q: {} }, false]);
    expect(isWrappedCommandHooksFileEmpty("{}")).toBe(true);
  });

  it("lists the entries a plugin holds, by event, leaving out its enabled flag", () => {
    const entry = { type: "command", command: "c" };
    const content = JSON.stringify({ p: { enabled: true, SessionStart: [entry] } });

    expect(wrappedCommandHookEntries(target, content, "p")).toEqual([
      { event: "SessionStart", entry },
    ]);
    expect(wrappedCommandHookEntries(target, content, "other")).toEqual([]);
  });

  it("names its host when an event holds no array", () => {
    const content = JSON.stringify({ p: { SessionStart: {} } });

    expect(() => wrappedCommandHookEntries(target, content, "p")).toThrow(
      "Host hook 'p.SessionStart' must be an array."
    );
  });

  it("names the directory and the path a plugin's scripts land at", () => {
    expect([
      wrappedCommandHooksScriptDir(target, "p"),
      wrappedCommandHooksScriptPath(target, "p", "hooks/a.sh"),
      wrappedCommandHooksScriptPath(target, "p", "other/a.sh"),
    ]).toEqual([".h/hooks/p/", ".h/hooks/p/a.sh", ".h/hooks/p/other/a.sh"]);
  });

  it("keeps a path outside hooks/ as it is when no locator is given", () => {
    const { content } = mergeWrappedCommandHooks(target, null, pluginHooks(`${ROOT}/b.sh`), "p");
    const command = JSON.parse(content).p.SessionStart[0].command as string;

    expect(Buffer.from(command.split(" ").at(-1) as string, "base64").toString()).toBe("./b.sh");
  });

  it("writes no timeout for a command that has none, and no handler for a group without hooks", () => {
    const json = JSON.stringify({
      hooks: { SessionStart: [{ hooks: [{ type: "command", command: "x" }] }, {}] },
    });
    const handlers = JSON.parse(merged(null, json).content).p.SessionStart;

    expect(handlers).toHaveLength(1);
    expect(handlers[0]).not.toHaveProperty("timeout");
  });
});
