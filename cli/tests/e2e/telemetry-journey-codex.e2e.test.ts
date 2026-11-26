import { spawnSync } from "node:child_process";
import { appendFile, copyFile, cp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sandboxedEnv } from "../shared/testing/cli-sandbox.builder.js";
import { parseJsonRecord } from "../shared/testing/json-value.builder.js";
import { REPOSITORY_ROOT } from "../shared/testing/repository-root.builder.js";
import {
  HOOKS,
  Journey,
  S_CODEX,
  S_CODEX_CHILD,
  S_CODEX_EXEC,
} from "./testing/telemetry-journey.builder.js";

let j: Journey;

beforeEach(async () => {
  j = await Journey.open();
});
afterEach(async () => {
  await j.close();
});

describe("the telemetry journey of a Codex session, on the built binary", () => {
  it("reminds a Codex session, and attributes its calls and its sub-agent's to the branch's task", async () => {
    await j.optIn();
    const sessions = join(j.env.fakeHome, ".codex", "sessions", "2026", "10", "19");
    await mkdir(sessions, { recursive: true });
    const line = (
      type: string,
      payload: Record<string, unknown>,
      at = "2026-10-19T10:00:00.000Z"
    ) => `${JSON.stringify({ timestamp: at, type, payload })}\n`;
    // Codex names no session to a command, so the branch's declaration is what attributes: the
    // branch a session started on is in its first line.
    const meta = (id: string, source: unknown, originator: string) =>
      line("session_meta", {
        id,
        cwd: j.repo,
        cli_version: "0.163.0",
        source,
        originator,
        git: { branch: "feat/x" },
      });
    const rootFile = join(sessions, `rollout-2026-10-19T10-00-00-${S_CODEX}.jsonl`);
    const childFile = join(sessions, `rollout-2026-10-19T10-00-01-${S_CODEX_CHILD}.jsonl`);
    const execFile = join(sessions, `rollout-2026-10-19T10-00-02-${S_CODEX_EXEC}.jsonl`);
    const turn = line("turn_context", { cwd: j.repo, model: "gpt-x" });
    await writeFile(rootFile, meta(S_CODEX, "cli", "codex-tui") + turn);
    await writeFile(execFile, meta(S_CODEX_EXEC, "exec", "codex_exec") + turn);

    // The hook as Codex runs it: the plugin's hooks with Codex's adapter, none of Claude Code's
    // variables, the session in the payload.
    const hooks = join(j.env.tempDir, "codex-hooks");
    await cp(HOOKS, hooks, { recursive: true });
    await copyFile(
      join(REPOSITORY_ROOT, "cli", "assets", "hooks-runtime", "host-codex.cjs"),
      join(hooks, "lib", "host.cjs")
    );
    const path = j.pathWithShim();
    const remind = (session: string, file: string) => {
      const run = spawnSync(process.execPath, [join(hooks, "task.cjs"), "remind"], {
        cwd: j.repo,
        input: JSON.stringify({
          session_id: session,
          transcript_path: file,
          cwd: j.repo,
          hook_event_name: "SessionStart",
          source: "startup",
        }),
        encoding: "utf8",
        env: sandboxedEnv(j.env.fakeHome, { ...j.sandboxVariables(), PATH: path, Path: path }),
      });
      expect(run.status, run.stderr).toBe(0);
      return run.stdout.trim() === "" ? null : parseJsonRecord(run.stdout);
    };

    expect(String(remind(S_CODEX, rootFile)?.systemMessage)).toContain(
      "Telemetry: no task on feat/x."
    );
    const declared = await j.aidd(["task", "codex-fix", "--ticket", "PROJ-7"]);
    expect(declared.exitCode, declared.stderr).toBe(0);
    expect(remind(S_CODEX, rootFile)).toBeNull();

    // Calls after the declaration, the sub-agent's in its own file under the root's session.
    const base = Date.now() + 60_000;
    const call = (id: string, thread: string, minute: number) =>
      line(
        "token_usage_record",
        {
          response_id: `resp_${id}`,
          session_id: S_CODEX,
          thread_id: thread,
          usage: {
            input_tokens: 10,
            cached_input_tokens: 4,
            cache_write_input_tokens: 0,
            output_tokens: 2,
            reasoning_output_tokens: 1,
            total_tokens: 12,
          },
        },
        new Date(base + minute * 60_000).toISOString()
      );
    await appendFile(rootFile, call("1", S_CODEX, 1) + call("2", S_CODEX, 2));
    const spawned = { subagent: { thread_spawn: { parent_thread_id: S_CODEX, depth: 1 } } };
    await writeFile(
      childFile,
      meta(S_CODEX_CHILD, spawned, "codex-tui") + turn + call("3", S_CODEX_CHILD, 3)
    );

    const day = new Date(base).toISOString().slice(0, 10);
    const last = new Date(base + 3 * 60_000).toISOString().slice(0, 10);
    const task = await j.report("task", day, last);
    expect(task.rows.map((row) => [row.kind, row.key, row.records])).toEqual([
      ["value", "codex-fix", 3],
    ]);
    const agents = await j.report("agent", day, last);
    expect(agents.rows.map((row) => [row.key, row.records]).sort()).toEqual([
      ["main", 2],
      ["subagent", 1],
    ]);
    const tools = await j.report("tool", day, last);
    expect(tools.rows.map((row) => [row.key, row.records])).toEqual([["codex", 3]]);
  });
});
