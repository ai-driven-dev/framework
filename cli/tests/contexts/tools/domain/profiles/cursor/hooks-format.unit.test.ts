import { describe, expect, it } from "vitest";
import {
  cursorProjectHooksScriptDir,
  cursorProjectHooksScriptPath,
  mergeCursorFlatHooks,
  mergeCursorProjectHooksJson,
  unmergeCursorProjectHooksJson,
} from "../../../../../../src/contexts/tools/domain/profiles/cursor/hooks-format.js";

describe("mergeCursorFlatHooks", () => {
  it("maps SessionStart → sessionStart", () => {
    const plugin = JSON.stringify({
      hooks: {
        SessionStart: [
          { hooks: [{ type: "command", command: "node ./.cursor/hooks/plugin/run.js" }] },
        ],
      },
    });
    const { content } = mergeCursorFlatHooks(null, plugin);
    const result = JSON.parse(content) as { hooks: Record<string, unknown> };
    expect(result.hooks).toHaveProperty("sessionStart");
    expect(result.hooks).not.toHaveProperty("SessionStart");
  });

  it("maps UserPromptSubmit → beforeSubmitPrompt", () => {
    const plugin = JSON.stringify({
      hooks: {
        UserPromptSubmit: [
          { hooks: [{ type: "command", command: "node ./.cursor/hooks/plugin/prompt.js" }] },
        ],
      },
    });
    const { content } = mergeCursorFlatHooks(null, plugin);
    const result = JSON.parse(content) as { hooks: Record<string, unknown> };
    expect(result.hooks).toHaveProperty("beforeSubmitPrompt");
  });

  // An interactive Cursor session fires `stop` and a headless one fires `sessionEnd`, never
  // both from one run - so subscribing to `stop` alone journals nothing headless, in silence.
  it("maps Stop → both stop and sessionEnd, because Cursor fires one or the other", () => {
    const command = "node ./.cursor/hooks/plugin/turn-end.js";
    const plugin = JSON.stringify({
      hooks: { Stop: [{ hooks: [{ type: "command", command }] }] },
    });
    const { content } = mergeCursorFlatHooks(null, plugin);
    const result = JSON.parse(content) as { hooks: Record<string, unknown[]> };

    expect(Object.keys(result.hooks).sort()).toEqual(["sessionEnd", "stop"]);
    expect(result.hooks).not.toHaveProperty("Stop");
    // Both must carry the same command: a turn closed either way journals the same line.
    expect(JSON.stringify(result.hooks.sessionEnd)).toBe(JSON.stringify(result.hooks.stop));
    expect(JSON.stringify(result.hooks.stop)).toContain(command);
  });

  it("emits version:1 wrapper", () => {
    const plugin = JSON.stringify({ hooks: {} });
    const { content } = mergeCursorFlatHooks(null, plugin);
    const result = JSON.parse(content) as { version: number };
    expect(result.version).toBe(1);
  });

  it("produces flat {command} entries (no type, no nested hooks)", () => {
    const plugin = JSON.stringify({
      hooks: {
        SessionStart: [{ hooks: [{ type: "command", command: "node run.js" }] }],
      },
    });
    const { content } = mergeCursorFlatHooks(null, plugin);
    const result = JSON.parse(content) as {
      hooks: { sessionStart: Array<Record<string, unknown>> };
    };
    const entry = result.hooks.sessionStart[0];
    expect(entry).toHaveProperty("command");
    expect(entry).not.toHaveProperty("type");
    expect(entry).not.toHaveProperty("hooks");
  });

  it("maps the common tool lifecycle events", () => {
    const plugin = JSON.stringify({
      hooks: {
        PreToolUse: [{ hooks: [{ type: "command", command: "pre.sh" }] }],
        PostToolUse: [{ hooks: [{ type: "command", command: "post.sh" }] }],
        Stop: [{ hooks: [{ type: "command", command: "stop.sh" }] }],
        SubagentStop: [{ hooks: [{ type: "command", command: "subagent-stop.sh" }] }],
      },
    });
    const { content, warnings } = mergeCursorFlatHooks(null, plugin);
    const result = JSON.parse(content) as { hooks: Record<string, Array<{ command: string }>> };
    expect(result.hooks.preToolUse[0].command).toBe("pre.sh");
    expect(result.hooks.postToolUse[0].command).toBe("post.sh");
    expect(result.hooks.stop[0].command).toBe("stop.sh");
    expect(result.hooks.subagentStop[0].command).toBe("subagent-stop.sh");
    expect(warnings).toEqual([]);
  });

  it("warns and skips an unsupported source event", () => {
    const plugin = JSON.stringify({
      hooks: { UnknownEvent: [{ hooks: [{ type: "command", command: "run.sh" }] }] },
    });
    const { content, warnings } = mergeCursorFlatHooks(null, plugin);
    const result = JSON.parse(content) as { hooks: Record<string, unknown> };
    expect(Object.keys(result.hooks)).toHaveLength(0);
    expect(warnings.some((w) => w.includes("UnknownEvent"))).toBe(true);
  });

  it("accumulates both plugins into a single file", () => {
    const plugin1 = JSON.stringify({
      hooks: { SessionStart: [{ hooks: [{ type: "command", command: "first.js" }] }] },
    });
    const { content: after1 } = mergeCursorFlatHooks(null, plugin1);

    const plugin2 = JSON.stringify({
      hooks: { SessionStart: [{ hooks: [{ type: "command", command: "second.js" }] }] },
    });
    const { content: after2 } = mergeCursorFlatHooks(after1, plugin2);
    const result = JSON.parse(after2) as { hooks: { sessionStart: unknown[] } };
    expect(result.hooks.sessionStart).toHaveLength(2);
  });

  it("preserves existing entries from a previous cursor hooks.json", () => {
    const existing = JSON.stringify({
      version: 1,
      hooks: { sessionStart: [{ command: "existing.js" }] },
    });
    const plugin = JSON.stringify({
      hooks: { SessionStart: [{ hooks: [{ type: "command", command: "new.js" }] }] },
    });
    const { content } = mergeCursorFlatHooks(existing, plugin);
    const result = JSON.parse(content) as { hooks: { sessionStart: unknown[] } };
    expect(result.hooks.sessionStart).toHaveLength(2);
  });
});

