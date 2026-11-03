import { describe, expect, it } from "vitest";
import { flattenCopilotHooksShape } from "../../../../../../src/contexts/tools/domain/profiles/copilot/hooks-format.js";

describe("flattenCopilotHooksShape", () => {
  it("flattens nested Claude matcher-group to flat entries", () => {
    const input = JSON.stringify({
      hooks: {
        PreToolUse: [{ hooks: [{ type: "command", command: "./.github/hooks/plugin/check.sh" }] }],
      },
    });
    const result = JSON.parse(flattenCopilotHooksShape(input)) as {
      version: number;
      hooks: { PreToolUse: Array<{ type: string; command: string }> };
    };
    expect(result.version).toBe(1);
    expect(result.hooks.PreToolUse).toHaveLength(1);
    expect(result.hooks.PreToolUse[0].type).toBe("command");
    expect(result.hooks.PreToolUse[0].command).toBe("./.github/hooks/plugin/check.sh");
  });

  it("keeps a group's matcher on each of its entries, and writes none for a group without one", () => {
    const input = JSON.stringify({
      hooks: {
        PostToolUse: [
          { matcher: "Write|Edit", hooks: [{ type: "command", command: "run.sh" }] },
          { hooks: [{ type: "command", command: "all.sh" }] },
        ],
      },
    });
    const result = JSON.parse(flattenCopilotHooksShape(input)) as {
      hooks: { PostToolUse: Array<Record<string, unknown>> };
    };
    expect(result.hooks.PostToolUse).toEqual([
      { type: "command", command: "run.sh", matcher: "Write|Edit" },
      { type: "command", command: "all.sh" },
    ]);
  });

  it("preserves timeout when present", () => {
    const input = JSON.stringify({
      hooks: {
        PreToolUse: [{ hooks: [{ type: "command", command: "run.sh", timeout: 30 }] }],
      },
    });
    const result = JSON.parse(flattenCopilotHooksShape(input)) as {
      hooks: { PreToolUse: Array<{ timeout?: number }> };
    };
    expect(result.hooks.PreToolUse[0].timeout).toBe(30);
  });

  it("preserves PascalCase event names", () => {
    const input = JSON.stringify({
      hooks: { SessionStart: [{ hooks: [{ type: "command", command: "run.js" }] }] },
    });
    const result = JSON.parse(flattenCopilotHooksShape(input)) as {
      hooks: Record<string, unknown>;
    };
    expect(result.hooks).toHaveProperty("SessionStart");
    expect(result.hooks).not.toHaveProperty("sessionStart");
  });

  it("returns empty hooks when input has no events", () => {
    const input = JSON.stringify({ hooks: {} });
    const result = JSON.parse(flattenCopilotHooksShape(input)) as Record<string, unknown>;
    expect(result).toEqual({ version: 1 });
  });
});

describe("flattenCopilotHooksShape, entry by entry", () => {
  it("omits an event whose groups hold no runnable entry", () => {
    const flat = flattenCopilotHooksShape(
      JSON.stringify({ hooks: { PreToolUse: [{ hooks: [] }, { hooks: [{ type: "command" }] }] } })
    );

    expect(JSON.parse(flat)).toStrictEqual({ version: 1 });
  });

  it("defaults a missing type to command, keeps a declared one, and carries timeout only when set", () => {
    const flat = flattenCopilotHooksShape(
      JSON.stringify({
        hooks: {
          Stop: [{ hooks: [{ command: "a" }, { type: "prompt", command: "b", timeout: 5 }] }],
        },
      })
    );

    expect(JSON.parse(flat)).toStrictEqual({
      version: 1,
      hooks: {
        Stop: [
          { type: "command", command: "a" },
          { type: "prompt", command: "b", timeout: 5 },
        ],
      },
    });
  });
});

describe("a matcher group that declares no hooks list", () => {
  const groupless = JSON.stringify({
    hooks: { Stop: [{ matcher: "x" }, { hooks: [{ command: "a" }] }] },
  });

  it("is skipped by the Copilot flattening", () => {
    expect(JSON.parse(flattenCopilotHooksShape(groupless))).toStrictEqual({
      version: 1,
      hooks: { Stop: [{ type: "command", command: "a" }] },
    });
  });
});
