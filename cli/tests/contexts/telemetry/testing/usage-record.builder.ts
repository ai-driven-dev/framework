import type { StoredUsage } from "../../../../src/contexts/telemetry/domain/stored-usage.js";

/** A stored call with a neutral value for every field: `with` names what a test overrides. */
class UsageRecordBuilder {
  private fields: StoredUsage = {
    tool: "claude-code",
    tool_version: "2.1.0",
    key: "msg_A:req_A",
    session_id: "s-1",
    agent: "main",
    at: "2026-10-07T10:00:00.000Z",
    model: "m",
    input: 1,
    output: 10,
    cache_read: 0,
    cache_write: 0,
    cache_write_1h: null,
    reasoning: null,
    cwd: null,
    git_branch: null,
    repository_id: "repo-1",
  };

  with(overrides: Partial<StoredUsage>): this {
    this.fields = { ...this.fields, ...overrides };
    return this;
  }

  withKey(key: string): this {
    return this.with({ key });
  }

  withAt(at: string): this {
    return this.with({ at });
  }

  withOutput(output: number): this {
    return this.with({ output });
  }

  build(): StoredUsage {
    return this.fields;
  }
}

export const aUsageRecord = (): UsageRecordBuilder => new UsageRecordBuilder();
