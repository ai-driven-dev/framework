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

function hooksOf(content: string): { name: string; trigger: string }[] {
  const { hooks } = JSON.parse(content);
  return hooks;
}

describe("kiro's hooks file", () => {
  it("holds a named hook per plugin script, triggered on SessionStart, in a v1 file", () => {
    const { content } = format.merge(null, SHIPPED, "aidd-context");

    expect(JSON.parse(content)).toMatchObject({
      version: "v1",
      hooks: [
        {
          name: "aidd-context-memory.cjs",
          trigger: "SessionStart",
          timeout: 5,
          action: { type: "command" },
        },
      ],
    });
  });

  it("drops an event with no captured payload and says so", () => {
    const { content, warnings } = format.merge(null, SHIPPED, "aidd-context");

    expect(hooksOf(content).map((hook) => hook.trigger)).toEqual(["SessionStart"]);
    expect(warnings).toEqual(["unmapped event 'PostToolUse' skipped"]);
  });

  it("keeps a hook the user declared, and changes nothing when merged twice", () => {
    const { content: first } = format.merge(USER_FILE, SHIPPED, "aidd-context");
    const { content: second } = format.merge(first, SHIPPED, "aidd-context");

    expect(hooksOf(first).map((hook) => hook.name)).toEqual(["lint", "aidd-context-memory.cjs"]);
    expect(second).toBe(first);
  });

  it("removes only the plugin's own hooks, and is empty once none is left", () => {
    const { content } = format.merge(null, SHIPPED, "aidd-context");
    const left = format.unmerge(format.merge(content, SHIPPED, "other").content, "aidd-context");

    expect(hooksOf(left).map((hook) => hook.name)).toEqual(["other-memory.cjs"]);
    expect(format.isEmpty(format.unmerge(content, "aidd-context"))).toBe(true);
  });

  it("lists what a plugin contributed under its trigger", () => {
    const { content } = format.merge(null, SHIPPED, "aidd-context");

    expect(format.contributedEntries(content, "aidd-context")).toMatchObject([
      { event: "SessionStart", entry: { name: "aidd-context-memory.cjs", timeout: 5 } },
    ]);
  });

  it("places a script under .kiro/hooks/<plugin>/", () => {
    expect(format.scriptPath("aidd-context", "hooks/memory.cjs")).toBe(
      ".kiro/hooks/aidd-context/memory.cjs"
    );
    expect(format.scriptDir("aidd-context")).toBe(".kiro/hooks/aidd-context/");
  });
});
