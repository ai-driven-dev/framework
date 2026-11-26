import { describe, expect, it } from "vitest";
import {
  type WrappedCommandHooksTarget,
  wrappedCommandHooksScriptPath,
} from "../../../../../src/contexts/tools/domain/hooks/wrapped-command-hooks-convert.js";
import {
  unmergeWrappedCommandHooks,
  wrappedCommandHookEntries,
} from "../../../../../src/contexts/tools/domain/hooks/wrapped-command-hooks-file.js";
import { mergeWrappedCommandHooks } from "../../../../../src/contexts/tools/domain/hooks/wrapped-command-hooks-merge.js";

const target: WrappedCommandHooksTarget = {
  label: "Host",
  descriptor: {
    flat: { scriptsDir: ".h/hooks/" },
    eventMap: {
      SessionStart: "SessionStart",
      PostToolUse: "PostToolUse",
    },
    toolNames: new Map([
      ["Write", "put"],
      ["Edit", "patch"],
      ["Bash", "sh"],
    ]),
  },
};

// The token a plugin writes for its own directory.
const ROOT = "$" + "{CLAUDE_PLUGIN_ROOT}";

const pluginHooks = (command: string, event = "SessionStart") =>
  JSON.stringify({ hooks: { [event]: [{ hooks: [{ type: "command", command, timeout: 5 }] }] } });

const merged = (existing: string | null, json: string, plugin = "p") =>
  mergeWrappedCommandHooks(target, existing, { json, plugin });

const insidePlugin: WrappedCommandHooksTarget = {
  ...target,
  runsFrom: { projectRoot: "../..", pluginDir: (plugin) => `.h/plugins/${plugin}/` },
};