describe("mergeCursorFlatHooks, entry by entry", () => {
  it("keeps only the entries that carry a command string", () => {
    const { content } = mergeCursorFlatHooks(
      null,
      JSON.stringify({
        hooks: { Stop: [{ hooks: [{ type: "command" }, { command: "a" }, { command: 5 }] }] },
      })
    );

    expect(JSON.parse(content)).toStrictEqual({
      version: 1,
      hooks: { stop: [{ command: "a" }], sessionEnd: [{ command: "a" }] },
    });
  });
});

describe("a group's matcher", () => {
  const MATCHER = "Write|Edit|MultiEdit";
  const grouped = (matcher?: string) =>
    JSON.stringify({
      hooks: {
        PostToolUse: [{ ...(matcher ? { matcher } : {}), hooks: [{ command: "node run.js" }] }],
      },
    });

  it("is kept on the entries of a flat translate", () => {
    expect(JSON.parse(mergeCursorFlatHooks(null, grouped(MATCHER)).content)).toStrictEqual({
      version: 1,
      hooks: { postToolUse: [{ command: "node run.js", matcher: MATCHER }] },
    });
  });

  it("is kept on the entries of a project install", () => {
    expect(
      JSON.parse(mergeCursorProjectHooksJson(null, grouped(MATCHER), "plugin-a").content)
    ).toStrictEqual({
      version: 1,
      hooks: { postToolUse: [{ command: "node run.js", matcher: MATCHER }] },
    });
  });

  it("leaves no matcher key on the entries of a group without one", () => {
    const flat = JSON.parse(mergeCursorFlatHooks(null, grouped()).content);
    const project = JSON.parse(mergeCursorProjectHooksJson(null, grouped(), "plugin-a").content);

    expect(flat.hooks.postToolUse[0]).not.toHaveProperty("matcher");
    expect(project.hooks.postToolUse[0]).not.toHaveProperty("matcher");
  });
});

