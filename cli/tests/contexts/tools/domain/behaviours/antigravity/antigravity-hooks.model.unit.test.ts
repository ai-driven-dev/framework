import { describe, expect, it } from "vitest";
import { antigravity } from "../../../../../../src/composition/tool-profiles/antigravity.js";
import type { ProjectHooksFormat } from "../../../../../../src/contexts/tools/contract/tool-vocabulary.js";

const format = antigravity.projectHooksDelivery()?.format as ProjectHooksFormat;

// biome-ignore lint/suspicious/noTemplateCurlyInString: intentionally testing Claude hook placeholder substitution
const PLUGIN_ROOT_VAR = "${CLAUDE_PLUGIN_ROOT}";

const MEMORY_HOOKS = JSON.stringify({
  hooks: {
    SessionStart: [
      { hooks: [{ type: "command", command: `node ${PLUGIN_ROOT_VAR}/hooks/update_memory.js` }] },
    ],
  },
});

const USER_HOOKS = `${JSON.stringify(
  { lint: { PostToolUse: [{ matcher: "run_command", hooks: [{ command: "./lint.sh" }] }] } },
  null,
  2
)}\n`;

function parse(content: string): Record<string, Record<string, unknown[]>> {
  return JSON.parse(content) as Record<string, Record<string, unknown[]>>;
}

