import { asPlainObject } from "../../../shared/domain/reading/plain-object.js";
import type { UsageRecord } from "../contract/usage-record.js";
import { counter, expected, type Json, text } from "./line-values.js";
import type { LineNames } from "./transcript-position.js";

export interface ClaudeUsageLine {
  readonly records: readonly UsageRecord[];
  /** One entry per shape not recognised, never turned into a record. */
  readonly unrecognised: readonly string[];
  /** For a line that is no usage line but an object: the directory and time it names. */
  readonly named?: LineNames;
}

const SYNTHETIC_MODEL = "<synthetic>";
/** What an advisor iteration adds to its message's key. Anchored for clarity only: the format
 * writes it as a suffix alone, and message and session ids hold no `#`. */
const NONE: ClaudeUsageLine = { records: [], unrecognised: [] };

function unrecognised(reason: string, root?: Json): ClaudeUsageLine {
  const named = root && { cwd: text(root.cwd), at: text(root.timestamp) };
  return { records: [], unrecognised: [reason], named };
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
  const writes = parts.map((part) => expected("usage", notes)(part, "cache_creation_input_tokens"));
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
  if (usage === null) return unrecognised("message.usage is not an object", root);

  const id = text(message.id);
  const sessionId = text(root.sessionId);
  const at = text(root.timestamp);
  if (id === null || sessionId === null || at === null) {
    return unrecognised("a usage line lacks message.id, sessionId or timestamp", root);
  }

  const notes: string[] = [];
  const key = `${id}:${text(root.requestId) ?? sessionId}`;
  const iterations = messageIterations(usage, notes);
  const shared = {
    tool: "claude-code",
    tool_version: text(root.version),
    session_id: sessionId,
    at,
    cwd: text(root.cwd),
    git_branch: text(root.gitBranch),
  } as const;
  const main = mainRecord(
    { shared, key, root, message, usage },
    cacheWrites(usage, iterations, notes),
    notes
  );
  return {
    records: [main, ...advisorRecords({ shared, key, iterations }, notes)],
    unrecognised: notes,
  };
}

type SharedFields = Pick<
  UsageRecord,
  "tool" | "tool_version" | "session_id" | "at" | "cwd" | "git_branch"
>;

function mainRecord(
  from: {
    readonly shared: SharedFields;
    readonly key: string;
    readonly root: Json;
    readonly message: Json;
    readonly usage: Json;
  },
  writes: { readonly total: number | null; readonly oneHour: number | null },
  notes: string[]
): UsageRecord {
  const { shared, key, root, message, usage } = from;
  const count = expected("usage", notes);
  return {
    ...shared,
    key,
    agent: root.isSidechain === true || text(root.agentId) !== null ? "subagent" : "main",
    model: text(message.model),
    input: count(usage, "input_tokens"),
    output: count(usage, "output_tokens"),
    cache_read: count(usage, "cache_read_input_tokens"),
    cache_write: writes.total,
    cache_write_1h: writes.oneHour,
    reasoning: counter(asPlainObject(usage.output_tokens_details)?.thinking_tokens),
  };
}

function advisorRecords(
  from: {
    readonly shared: SharedFields;
    readonly key: string;
    readonly iterations: readonly Json[];
  },
  notes: string[]
): UsageRecord[] {
  const { shared, key, iterations } = from;
  const count = expected("advisor", notes);
  return iterations
    .filter((iteration) => iteration.type === "advisor_message")
    .map(
      (advisor, n): UsageRecord => ({
        ...shared,
        key: `${key}#advisor${n}`,
        agent: "advisor",
        model: text(advisor.model),
        input: count(advisor, "input_tokens"),
        output: count(advisor, "output_tokens"),
        cache_read: count(advisor, "cache_read_input_tokens"),
        cache_write: count(advisor, "cache_creation_input_tokens"),
        cache_write_1h: counter(asPlainObject(advisor.cache_creation)?.ephemeral_1h_input_tokens),
        reasoning: null,
      })
    );
}
