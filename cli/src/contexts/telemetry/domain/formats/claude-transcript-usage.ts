import { asPlainObject } from "../../../../kernel/reading/plain-object.js";
import type { UsageRecord } from "../usage-record.js";

export interface ClaudeUsageLine {
  readonly records: readonly UsageRecord[];
  /** One entry per shape not recognised, never turned into a record. */
  readonly unrecognised: readonly string[];
}

type Json = Record<string, unknown>;

const SYNTHETIC_MODEL = "<synthetic>";
const NONE: ClaudeUsageLine = { records: [], unrecognised: [] };

function counter(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function unrecognised(reason: string): ClaudeUsageLine {
  return { records: [], unrecognised: [reason] };
}

/** A counter that must be there: absent or malformed is unknown, and said so. */
function expected(source: Json, field: string, where: string, notes: string[]): number | null {
  const value = counter(source[field]);
  if (value === null) notes.push(`${where}.${field} is missing or not a count`);
  return value;
}

function messageIterations(usage: Json, notes: string[]): Json[] {
  const raw = usage.iterations;
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    notes.push("usage.iterations is not a list");
    return [];
  }
  return raw.flatMap((entry: unknown) => {
    const iteration = asPlainObject(entry);
    if (iteration === null) notes.push("usage.iterations holds a non-object");
    return iteration === null ? [] : [iteration];
  });
}

/** The top-level `cache_creation` split reflects only the first iteration, so the writes are
 * summed over every message iteration. */
function cacheWrites(
  usage: Json,
  iterations: readonly Json[],
  notes: string[]
): { readonly total: number | null; readonly oneHour: number | null } {
  const messages = iterations.filter((iteration) => iteration.type === "message");
  const parts = messages.length > 0 ? messages : [usage];
  const writes = parts.map((part) => expected(part, "cache_creation_input_tokens", "usage", notes));
  const hours = parts.map((part) =>
    counter(asPlainObject(part.cache_creation)?.ephemeral_1h_input_tokens)
  );
  return {
    total: writes.includes(null) ? null : sum(writes),
    oneHour: hours.includes(null) ? null : sum(hours),
  };
}

function sum(values: readonly (number | null)[]): number {
  return values.reduce<number>((all, value) => all + (value ?? 0), 0);
}

export function readClaudeUsageLine(line: string): ClaudeUsageLine {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return unrecognised("a complete line is not JSON");
  }
  const root = asPlainObject(parsed);
  if (root === null) return unrecognised("a line is not an object");
  if (root.type !== "assistant") return NONE;
  const message = asPlainObject(root.message);
  if (message === null || message.usage === undefined) return NONE;
  if (message.model === SYNTHETIC_MODEL) return NONE;
  const usage = asPlainObject(message.usage);
  if (usage === null) return unrecognised("message.usage is not an object");

  const id = text(message.id);
  const sessionId = text(root.sessionId);
  const at = text(root.timestamp);
  if (id === null || sessionId === null || at === null) {
    return unrecognised("a usage line lacks message.id, sessionId or timestamp");
  }

  const notes: string[] = [];
  const requestId = text(root.requestId);
  const key = requestId === null ? `${id}:${sessionId}:${at}` : `${id}:${requestId}`;
  const iterations = messageIterations(usage, notes);
  const writes = cacheWrites(usage, iterations, notes);
  const shared = {
    tool: "claude-code",
    tool_version: text(root.version),
    session_id: sessionId,
    at,
    reasoning: null,
    cwd: text(root.cwd),
    git_branch: text(root.gitBranch),
  } as const;

  const main: UsageRecord = {
    ...shared,
    key,
    agent: root.isSidechain === true || text(root.agentId) !== null ? "subagent" : "main",
    model: text(message.model),
    input: expected(usage, "input_tokens", "usage", notes),
    output: expected(usage, "output_tokens", "usage", notes),
    cache_read: expected(usage, "cache_read_input_tokens", "usage", notes),
    cache_write: writes.total,
    cache_write_1h: writes.oneHour,
  };

  const advisors = iterations
    .filter((iteration) => iteration.type === "advisor_message")
    .map(
      (advisor, n): UsageRecord => ({
        ...shared,
        key: `${key}#advisor${n}`,
        agent: "advisor",
        model: text(advisor.model),
        input: expected(advisor, "input_tokens", "advisor", notes),
        output: expected(advisor, "output_tokens", "advisor", notes),
        cache_read: expected(advisor, "cache_read_input_tokens", "advisor", notes),
        cache_write: expected(advisor, "cache_creation_input_tokens", "advisor", notes),
        cache_write_1h: null,
      })
    );

  return { records: [main, ...advisors], unrecognised: notes };
}