describe("a hook's timeout", () => {
  const timed = (timeout?: unknown) =>
    JSON.stringify({
      hooks: {
        PostToolUse: [
          { hooks: [{ command: "node run.js", ...(timeout === undefined ? {} : { timeout }) }] },
        ],
      },
    });

  it("is carried, in Cursor's seconds, onto the entries of a flat translate", () => {
    expect(JSON.parse(mergeCursorFlatHooks(null, timed(5)).content)).toStrictEqual({
      version: 1,
      hooks: { postToolUse: [{ command: "node run.js", timeout: 5 }] },
    });
  });

  it("is carried onto the entries of a project install", () => {
    expect(
      JSON.parse(mergeCursorProjectHooksJson(null, timed(5), "plugin-a").content)
    ).toStrictEqual({
      version: 1,
      hooks: { postToolUse: [{ command: "node run.js", timeout: 5 }] },
    });
  });

  it("leaves no timeout key on an entry whose source declares none", () => {
    expect(
      JSON.parse(mergeCursorFlatHooks(null, timed()).content).hooks.postToolUse[0]
    ).not.toHaveProperty("timeout");
  });

  it("is dropped when it is not a number", () => {
    expect(
      JSON.parse(mergeCursorFlatHooks(null, timed("5")).content).hooks.postToolUse[0]
    ).not.toHaveProperty("timeout");
  });

  it("does not stop an entry installed without one from being uninstalled", () => {
    const legacy = JSON.stringify({
      version: 1,
      hooks: { postToolUse: [{ command: "node ./.cursor/hooks/aidd-a/journal.cjs" }] },
    });
    const { content } = mergeCursorProjectHooksJson(
      legacy,
      hooksJson(`node ${PLUGIN_ROOT_VAR}/hooks/journal.cjs`).replace("}]}]", ',"timeout":5}]}]'),
      "aidd-a"
    );
    const entries = JSON.parse(content).hooks.postToolUse;
    expect(entries).toStrictEqual([
      { command: "node ./.cursor/hooks/aidd-a/journal.cjs", timeout: 5 },
    ]);
    expect(JSON.parse(unmergeCursorProjectHooksJson(content, "aidd-a")).hooks).toStrictEqual({});
  });
});

describe("a matcher group that declares no hooks list", () => {
  const groupless = JSON.stringify({
    hooks: { Stop: [{ matcher: "x" }, { hooks: [{ command: "a" }] }] },
  });

  it("is skipped by the Cursor merge", () => {
    expect(JSON.parse(mergeCursorFlatHooks(null, groupless).content)).toStrictEqual({
      version: 1,
      hooks: { stop: [{ command: "a" }], sessionEnd: [{ command: "a" }] },
    });
  });
});

// biome-ignore lint/suspicious/noTemplateCurlyInString: intentionally testing Claude hook placeholder substitution
const PLUGIN_ROOT_VAR = "${CLAUDE_PLUGIN_ROOT}";

function hooksJson(command: string): string {
  return JSON.stringify({
    hooks: { PostToolUse: [{ hooks: [{ type: "command", command }] }] },
  });
}

const PLUGIN_A_HOOKS = hooksJson(`node ${PLUGIN_ROOT_VAR}/hooks/journal.cjs`);
const PLUGIN_B_HOOKS = hooksJson(`node ${PLUGIN_ROOT_VAR}/hooks/journal.cjs`);

