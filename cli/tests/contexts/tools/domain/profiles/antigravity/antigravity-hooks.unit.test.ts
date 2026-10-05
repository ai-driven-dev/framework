import { describe, expect, it } from "vitest";
import { antigravityProjectHooksFormat as format } from "../../../../../../src/contexts/tools/domain/profiles/antigravity/antigravity-hooks.js";

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

describe("antigravityProjectHooksFormat", () => {
  describe("merge", () => {
    it("writes one key named after the plugin, its handlers directly under SessionStart, run from the repo root", () => {
      const { content, warnings } = format.merge(null, MEMORY_HOOKS, "aidd-context");

      expect(parse(content)).toEqual({
        "aidd-context": {
          SessionStart: [
            {
              type: "command",
              command: "cd .. && node ./.agents/hooks/aidd-context/update_memory.js",
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

    it("skips an event other than SessionStart with a warning naming it", () => {
      const telemetry = JSON.stringify({
        hooks: {
          SessionStart: [{ hooks: [{ type: "command", command: "node x.cjs start" }] }],
          PostToolUse: [{ hooks: [{ type: "command", command: "node x.cjs tool" }] }],
        },
      });

      const { content, warnings } = format.merge(null, telemetry, "aidd-telemetry");

      expect(Object.keys(parse(content)["aidd-telemetry"])).toEqual(["SessionStart"]);
      expect(warnings).toEqual(["antigravity: unmapped event 'PostToolUse' skipped"]);
    });

    it("adds no key for a plugin with no event it maps", () => {
      const onlyStop = JSON.stringify({
        hooks: { Stop: [{ hooks: [{ type: "command", command: "node x.cjs" }] }] },
      });

      const { content } = format.merge(USER_HOOKS, onlyStop, "aidd-telemetry");

      expect(Object.keys(parse(content))).toEqual(["lint"]);
    });
  });

  describe("unmerge", () => {
    it("removes the plugin's key and leaves the user's untouched", () => {
      const { content } = format.merge(USER_HOOKS, MEMORY_HOOKS, "aidd-context");

      expect(format.unmerge(content, "aidd-context")).toBe(USER_HOOKS);
    });
  });

  describe("contributedEntries", () => {
    it("lists the plugin's handlers with their event, and nothing of the user's", () => {
      const { content } = format.merge(USER_HOOKS, MEMORY_HOOKS, "aidd-context");

      expect(format.contributedEntries(content, "aidd-context")).toEqual([
        {
          event: "SessionStart",
          entry: {
            type: "command",
            command: "cd .. && node ./.agents/hooks/aidd-context/update_memory.js",
          },
        },
      ]);
      expect(format.contributedEntries(USER_HOOKS, "aidd-context")).toEqual([]);
    });
  });

  describe("isEmpty", () => {
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
