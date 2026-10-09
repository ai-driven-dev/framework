export type UsageTool = "claude-code" | "codex";

export type UsageAgent = "main" | "subagent" | "advisor";

/** One billed model call. Facts only, in the tool's own terms; an unknown value is `null`,
 * never `0`. `(tool, key)` is stable across re-reads, so storing it is idempotent. */
export interface UsageRecord {
  readonly tool: UsageTool;
  readonly tool_version: string | null;
  readonly key: string;
  readonly session_id: string;
  readonly agent: UsageAgent;
  /** ISO-8601 UTC. */
  readonly at: string;
  readonly model: string | null;
  /** Excludes any cache read or write. */
  readonly input: number | null;
  /** Includes reasoning. */
  readonly output: number | null;
  readonly cache_read: number | null;
  /** All TTLs. */
  readonly cache_write: number | null;
  /** Of which one-hour TTL; `null` when the tool does not say. */
  readonly cache_write_1h: number | null;
  /** A subset of `output`; `null` when the tool does not say. */
  readonly reasoning: number | null;
  /** Raw, local only. */
  readonly cwd: string | null;
  /** Raw, data only, never an attribution source. */
  readonly git_branch: string | null;
}

/** What the fold ranks snapshots of one call by: a streamed call only ever grows. */
export function usageTotal(record: UsageRecord): number {
  return (
    (record.input ?? 0) +
    (record.output ?? 0) +
    (record.cache_read ?? 0) +
    (record.cache_write ?? 0)
  );
}