describe("wrapped command hooks of a plugin the host runs from its own directory", () => {
  const command = (json: string): string =>
    JSON.parse(mergeWrappedCommandHooks(insidePlugin, null, { json, plugin: "p" }).content).p
      .SessionStart[0].command;
  const decoded = (wrapped: string) =>
    Buffer.from(wrapped.slice(wrapped.lastIndexOf(" ") + 1), "base64").toString();

  it("runs the script from the plugin's own directory, and the handler from the project root", () => {
    const wrapped = command(pluginHooks(`node ${ROOT}/hooks/run.cjs load`));

    expect([decoded(wrapped), wrapped]).toEqual([
      "node ./.h/plugins/p/hooks/run.cjs load",
      expect.stringContaining("cwd:'../..'"),
    ]);
  });
});

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
    const { content, warnings } = merged(null, pluginHooks("echo hi", "SessionEnd"));

    expect([JSON.parse(content), warnings]).toEqual([{}, ["unmapped event 'SessionEnd' skipped"]]);
  });

  it("replaces its own earlier entries, keeps the plugin's enabled flag and other plugins", () => {
    const existing = JSON.stringify({ p: { enabled: false, SessionStart: [] }, q: { z: [] } });
    const { content } = merged(existing, pluginHooks("echo hi"));
    const file = JSON.parse(content);

    expect([file.p.enabled, file.p.SessionStart.length, file.q]).toEqual([false, 1, { z: [] }]);
  });

  it("drops the plugin's entry when nothing it ships maps", () => {
    const existing = JSON.stringify({ p: { SessionStart: [] }, q: {} });

    expect(JSON.parse(merged(existing, pluginHooks("x", "SessionEnd")).content)).toEqual({ q: {} });
  });

  it("places a path outside hooks/ with locate, and a hooks/ path under the scripts directory", () => {
    const json = pluginHooks(`${ROOT}/hooks/a.sh && ${ROOT}/b.sh`);
    const { content } = mergeWrappedCommandHooks(target, null, {
      json,
      plugin: "p",
      locate: (path) => `L/${path}`,
    });
    const command = JSON.parse(content).p.SessionStart[0].command as string;
    const wrapped = Buffer.from(command.split(" ").at(-1) as string, "base64").toString();

    expect(wrapped).toBe("./.h/hooks/p/a.sh && ./L/b.sh");
  });

  it("names the path a plugin's scripts land at", () => {
    expect([
      wrappedCommandHooksScriptPath(target, "p", "hooks/a.sh"),
      wrappedCommandHooksScriptPath(target, "p", "other/a.sh"),
    ]).toEqual([".h/hooks/p/a.sh", ".h/hooks/p/other/a.sh"]);
  });

  it("keeps a path outside hooks/ as it is when no locator is given", () => {
    const { content } = mergeWrappedCommandHooks(target, null, {
      json: pluginHooks(`${ROOT}/b.sh`),
      plugin: "p",
    });
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

  it("writes no handler for a hook that runs no command", () => {
    const json = JSON.stringify({
      hooks: { SessionStart: [{ hooks: [{ type: "prompt" }, { type: "command", command: "x" }] }] },
    });

    expect(JSON.parse(merged(null, json).content).p.SessionStart).toHaveLength(1);
  });

  describe("a tool event's matcher", () => {
    const grouped = (event: string, ...matchers: (string | undefined)[]) =>
      JSON.stringify({
        hooks: {
          [event]: matchers.map((matcher) => ({
            ...(matcher === undefined ? {} : { matcher }),
            hooks: [{ type: "command", command: `run ${matcher}` }],
          })),
        },
      });
    const matchersOf = (json: string, event: string) =>
      JSON.parse(merged(null, json).content).p[event].map(
        (group: { matcher: string }) => group.matcher
      );

    it("renames the host's tools in a group and keeps one group per source group", () => {
      expect(matchersOf(grouped("PostToolUse", "Write|Edit", "Bash"), "PostToolUse")).toEqual([
        "put|patch",
        "sh",
      ]);
    });

    it("matches every tool for a group with no matcher", () => {
      expect(matchersOf(grouped("PostToolUse", undefined), "PostToolUse")).toEqual(["*"]);
    });

    it("drops a tool the host has no name for from a group that keeps others", () => {
      expect(matchersOf(grouped("PostToolUse", "Write|Shell|Edit"), "PostToolUse")).toEqual([
        "put|patch",
      ]);
    });

    it("names a host tool once when the matcher repeats it", () => {
      expect(matchersOf(grouped("PostToolUse", "Write|Write"), "PostToolUse")).toEqual(["put"]);
    });

    it("reads a tool name whatever its case", () => {
      expect(matchersOf(grouped("PostToolUse", "write|EDIT"), "PostToolUse")).toEqual([
        "put|patch",
      ]);
    });

    it("skips a group naming no tool the host has, with a warning naming it", () => {
      const { content, warnings } = merged(null, grouped("PostToolUse", "Delete", "Bash"));

      expect([JSON.parse(content).p.PostToolUse.length, warnings]).toEqual([
        1,
        ["PostToolUse matcher 'Delete' names no Host tool, group skipped"],
      ]);
    });

    it("adds no event when every group of it is skipped", () => {
      const { content } = merged(null, grouped("PostToolUse", "Delete"));

      expect(JSON.parse(content)).toEqual({});
    });
  });

  describe("a host that takes a PostToolUse answer only at a later event", () => {
    it("lists the handler among the plugin's entries, and unmerge removes it with the plugin", () => {
      const relaying: WrappedCommandHooksTarget = { ...target, releasesPostToolAnswersAt: "Later" };
      const { content } = mergeWrappedCommandHooks(relaying, null, {
        json: JSON.stringify({
          hooks: {
            PostToolUse: [{ matcher: "Write", hooks: [{ type: "command", command: "run" }] }],
          },
        }),
        plugin: "p",
        hostAdapter: true,
      });

      expect(wrappedCommandHookEntries(relaying, content, "p").map(({ event }) => event)).toEqual([
        "PostToolUse",
        "Later",
      ]);
      expect(JSON.parse(unmergeWrappedCommandHooks(content, "p"))).toEqual({});
    });
  });
});
