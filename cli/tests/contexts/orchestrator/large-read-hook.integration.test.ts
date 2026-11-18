import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { REPOSITORY_ROOT } from "../../helpers/repository-root.js";

const HOOKS = join(REPOSITORY_ROOT, "plugins/aidd-orchestrator/hooks");
const SESSION = "parent-session";
const ROOT_TOKEN = "$" + "{CLAUDE_PLUGIN_ROOT}";
let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "aidd-large-read-"));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function run(
  path: string,
  options: {
    limit?: string;
    input?: Record<string, unknown>;
    env?: Record<string, string | undefined>;
  } = {}
) {
  const input = {
    session_id: SESSION,
    transcript_path: "/fixture/.claude/projects/project/session.jsonl",
    cwd: dir,
    tool_name: "Read",
    tool_input: { file_path: path },
    ...options.input,
  };
  const result = spawnSync(process.execPath, [join(HOOKS, "large-read.cjs")], {
    input: JSON.stringify(input),
    encoding: "utf8",
    env: {
      ...process.env,
      CLAUDE_CODE_SESSION_ID: SESSION,
      AIDD_ORCHESTRATOR_MAX_READ_LINES: options.limit,
      ...options.env,
    },
  });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout ? JSON.parse(result.stdout) : null;
}

function file(name: string, content: string): string {
  const path = join(dir, name);
  writeFileSync(path, content);
  return path;
}

function denied(result: unknown) {
  expect(result).toMatchObject({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: expect.stringContaining("aidd-orchestrator explorer subagent"),
    },
  });
}

describe("large-file Read hook", () => {
  it("registers the Claude Read event with a bundled script", () => {
    const config = JSON.parse(readFileSync(join(HOOKS, "hooks.json"), "utf8"));
    expect(config.hooks.PreToolUse[0].matcher).toBe("Read");
    expect(config.hooks.PreToolUse[0].hooks[0].command).toBe(
      `node "${ROOT_TOKEN}/hooks/large-read.cjs"`
    );
  });

  it("is off until configured with a positive integer", () => {
    const path = file("unconfigured.txt", "one\ntwo\n");
    for (const limit of [undefined, "", "0", "-1", "1.5", "2e1", " 1", "9007199254740992"]) {
      expect(run(path, { limit })).toBeNull();
    }
  });

  it("denies only files over the configured line count, with or without a final newline", () => {
    const path = file("boundaries.txt", "first\nsecond\n");
    expect(run(path, { limit: "2" })).toBeNull();
    writeFileSync(path, "first\nsecond");
    expect(run(path, { limit: "2" })).toBeNull();
    writeFileSync(path, "first\nsecond\nthird");
    denied(run(path, { limit: "2" }));
  });

  it("counts empty lines and all common line endings, including a CRLF across stream chunks", () => {
    const path = file("line-endings.txt", `${"x".repeat(65_535)}\r\n\r\nthird`);
    expect(run(path, { limit: "3" })).toBeNull();
    denied(run(path, { limit: "2" }));
    writeFileSync(path, "first\rsecond\rthird");
    denied(run(path, { limit: "2" }));
    writeFileSync(path, "\n\n");
    expect(run(path, { limit: "2" })).toBeNull();
    denied(run(path, { limit: "1" }));
  });

  it("blocks partial parent reads and supports paths relative to the supplied working directory", () => {
    file("large-relative.txt", "one\ntwo\nthree");
    const result = run("large-relative.txt", {
      limit: "2",
      input: { tool_input: { file_path: "large-relative.txt", limit: 1, offset: 1 } },
    });
    denied(result);
    expect(result.hookSpecificOutput.permissionDecisionReason).toContain(
      "Partial Read calls are also blocked"
    );
  });

  it("lets subagents and other tools proceed", () => {
    const path = file("agent.txt", "one\ntwo\n");
    expect(run(path, { limit: "1", input: { agent_id: "child-123" } })).toBeNull();
    expect(run(path, { limit: "1", input: { tool_name: "Grep" } })).toBeNull();
  });

  it("does not block other hosts, including nested hosts inheriting Claude's environment", () => {
    const path = file("host.txt", "one\ntwo\n");
    expect(run(path, { limit: "1", input: { session_id: "copilot-session" } })).toBeNull();
    expect(
      run(path, {
        limit: "1",
        input: { transcript_path: "/fixture/.codex/sessions/2026/11/18/rollout-a.jsonl" },
      })
    ).toBeNull();
    expect(run(path, { limit: "1", env: { CLAUDE_CODE_SESSION_ID: undefined } })).toBeNull();
    denied(
      run(path, {
        limit: "1",
        input: { transcript_path: "C:\\fixture\\.claude\\projects\\project\\session.jsonl" },
      })
    );
  });

  it("returns Cursor's required allow response whether the Claude guard is off or on", () => {
    const path = file("cursor.txt", "one\ntwo\n");
    const input = { hook_event_name: "preToolUse", cursor_version: "1.7.2" };
    expect(run(path, { input })).toEqual({ permission: "allow" });
    expect(run(path, { limit: "1", input })).toEqual({ permission: "allow" });
  });

  it("leaves missing files and directories to Read", () => {
    expect(run(join(dir, "missing"), { limit: "1" })).toBeNull();
    expect(run(dir, { limit: "1" })).toBeNull();
  });

  it("leaves images and PDFs to Read instead of counting binary newlines", () => {
    for (const extension of ["png", "JPG", "jpeg", "gif", "webp", "pdf"]) {
      expect(run(file(`visual.${extension}`, "one\ntwo\n"), { limit: "1" })).toBeNull();
    }
  });

  it("applies the same limit to instruction files", () => {
    const path = file("AGENTS.md", "one\ntwo\n");
    denied(run(path, { limit: "1" }));
  });
});
