import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mergeCodexFrameworkHooksJson } from "../../../../../../src/contexts/tools/domain/profiles/codex/hooks-format.js";
import { REPOSITORY_ROOT } from "../../../../../helpers/repository-root.js";

describe("mergeCodexFrameworkHooksJson", () => {
  // Codex delivers Stop once per turn (measured on 0.166, flat install): keep it under its name.
  it("keeps Stop, the event Codex delivers at the end of each turn", () => {
    // Split literal, the way a plugin-root token is written: biome's noTemplateCurlyInString
    // cannot tell one from a botched template.
    const command = `node $${"{PLUGIN_ROOT}"}/hooks/journal.cjs turn-end`;
    const plugin = JSON.stringify({
      hooks: { Stop: [{ hooks: [{ type: "command", command }] }] },
    });
    const { content } = mergeCodexFrameworkHooksJson(null, plugin);
    const result = JSON.parse(content) as { hooks: Record<string, unknown[]> };

    expect(Object.keys(result.hooks)).toEqual(["Stop"]);
    expect(JSON.stringify(result.hooks.Stop)).toContain(command);
  });

  it("leaves the events Codex does share with Claude under their own names", () => {
    const plugin = JSON.stringify({
      hooks: {
        SessionStart: [{ hooks: [{ type: "command", command: "node a.js session-start" }] }],
        PostToolUse: [{ hooks: [{ type: "command", command: "node a.js tool-used" }] }],
      },
    });
    const { content } = mergeCodexFrameworkHooksJson(null, plugin);
    const result = JSON.parse(content) as { hooks: Record<string, unknown[]> };

    expect(Object.keys(result.hooks).sort()).toEqual(["PostToolUse", "SessionStart"]);
  });

  it("emits top-level hooks wrapper", () => {
    const plugin = JSON.stringify({
      hooks: {
        SessionStart: [
          { hooks: [{ type: "command", command: "node ./.codex/hooks/plugin/run.js" }] },
        ],
      },
    });
    const { content } = mergeCodexFrameworkHooksJson(null, plugin);
    const result = JSON.parse(content) as Record<string, unknown>;
    expect(result).toHaveProperty("hooks");
  });

  it("does NOT emit the install-mode memory hook command", () => {
    const plugin = JSON.stringify({ hooks: {} });
    const { content } = mergeCodexFrameworkHooksJson(null, plugin);
    expect(content).not.toContain("update_memory.cjs");
    expect(content).not.toContain(".aidd/scripts");
  });

  it("merges plugin hooks into codex nested shape", () => {
    const plugin = JSON.stringify({
      hooks: {
        SessionStart: [
          {
            hooks: [{ type: "command", command: "node ./.codex/hooks/plugin/run.js", timeout: 30 }],
          },
        ],
      },
    });
    const { content } = mergeCodexFrameworkHooksJson(null, plugin);
    const result = JSON.parse(content) as {
      hooks: {
        SessionStart: Array<{ hooks: Array<{ type: string; command: string; timeout?: number }> }>;
      };
    };
    const hookItem = result.hooks.SessionStart[0].hooks[0];
    expect(hookItem.type).toBe("command");
    expect(hookItem.command).toBe("node ./.codex/hooks/plugin/run.js");
    expect(hookItem.timeout).toBe(30);
  });

  it("accumulates both plugins preserving existing entries", () => {
    const plugin1 = JSON.stringify({
      hooks: { SessionStart: [{ hooks: [{ type: "command", command: "first.js" }] }] },
    });
    const { content: after1 } = mergeCodexFrameworkHooksJson(null, plugin1);

    const plugin2 = JSON.stringify({
      hooks: { SessionStart: [{ hooks: [{ type: "command", command: "second.js" }] }] },
    });
    const { content: after2 } = mergeCodexFrameworkHooksJson(after1, plugin2);
    const result = JSON.parse(after2) as { hooks: { SessionStart: unknown[] } };
    expect(result.hooks.SessionStart).toHaveLength(2);
  });

  it("returns empty warnings array", () => {
    const plugin = JSON.stringify({ hooks: {} });
    const { warnings } = mergeCodexFrameworkHooksJson(null, plugin);
    expect(warnings).toEqual([]);
  });

  it("preserves matcher when present in plugin hooks", () => {
    const plugin = JSON.stringify({
      hooks: {
        SessionStart: [{ matcher: "startup", hooks: [{ type: "command", command: "run.js" }] }],
      },
    });
    const { content } = mergeCodexFrameworkHooksJson(null, plugin);
    const result = JSON.parse(content) as {
      hooks: { SessionStart: Array<{ matcher?: string }> };
    };
    expect(result.hooks.SessionStart[0].matcher).toBe("startup");
  });
});

describe("mergeCodexFrameworkHooksJson, entry by entry", () => {
  it("writes a matcher only when the group declares one, and drops an item without a command", () => {
    const { content } = mergeCodexFrameworkHooksJson(
      null,
      JSON.stringify({
        hooks: {
          PreToolUse: [
            { matcher: "Bash", hooks: [{ command: "a" }, { type: "command" }] },
            { hooks: [{ type: "prompt", command: "b" }] },
          ],
        },
      })
    );

    expect(JSON.parse(content)).toStrictEqual({
      hooks: {
        PreToolUse: [
          { matcher: "Bash", hooks: [{ type: "command", command: "a" }] },
          { hooks: [{ type: "prompt", command: "b" }] },
        ],
      },
    });
  });

  it("keeps every field of an entry, as the plugin route does, and defaults only its type", () => {
    const { content } = mergeCodexFrameworkHooksJson(
      null,
      JSON.stringify({
        hooks: {
          Stop: [
            {
              hooks: [
                { command: "a", timeout: 5, statusMessage: "working", async: true },
                { type: "prompt", command: "b", timeout: "5" },
              ],
            },
          ],
        },
      })
    );

    expect(JSON.parse(content)).toStrictEqual({
      hooks: {
        Stop: [
          {
            hooks: [
              { type: "command", command: "a", timeout: 5, statusMessage: "working", async: true },
              { type: "prompt", command: "b", timeout: "5" },
            ],
          },
        ],
      },
    });
  });
});

describe("the telemetry plugin's hooks on both Codex routes", () => {
  const shipped = () =>
    readFileSync(join(REPOSITORY_ROOT, "plugins", "aidd-telemetry", "hooks", "hooks.json"), "utf8");
  const entries = (document: string) =>
    (
      JSON.parse(document) as { hooks: Record<string, { hooks: Record<string, unknown>[] }[]> }
    ).hooks.SessionStart?.flatMap((group) => group.hooks);

  it("keeps the catch-up async with its timeout in the merged .codex/hooks.json", () => {
    const merged = entries(mergeCodexFrameworkHooksJson(null, shipped()).content);
    expect(merged?.find((entry) => String(entry.command).endsWith("catch-up.cjs"))).toMatchObject({
      async: true,
      timeout: 120,
    });
  });

  it("writes the same entries as the plugin tree, so one trust review covers both", () => {
    const merged = JSON.parse(mergeCodexFrameworkHooksJson(null, shipped()).content);
    expect(merged).toStrictEqual(JSON.parse(shipped()));
  });
});
