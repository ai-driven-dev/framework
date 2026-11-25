import { describe, expect, it } from "vitest";
import { kiro } from "../../../../../../src/composition/tool-profiles/kiro.js";
import type { ProjectHooksFormat } from "../../../../../../src/contexts/tools/contract/tool-vocabulary.js";

function formatOf(): ProjectHooksFormat {
  const format = kiro.projectHooksDelivery()?.format;
  if (format === undefined) throw new Error("kiro declares no project hooks format");
  return format;
}

const format = formatOf();

// biome-ignore lint/suspicious/noTemplateCurlyInString: intentionally testing Claude hook placeholder substitution
const PLUGIN_ROOT_VAR = "${CLAUDE_PLUGIN_ROOT}";

const SHIPPED = JSON.stringify({
  hooks: {
    SessionStart: [
      {
        hooks: [
          { type: "command", command: `node ${PLUGIN_ROOT_VAR}/hooks/memory.cjs load`, timeout: 5 },
        ],
      },
    ],
    PostToolUse: [
      {
        matcher: "Write",
        hooks: [{ type: "command", command: `node ${PLUGIN_ROOT_VAR}/hooks/a.cjs` }],
      },
    ],
    Stop: [{ hooks: [{ type: "command", command: `node ${PLUGIN_ROOT_VAR}/hooks/b.cjs` }] }],
  },
});

const UNCAPTURED = JSON.stringify({
  hooks: {
    PreToolUse: [{ hooks: [{ type: "command", command: `node ${PLUGIN_ROOT_VAR}/hooks/c.cjs` }] }],
  },
});

const USER_FILE = `${JSON.stringify(
  {
    version: "v1",
    hooks: [
      { name: "lint", trigger: "PostToolUse", action: { type: "command", command: "eslint" } },
    ],
  },
  null,
  2
)}\n`;

function hooksOf(content: string): { name: string; trigger: string; matcher?: string }[] {
  const { hooks } = JSON.parse(content);
  return hooks;
}

const PAIRED = JSON.stringify({
  hooks: {
    SessionStart: [
      { hooks: [{ type: "command", command: `node ${PLUGIN_ROOT_VAR}/hooks/memory.cjs load` }] },
    ],
    Stop: [
      { hooks: [{ type: "command", command: `node ${PLUGIN_ROOT_VAR}/hooks/memory.cjs sync` }] },
    ],
  },
});