describe("mergeCursorProjectHooksJson — repeat install (Phase 7, Task 3)", () => {
  it("installing the same plugin twice leaves one copy of its commands, not two", () => {
    const { content: afterFirst } = mergeCursorProjectHooksJson(null, PLUGIN_A_HOOKS, "aidd-a");
    const { content: afterSecond } = mergeCursorProjectHooksJson(
      afterFirst,
      PLUGIN_A_HOOKS,
      "aidd-a"
    );

    const parsed = JSON.parse(afterSecond) as { hooks: Record<string, Array<{ command: string }>> };
    expect(parsed.hooks.postToolUse).toHaveLength(1);
    expect(parsed.hooks.postToolUse[0].command).toContain(
      cursorProjectHooksScriptPath("aidd-a", "hooks/journal.cjs")
    );
  });

  it("re-installing one plugin leaves every other plugin's entries untouched", () => {
    const { content: afterA } = mergeCursorProjectHooksJson(null, PLUGIN_A_HOOKS, "aidd-a");
    const { content: afterB } = mergeCursorProjectHooksJson(afterA, PLUGIN_B_HOOKS, "aidd-b");
    const { content: afterReinstallA } = mergeCursorProjectHooksJson(
      afterB,
      PLUGIN_A_HOOKS,
      "aidd-a"
    );

    const parsed = JSON.parse(afterReinstallA) as {
      hooks: Record<string, Array<{ command: string }>>;
    };
    const commands = parsed.hooks.postToolUse.map((e) => e.command);
    expect(commands).toHaveLength(2);
    expect(commands.some((c) => c.includes("/aidd-a/"))).toBe(true);
    expect(commands.some((c) => c.includes("/aidd-b/"))).toBe(true);
  });
});

describe("unmergeCursorProjectHooksJson (Phase 7, Task 3)", () => {
  it("removes one plugin's entries, leaving every other plugin's untouched", () => {
    const { content: afterA } = mergeCursorProjectHooksJson(null, PLUGIN_A_HOOKS, "aidd-a");
    const { content: afterB } = mergeCursorProjectHooksJson(afterA, PLUGIN_B_HOOKS, "aidd-b");

    const unmerged = unmergeCursorProjectHooksJson(afterB, "aidd-a");

    const parsed = JSON.parse(unmerged) as { hooks: Record<string, Array<{ command: string }>> };
    const commands = parsed.hooks.postToolUse.map((e) => e.command);
    expect(commands).toHaveLength(1);
    expect(commands[0]).toContain("/aidd-b/");
  });

  it("drops an event key entirely once its last entry is removed", () => {
    const { content: afterA } = mergeCursorProjectHooksJson(null, PLUGIN_A_HOOKS, "aidd-a");

    const unmerged = unmergeCursorProjectHooksJson(afterA, "aidd-a");

    const parsed = JSON.parse(unmerged) as { hooks: Record<string, unknown> };
    expect(parsed.hooks).not.toHaveProperty("postToolUse");
  });
});

describe("cursorProjectHooksScriptDir", () => {
  it("names the directory a plugin's copied scripts live under", () => {
    expect(cursorProjectHooksScriptDir("aidd-telemetry")).toBe(".cursor/hooks/aidd-telemetry/");
  });
});

describe("rewriting a plugin's root token for the project hooks file", () => {
  it("relocates a command under hooks/ to the plugin's own script directory", () => {
    const { content } = mergeCursorProjectHooksJson(null, PLUGIN_A_HOOKS, "plugin-a");

    expect(JSON.parse(content)).toStrictEqual({
      version: 1,
      hooks: { postToolUse: [{ command: "node ./.cursor/hooks/plugin-a/journal.cjs" }] },
    });
  });

  it("leaves a plugin-relative path outside hooks/ where it was", () => {
    const { content } = mergeCursorProjectHooksJson(
      null,
      hooksJson(`node ${PLUGIN_ROOT_VAR}/scripts/run.cjs`),
      "plugin-a"
    );

    expect(JSON.parse(content)).toStrictEqual({
      version: 1,
      hooks: { postToolUse: [{ command: "node scripts/run.cjs" }] },
    });
  });

  it("names where a hook script lands, with or without its hooks/ prefix", () => {
    expect(cursorProjectHooksScriptPath("plugin-a", "hooks/journal.cjs")).toBe(
      ".cursor/hooks/plugin-a/journal.cjs"
    );
    expect(cursorProjectHooksScriptPath("plugin-a", "lib/x.cjs")).toBe(
      ".cursor/hooks/plugin-a/lib/x.cjs"
    );
  });
});