describe("antigravity's project hooks format", () => {
  describe("when plugin hooks are merged", () => {
    it("writes one key named after the plugin, its handlers directly under SessionStart", () => {
      const { content, warnings } = format.merge(null, MEMORY_HOOKS, "aidd-context");

      expect(parse(content)).toEqual({
        "aidd-context": {
          SessionStart: [
            {
              type: "command",
              command: expect.stringContaining(
                Buffer.from("node ./.agents/hooks/aidd-context/update_memory.js").toString("base64")
              ),
            },
          ],
        },
      });
      expect(warnings).toEqual([]);
    });

    it("keeps a hook the user declared under another name", () => {
      const { content } = format.merge(USER_HOOKS, MEMORY_HOOKS, "aidd-context");

      expect(parse(content).lint).toEqual(parse(USER_HOOKS).lint);
      expect(Object.keys(parse(content))).toEqual(["lint", "aidd-context"]);
    });

    it("changes nothing when the same plugin is merged twice", () => {
      const { content: first } = format.merge(USER_HOOKS, MEMORY_HOOKS, "aidd-context");
      const { content: second } = format.merge(first, MEMORY_HOOKS, "aidd-context");

      expect(second).toBe(first);
    });

    it.each([false, true])("keeps enabled: %s when replacing the plugin's handlers", (enabled) => {
      const { content } = format.merge(USER_HOOKS, MEMORY_HOOKS, "aidd-context");
      const existing = JSON.parse(content);
      existing["aidd-context"].enabled = enabled;

      const merged = format.merge(
        JSON.stringify(existing),
        MEMORY_HOOKS.replace("update_memory.js", "refresh.js"),
        "aidd-context"
      );

      expect(JSON.parse(merged.content)).toEqual({
        ...JSON.parse(USER_HOOKS),
        "aidd-context": {
          enabled,
          SessionStart: [
            {
              type: "command",
              command: expect.stringContaining(
                Buffer.from("node ./.agents/hooks/aidd-context/refresh.js").toString("base64")
              ),
            },
          ],
        },
      });
    });

    it("refuses a file it cannot parse rather than overwriting it", () => {
      expect(() => format.merge("{ not json", MEMORY_HOOKS, "aidd-context")).toThrow();
    });

    it("keeps a timeout the plugin declared", () => {
      const withTimeout = MEMORY_HOOKS.replace(
        '"type":"command",',
        '"type":"command","timeout":10,'
      );

      const { content } = format.merge(null, withTimeout, "aidd-context");

      expect(parse(content)["aidd-context"].SessionStart).toEqual([
        expect.objectContaining({ timeout: 10 }),
      ]);
    });

    it("relays the events agy fires, PostToolUse grouped under agy's tool names and the others flat", () => {
      const all = JSON.stringify({
        hooks: Object.fromEntries(
          ["SessionStart", "PostToolUse", "Stop"].map((event) => [
            event,
            [{ matcher: "Write", hooks: [{ type: "command", command: "node x.cjs", timeout: 7 }] }],
          ])
        ),
      });

      const { content, warnings } = format.merge(null, all, "aidd-dev");

      expect(parse(content)["aidd-dev"]).toEqual({
        SessionStart: [expect.objectContaining({ type: "command" })],
        PostToolUse: [
          {
            matcher: "write_file",
            hooks: [expect.objectContaining({ type: "command", timeout: 7 })],
          },
        ],
        Stop: [expect.objectContaining({ type: "command" })],
      });
      expect(warnings).toEqual([]);
    });

    it("renames the tools of the matcher the plugins ship, and drops the other hosts' shells", () => {
      const shipped = JSON.stringify({
        hooks: {
          PostToolUse: [
            {
              matcher: "Write|Edit|Bash|Shell|bash|PowerShell",
              hooks: [{ type: "command", command: "node x.cjs" }],
            },
          ],
        },
      });

      const { content, warnings } = format.merge(null, shipped, "aidd-dev");

      expect(parse(content)["aidd-dev"].PostToolUse).toEqual([
        expect.objectContaining({ matcher: "write_file|edit_file|run_command" }),
      ]);
      expect(warnings).toEqual([]);
    });

    it("lists the handlers of a grouped event, not the group", () => {
      const post = JSON.stringify({
        hooks: { PostToolUse: [{ hooks: [{ type: "command", command: "node x.cjs" }] }] },
      });
      const { content } = format.merge(null, post, "aidd-dev");

      expect(format.contributedEntries(content, "aidd-dev")).toEqual([
        { event: "PostToolUse", entry: expect.objectContaining({ type: "command" }) },
      ]);
    });

    it("skips PreToolUse, which no framework script declares, with a warning naming it", () => {
      const pre = JSON.stringify({
        hooks: { PreToolUse: [{ hooks: [{ type: "command", command: "node x.cjs" }] }] },
      });

      const { content, warnings } = format.merge(null, pre, "aidd-dev");

      expect(parse(content)).toEqual({});
      expect(warnings).toEqual(["unmapped event 'PreToolUse' skipped"]);
    });

    it.each(["UserPromptSubmit", "SubagentStop", "SessionEnd"])(
      "skips %s, which agy never fires, with a warning naming it",
      (event) => {
        const hooks = JSON.stringify({
          hooks: {
            SessionStart: [{ hooks: [{ type: "command", command: "node x.cjs start" }] }],
            [event]: [{ hooks: [{ type: "command", command: "node x.cjs" }] }],
          },
        });

        const { content, warnings } = format.merge(null, hooks, "aidd-telemetry");

        expect(Object.keys(parse(content)["aidd-telemetry"])).toEqual(["SessionStart"]);
        expect(warnings).toEqual([`unmapped event '${event}' skipped`]);
      }
    );

    it("adds no key for a plugin with no event it maps", () => {
      const onlyEnd = JSON.stringify({
        hooks: { SessionEnd: [{ hooks: [{ type: "command", command: "node x.cjs" }] }] },
      });

      const { content } = format.merge(USER_HOOKS, onlyEnd, "aidd-telemetry");

      expect(Object.keys(parse(content))).toEqual(["lint"]);
    });
  });

  describe("when plugin hooks are removed", () => {
    it("removes the plugin's key and leaves the user's untouched", () => {
      const { content } = format.merge(USER_HOOKS, MEMORY_HOOKS, "aidd-context");

      expect(format.unmerge(content, "aidd-context")).toBe(USER_HOOKS);
    });
  });

  describe("when the entries a plugin contributed are listed", () => {
    it.each([false, true])("reads handlers when the named hook has enabled: %s", (enabled) => {
      const { content } = format.merge(null, MEMORY_HOOKS, "aidd-context");
      const existing = JSON.parse(content);
      existing["aidd-context"].enabled = enabled;

      expect(format.contributedEntries(JSON.stringify(existing), "aidd-context")).toEqual(
        format.contributedEntries(content, "aidd-context")
      );
    });

    it("lists the plugin's handlers with their event, and nothing of the user's", () => {
      const { content } = format.merge(USER_HOOKS, MEMORY_HOOKS, "aidd-context");

      expect(format.contributedEntries(content, "aidd-context")).toEqual([
        {
          event: "SessionStart",
          entry: {
            type: "command",
            command: expect.stringContaining(
              Buffer.from("node ./.agents/hooks/aidd-context/update_memory.js").toString("base64")
            ),
          },
        },
      ]);
      expect(format.contributedEntries(USER_HOOKS, "aidd-context")).toEqual([]);
    });
  });

  describe("contributedEntries on a malformed file", () => {
    it("names Antigravity, the plugin and the event when handlers are not an array", () => {
      const content = JSON.stringify({ "aidd-context": { SessionStart: {} } });

      expect(() => format.contributedEntries(content, "aidd-context")).toThrow(
        "Antigravity hook 'aidd-context.SessionStart' must be an array."
      );
    });
  });

  describe("when asked whether any hook is left", () => {
    it("is true only once no named hook is left", () => {
      expect(format.isEmpty("{}\n")).toBe(true);
      expect(format.isEmpty(USER_HOOKS)).toBe(false);
    });
  });

  it("puts a plugin's scripts under its own directory in .agents/hooks/", () => {
    expect(format.scriptDir("aidd-context")).toBe(".agents/hooks/aidd-context/");
    expect(format.scriptPath("aidd-context", "hooks/update_memory.js")).toBe(
      ".agents/hooks/aidd-context/update_memory.js"
    );
  });
});
