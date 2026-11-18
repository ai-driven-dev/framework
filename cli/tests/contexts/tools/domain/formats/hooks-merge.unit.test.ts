import { describe, expect, it } from "vitest";
import {
  type HooksMergeTarget,
  mergeHooks,
  pluginScriptDir,
  pluginScriptPath,
  unmergeHooks,
} from "../../../../../src/contexts/tools/domain/formats/hooks-merge.js";

// biome-ignore lint/suspicious/noTemplateCurlyInString: the placeholder a plugin's hooks name
const ROOT = "${CLAUDE_PLUGIN_ROOT}";
const DIR = ".tool/hooks/";

const NESTED: HooksMergeTarget = {
  file: { wrapper: {}, entries: { shape: "matchers", itemsKept: "commands" } },
  scriptsDir: DIR,
};
const WHOLE: HooksMergeTarget = {
  file: { wrapper: {}, entries: { shape: "matchers", itemsKept: "all" } },
  scriptsDir: DIR,
};
const GROUPLESS = JSON.stringify({
  hooks: { Stop: [{ matcher: "x" }, { hooks: [{ command: "a" }] }] },
});

function flat(
  fieldsKept: HooksMergeTarget["file"]["entries"] & { shape: "flat" }
): HooksMergeTarget {
  return { file: { wrapper: { version: 1 }, entries: fieldsKept }, scriptsDir: DIR };
}

const COPILOT_LIKE = flat({ shape: "flat", fieldsKept: ["type", "command", "matcher", "timeout"] });
const CURSOR_LIKE = flat({ shape: "flat", fieldsKept: ["command", "matcher", "timeout"] });

function shipped(event: string, ...groups: unknown[]): string {
  return JSON.stringify({ hooks: { [event]: groups } });
}

function merged(
  existing: string | null,
  pluginHooks: string,
  target: HooksMergeTarget,
  plugin = "p"
): unknown {
  return JSON.parse(mergeHooks(existing, pluginHooks, plugin, target).content);
}

describe("where a plugin's scripts land", () => {
  it("in a folder of the plugin's own under the route's scripts folder", () => {
    expect(pluginScriptDir(DIR, "p")).toBe(".tool/hooks/p/");
    expect(pluginScriptPath(DIR, "p", "hooks/lib/a.cjs")).toBe(".tool/hooks/p/lib/a.cjs");
    expect(pluginScriptPath(DIR, "p", "lib/a.cjs")).toBe(".tool/hooks/p/lib/a.cjs");
  });
});

describe("the plugin's commands", () => {
  it("point at where its scripts land, and leave anything else under the plugin root as written", () => {
    const hooks = shipped("Start", {
      hooks: [{ type: "command", command: `node ${ROOT}/hooks/a.cjs ${ROOT}/bin/x` }],
    });

    expect(merged(null, hooks, CURSOR_LIKE)).toStrictEqual({
      version: 1,
      hooks: { Start: [{ command: "node ./.tool/hooks/p/a.cjs bin/x" }] },
    });
  });
});

describe("a path the plugin ships outside its hooks", () => {
  it("lands where the caller places it", () => {
    const hooks = shipped("Start", { hooks: [{ command: `cat ${ROOT}/skills/s/SKILL.md` }] });
    const located = mergeHooks(null, hooks, "p", CURSOR_LIKE, (path) => `.tool/${path}`).content;

    expect(JSON.parse(located)).toStrictEqual({
      version: 1,
      hooks: { Start: [{ command: "cat .tool/skills/s/SKILL.md" }] },
    });
  });
});

describe("the file's wrapper", () => {
  it("is written where the file has no keys of its own", () => {
    expect(
      merged(null, shipped("Start", { hooks: [{ command: "a" }] }), CURSOR_LIKE)
    ).toStrictEqual({ version: 1, hooks: { Start: [{ command: "a" }] } });
  });

  it("keeps every other key the file holds, and `hooks` where it stood", () => {
    const existing = JSON.stringify({ model: "opus", hooks: {}, theme: "dark" });
    const content = mergeHooks(
      existing,
      shipped("Start", { hooks: [{ type: "command", command: "a" }] }),
      "p",
      NESTED
    ).content;

    expect(Object.keys(JSON.parse(content))).toStrictEqual(["model", "hooks", "theme"]);
  });

  it("carries no `hooks` key once nothing is left in it", () => {
    expect(merged(null, JSON.stringify({ hooks: {} }), COPILOT_LIKE)).toStrictEqual({
      version: 1,
    });
    expect(mergeHooks(null, "{}", "p", NESTED).content).toBe("{}\n");
  });

  it("is serialized two-space indented, with a closing newline", () => {
    expect(
      mergeHooks(null, shipped("Start", { hooks: [{ command: "a" }] }), "p", CURSOR_LIKE).content
    ).toBe(
      '{\n  "version": 1,\n  "hooks": {\n    "Start": [\n      {\n        "command": "a"\n      }\n    ]\n  }\n}\n'
    );
  });
});

