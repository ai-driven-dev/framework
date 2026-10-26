import { asPlainObject } from "../../../../kernel/reading/plain-object.js";
import type { LineNames, UsageRecord } from "../usage-record.js";
import { expected, type Json, text } from "./line-values.js";

export interface CodexUsageLine {
  readonly records: readonly UsageRecord[];
  /** One entry per shape not recognised, never turned into a record. */
  readonly unrecognised: readonly string[];
  /** For a call line that gave no record: its context's directory and its time. */
  readonly named?: LineNames;
}

const CALL = "token_usage_record";
const NONE: CodexUsageLine = { records: [], unrecognised: [] };

/** A reader for one Codex session file, read from its start: a call's model and directory are
 * written before it, in the latest `turn_context`, and its version and branch in the file's
 * first `session_meta` (a sub-agent's file carries its parent's after its own). Only a
 * `token_usage_record` is a call: the turn and thread totals beside it, and `token_count`
 * events, are running totals that would count a call many times. */
export function codexUsageReader(): (line: string) => CodexUsageLine {
  let session: Json | null = null;
  let turn: Json | null = null;
  const cwd = () => text(turn?.cwd) ?? text(session?.cwd);
  const unrecognised = (reason: string, at: string | null): CodexUsageLine => ({
    records: [],
    unrecognised: [reason],
    named: { cwd: cwd(), at },
  });

  return (line) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      return line.includes(CALL) ? unrecognised(`a line holding ${CALL} is not JSON`, null) : NONE;
    }
    const root = asPlainObject(parsed);
    const payload = asPlainObject(root?.payload);
    if (root?.type === "session_meta") session ??= payload ?? {};
    if (root?.type === "turn_context") turn = payload;
    if (root?.type !== CALL) return NONE;

    const usage = asPlainObject(payload?.usage);
    const key = text(payload?.response_id);
    const sessionId = text(payload?.session_id);
    const thread = text(payload?.thread_id);
    const at = text(root.timestamp);
    if (usage === null || key === null || sessionId === null || thread === null || at === null) {
      return unrecognised(
        `a ${CALL} lacks response_id, session_id, thread_id, timestamp or usage`,
        at
      );
    }

    const notes: string[] = [];
    const count = (field: string) => expected(usage, field, "usage", notes);
    const input = count("input_tokens");
    const cacheRead = count("cached_input_tokens");
    const cacheWrite = count("cache_write_input_tokens");
    const record: UsageRecord = {
      tool: "codex",
      tool_version: text(session?.cli_version),
      key,
      session_id: sessionId,
      agent: thread === sessionId ? "main" : "subagent",
      at,
      model: text(turn?.model),
      input:
        input === null || cacheRead === null || cacheWrite === null
          ? null
          : input - cacheRead - cacheWrite,
      output: count("output_tokens"),
      cache_read: cacheRead,
      cache_write: cacheWrite,
      cache_write_1h: null,
      reasoning: count("reasoning_output_tokens"),
      cwd: cwd(),
      git_branch: text(asPlainObject(session?.git)?.branch),
    };
    return { records: [record], unrecognised: notes };
  };
}