describe("kiro's hooks file", () => {
  it("carries a plugin matcher as the tool tags Kiro selects by, one hook per tag", () => {
    const shipped = JSON.stringify({
      hooks: {
        PostToolUse: [
          {
            matcher: "Write|Edit|Delete|Bash|Shell|bash|PowerShell",
            hooks: [{ type: "command", command: `node ${PLUGIN_ROOT_VAR}/hooks/a.cjs` }],
          },
        ],
      },
    });
    const { content, warnings } = format.merge(null, shipped, "aidd-context");
    const hooks = hooksOf(content);

    expect(hooks.map(({ matcher }) => matcher)).toEqual(["write", "shell"]);
    expect(new Set(hooks.map(({ name }) => name)).size).toBe(2);
    expect(warnings).toEqual([]);
  });

  it("selects every tool when the plugin names none, and for events that take no matcher", () => {
    const command = `node ${PLUGIN_ROOT_VAR}/hooks/a.cjs`;
    const shipped = JSON.stringify({
      hooks: {
        SessionStart: [{ matcher: "Write", hooks: [{ type: "command", command }] }],
        PostToolUse: [{ hooks: [{ type: "command", command }] }],
        Stop: [{ matcher: "Bash", hooks: [{ type: "command", command }] }],
      },
    });
    const { content } = format.merge(null, shipped, "aidd-context");

    expect(hooksOf(content)).toHaveLength(3);
    for (const hook of hooksOf(content)) expect(hook).not.toHaveProperty("matcher");
  });

  it("drops a PostToolUse group whose matcher names no tool Kiro has, and says so", () => {
    const shipped = JSON.stringify({
      hooks: {
        PostToolUse: [
          {
            matcher: "NotebookEdit",
            hooks: [{ type: "command", command: `node ${PLUGIN_ROOT_VAR}/hooks/a.cjs` }],
          },
        ],
      },
    });
    const { content, warnings } = format.merge(null, shipped, "aidd-context");

    expect(hooksOf(content)).toEqual([]);
    expect(warnings).toEqual(["matcher 'NotebookEdit' names no kiro tool, hook skipped"]);
  });

  it("names a script paired across events once per trigger, so no two hooks share a name", () => {
    const { content } = format.merge(null, PAIRED, "aidd-context");
    const names = hooksOf(content).map((hook) => hook.name);

    expect(new Set(names).size).toBe(names.length);
  });

  it("holds a named hook per plugin script, triggered on SessionStart, in a v1 file", () => {
    const { content } = format.merge(null, SHIPPED, "aidd-context");

    expect(JSON.parse(content)).toMatchObject({
      version: "v1",
      hooks: [
        {
          name: "aidd-context-SessionStart-memory.cjs",
          trigger: "SessionStart",
          timeout: 5,
          action: { type: "command" },
        },
        {
          name: "aidd-context-PostToolUse-a.cjs-write",
          trigger: "PostToolUse",
          action: { type: "command" },
        },
        { name: "aidd-context-Stop-b.cjs", trigger: "Stop", action: { type: "command" } },
      ],
    });
  });

  it("drops an event with no captured payload and says so", () => {
    const { content, warnings } = format.merge(null, UNCAPTURED, "aidd-context");

    expect(hooksOf(content)).toEqual([]);
    expect(warnings).toEqual(["unmapped event 'PreToolUse' skipped"]);
  });

  it("keeps a hook the user declared, and changes nothing when merged twice", () => {
    const { content: first } = format.merge(USER_FILE, SHIPPED, "aidd-context");
    const { content: second } = format.merge(first, SHIPPED, "aidd-context");

    expect(hooksOf(first).map((hook) => hook.name)).toEqual([
      "lint",
      "aidd-context-SessionStart-memory.cjs",
      "aidd-context-PostToolUse-a.cjs-write",
      "aidd-context-Stop-b.cjs",
    ]);
    expect(second).toBe(first);
  });

  it("removes only the plugin's own hooks, and is empty once none is left", () => {
    const { content } = format.merge(null, SHIPPED, "aidd-context");
    const left = format.unmerge(format.merge(content, SHIPPED, "other").content, "aidd-context");

    expect(hooksOf(left).map((hook) => hook.name)).toEqual([
      "other-SessionStart-memory.cjs",
      "other-PostToolUse-a.cjs-write",
      "other-Stop-b.cjs",
    ]);
    expect(format.isEmpty(format.unmerge(content, "aidd-context"))).toBe(true);
  });

  it("lists what a plugin contributed under its trigger", () => {
    const { content } = format.merge(null, SHIPPED, "aidd-context");

    expect(format.contributedEntries(content, "aidd-context")).toMatchObject([
      {
        event: "SessionStart",
        entry: { name: "aidd-context-SessionStart-memory.cjs", timeout: 5 },
      },
      { event: "PostToolUse", entry: { name: "aidd-context-PostToolUse-a.cjs-write" } },
      { event: "Stop", entry: { name: "aidd-context-Stop-b.cjs" } },
    ]);
  });

  it("places a script under .kiro/hooks/<plugin>/", () => {
    expect(format.scriptPath("aidd-context", "hooks/memory.cjs")).toBe(
      ".kiro/hooks/aidd-context/memory.cjs"
    );
    expect(format.scriptDir("aidd-context")).toBe(".kiro/hooks/aidd-context/");
  });
});