describe("a nested entry", () => {
  it("keeps each item whole under its matcher, a missing type read as a command", () => {
    const hooks = shipped("Post", {
      matcher: "Write",
      hooks: [{ command: "a", async: true, timeout: 5 }, { type: "prompt" }],
    });

    expect(merged(null, hooks, NESTED)).toStrictEqual({
      hooks: {
        Post: [
          { matcher: "Write", hooks: [{ command: "a", async: true, timeout: 5, type: "command" }] },
        ],
      },
    });
  });

  it("keeps an item's own type, and writes no matcher where the group has none", () => {
    expect(
      merged(null, shipped("Start", { hooks: [{ type: "http", command: "a" }] }), NESTED)
    ).toStrictEqual({
      hooks: { Start: [{ hooks: [{ type: "http", command: "a" }] }] },
    });
  });
});

describe("a nested entry kept whole", () => {
  it("keeps every group and item as the plugin ships it, a prompt hook and extra keys too", () => {
    const hooks = shipped("Post", {
      matcher: "Write",
      label: "mine",
      hooks: [{ type: "prompt", prompt: "check" }, { command: `node ${ROOT}/hooks/a.cjs` }],
    });

    expect(merged(null, hooks, WHOLE)).toStrictEqual({
      hooks: {
        Post: [
          {
            matcher: "Write",
            label: "mine",
            hooks: [{ type: "prompt", prompt: "check" }, { command: "node ./.tool/hooks/p/a.cjs" }],
          },
        ],
      },
    });
  });
});

describe("a matcher group that declares no hooks list", () => {
  it("is kept as it is where items are kept whole", () => {
    expect(merged(null, GROUPLESS, WHOLE)).toStrictEqual({
      hooks: { Stop: [{ matcher: "x" }, { hooks: [{ command: "a" }] }] },
    });
  });

  it("is skipped where only commands are kept", () => {
    expect(merged(null, GROUPLESS, NESTED)).toStrictEqual({
      hooks: { Stop: [{ hooks: [{ command: "a", type: "command" }] }] },
    });
  });

  it("is skipped by a flat file", () => {
    expect(merged(null, GROUPLESS, CURSOR_LIKE)).toStrictEqual({
      version: 1,
      hooks: { Stop: [{ command: "a" }] },
    });
  });
});

describe("a flat entry", () => {
  const hooks = shipped("Post", {
    matcher: "Write",
    hooks: [{ command: "a", async: true, timeout: 5 }, { type: "prompt" }],
  });

  it("carries the fields the tool keeps, in its order, a missing type read as a command", () => {
    const [copilot] = (merged(null, hooks, COPILOT_LIKE) as { hooks: { Post: object[] } }).hooks
      .Post;
    const [cursor] = (merged(null, hooks, CURSOR_LIKE) as { hooks: { Post: object[] } }).hooks.Post;

    expect(Object.entries(copilot ?? {})).toStrictEqual([
      ["type", "command"],
      ["command", "a"],
      ["matcher", "Write"],
      ["timeout", 5],
    ]);
    expect(Object.entries(cursor ?? {})).toStrictEqual([
      ["command", "a"],
      ["matcher", "Write"],
      ["timeout", 5],
    ]);
  });

  it("keeps an item's own type, and drops an empty matcher and a timeout that is no number", () => {
    const odd = shipped("Post", {
      matcher: "",
      hooks: [{ type: "http", command: "a", timeout: "5" }],
    });

    expect(merged(null, odd, COPILOT_LIKE)).toStrictEqual({
      version: 1,
      hooks: { Post: [{ type: "http", command: "a" }] },
    });
  });

  it("lists no item that runs no command", () => {
    expect(merged(null, hooks, COPILOT_LIKE)).toStrictEqual({
      version: 1,
      hooks: { Post: [{ type: "command", command: "a", matcher: "Write", timeout: 5 }] },
    });
  });

  it("lists every item of every group in turn", () => {
    const two = shipped(
      "Post",
      { hooks: [{ command: "a" }, { command: "b" }] },
      { hooks: [{ command: "c" }] }
    );

    expect(merged(null, two, CURSOR_LIKE)).toStrictEqual({
      version: 1,
      hooks: { Post: [{ command: "a" }, { command: "b" }, { command: "c" }] },
    });
  });
});

describe("the tool's events", () => {
  const target: HooksMergeTarget = { ...CURSOR_LIKE, eventMap: { Stop: ["stop", "sessionEnd"] } };

  it("fan one source event out to every event the tool fires for it", () => {
    expect(merged(null, shipped("Stop", { hooks: [{ command: "a" }] }), target)).toStrictEqual({
      version: 1,
      hooks: { stop: [{ command: "a" }], sessionEnd: [{ command: "a" }] },
    });
  });

  it("skip and report an event the tool does not fire", () => {
    expect(
      mergeHooks(null, shipped("Notify", { hooks: [{ command: "a" }] }), "p", target)
    ).toStrictEqual({
      content: '{\n  "version": 1\n}\n',
      warnings: ["unmapped event 'Notify' skipped"],
    });
  });

  it("are the source's own where the tool maps none", () => {
    expect(
      mergeHooks(null, shipped("Notify", { hooks: [{ command: "a" }] }), "p", CURSOR_LIKE).warnings
    ).toStrictEqual([]);
  });
});

describe("merging into a file the plugin already wrote to", () => {
  const mine = `node ./${DIR}p/a.cjs`;
  const existing = JSON.stringify({
    hooks: {
      Start: [
        { hooks: [{ command: mine }] },
        { hooks: [{ command: `node ./${DIR}other/a.cjs` }] },
        { matcher: "W", hooks: [{ command: "echo person" }, { command: mine }] },
      ],
      Post: [{ hooks: [{ command: mine }] }],
      Empty: [{ hooks: [] }],
    },
  });

  it("removes the plugin's own entries item by item before adding them again", () => {
    expect(
      merged(
        existing,
        shipped("Start", { hooks: [{ command: `node ${ROOT}/hooks/a.cjs` }] }),
        NESTED
      )
    ).toStrictEqual({
      hooks: {
        Start: [
          { hooks: [{ command: `node ./${DIR}other/a.cjs` }] },
          { matcher: "W", hooks: [{ command: "echo person" }] },
          { hooks: [{ command: mine, type: "command" }] },
        ],
        Empty: [{ hooks: [] }],
      },
    });
  });

  it("leaves another plugin's entries alone, even one whose name starts the same", () => {
    const flatFile = JSON.stringify({
      version: 1,
      hooks: { Start: [{ command: mine }, { command: `node ./${DIR}p-extra/a.cjs` }] },
    });

    expect(merged(flatFile, "{}", CURSOR_LIKE)).toStrictEqual({
      version: 1,
      hooks: { Start: [{ command: `node ./${DIR}p-extra/a.cjs` }] },
    });
  });

  it("finds the plugin's folder only where a path starts, never inside a person's own path", () => {
    const withRoot: HooksMergeTarget = { ...CURSOR_LIKE, rootToken: ROOT };
    const file = JSON.stringify({
      version: 1,
      hooks: {
        Start: [
          { command: `node ./x/${DIR}p/mine.sh` },
          { command: `node "./${DIR}p/a.cjs"` },
          { command: `${DIR}p/b.cjs` },
          { command: `node '${DIR}p/c.cjs'` },
          { command: `node ${ROOT}/${DIR}p/d.cjs` },
          { command: `node ./other${DIR}p/e.cjs` },
        ],
      },
    });

    expect(merged(file, "{}", withRoot)).toStrictEqual({
      version: 1,
      hooks: {
        Start: [{ command: `node ./x/${DIR}p/mine.sh` }, { command: `node ./other${DIR}p/e.cjs` }],
      },
    });
  });

  it("reads a root token before the folder only where the tool declares that token", () => {
    const home = `node \${HOME}/${DIR}p/a.cjs`;
    const file = JSON.stringify({
      version: 1,
      hooks: { Start: [{ command: home }, { command: `node ${ROOT}/${DIR}p/b.cjs` }] },
    });

    expect(merged(file, "{}", { ...CURSOR_LIKE, rootToken: ROOT })).toStrictEqual({
      version: 1,
      hooks: { Start: [{ command: home }] },
    });
    expect(merged(file, "{}", CURSOR_LIKE)).toStrictEqual(JSON.parse(file));
  });

  it("keeps an entry that names no command", () => {
    const flatFile = JSON.stringify({ hooks: { Start: [{ prompt: "x" }] } });

    expect(merged(flatFile, "{}", NESTED)).toStrictEqual({ hooks: { Start: [{ prompt: "x" }] } });
  });
});

describe("taking a plugin's hooks out", () => {
  it("removes its entries alone, in the file's own form", () => {
    const existing = JSON.stringify({
      version: 1,
      hooks: {
        Start: [{ command: `node ./${DIR}p/a.cjs` }, { command: "echo person" }],
        Post: [{ command: `node ./${DIR}p/b.cjs` }],
      },
    });

    expect(JSON.parse(unmergeHooks(existing, "p", CURSOR_LIKE))).toStrictEqual({
      version: 1,
      hooks: { Start: [{ command: "echo person" }] },
    });
  });

  it("leaves no `hooks` key once the plugin's were the last", () => {
    const existing = JSON.stringify({
      version: 1,
      hooks: { Start: [{ command: `node ./${DIR}p/a.cjs` }] },
    });

    expect(unmergeHooks(existing, "p", CURSOR_LIKE)).toBe('{\n  "version": 1\n}\n');
  });
});
