import { describe, expect, it } from "vitest";
import { mapClaudeCodeTranscriptToSinkRecords } from "../../../../../src/contexts/telemetry/domain/formats/claude-code-transcript.js";

const SID = "22222222-2222-4222-8222-222222222222";

const USAGE = {
  input_tokens: 10,
  output_tokens: 5,
  cache_read_input_tokens: 2,
  cache_creation_input_tokens: 1,
};

const COUNTERS = {
  input_tokens: 10,
  output_tokens: 5,
  cache_read_tokens: 2,
  cache_creation_tokens: 1,
};

const BARE_RECORD = {
  kind: "request",
  vendor_id: SID,
  vendor_field: "sessionId",
  ...COUNTERS,
};

function chain(lines: readonly Record<string, unknown>[]): string {
  return lines.map((line) => JSON.stringify(line)).join("\n");
}

function assistantLine(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: "assistant",
    sessionId: SID,
    message: { id: "msg_1", usage: USAGE },
    ...overrides,
  };
}

function withUsage(usage: Record<string, unknown>): string {
  return chain([assistantLine({ message: { id: "msg_1", usage } })]);
}

function skillCall(parts: readonly unknown[]): Record<string, unknown> {
  return {
    type: "assistant",
    uuid: "a1",
    parentUuid: "u1",
    sessionId: SID,
    message: { content: parts },
  };
}

function promptedRecords(callParts: readonly unknown[]) {
  return mapClaudeCodeTranscriptToSinkRecords(
    chain([
      { type: "user", uuid: "u1", promptId: "p-abc" },
      skillCall(callParts),
      assistantLine({ uuid: "a2", parentUuid: "a1" }),
    ])
  );
}

describe("a billed line is one that carries every counter as a number", () => {
  it("yields no record when input_tokens is missing", () => {
    const { input_tokens: _dropped, ...usage } = USAGE;

    expect(mapClaudeCodeTranscriptToSinkRecords(withUsage(usage))).toStrictEqual([]);
  });

  it("yields no record when cache_read_input_tokens is missing", () => {
    const { cache_read_input_tokens: _dropped, ...usage } = USAGE;

    expect(mapClaudeCodeTranscriptToSinkRecords(withUsage(usage))).toStrictEqual([]);
  });

  it("yields no record when output_tokens is missing", () => {
    const { output_tokens: _dropped, ...usage } = USAGE;

    expect(mapClaudeCodeTranscriptToSinkRecords(withUsage(usage))).toStrictEqual([]);
  });

  it("yields no record when a counter is a string rather than a number", () => {
    const content = withUsage({ ...USAGE, input_tokens: "10" });

    expect(mapClaudeCodeTranscriptToSinkRecords(content)).toStrictEqual([]);
  });
});

describe("a billed line names its session and is an assistant turn", () => {
  it("yields no record when sessionId is absent", () => {
    const content = chain([assistantLine({ sessionId: undefined })]);

    expect(mapClaudeCodeTranscriptToSinkRecords(content)).toStrictEqual([]);
  });

  it("yields no record when sessionId is not a string", () => {
    const content = chain([assistantLine({ sessionId: 123 })]);

    expect(mapClaudeCodeTranscriptToSinkRecords(content)).toStrictEqual([]);
  });

  it("yields no record for a user line, even one carrying counters", () => {
    const content = chain([assistantLine({ type: "user" })]);

    expect(mapClaudeCodeTranscriptToSinkRecords(content)).toStrictEqual([]);
  });
});

describe("the record carries exactly the keys the line states", () => {
  it("holds identity and counters alone when the line names no request, model, effort or moment", () => {
    const content = chain([assistantLine()]);

    expect(mapClaudeCodeTranscriptToSinkRecords(content)).toStrictEqual([BARE_RECORD]);
  });

  it("names the agent only when the line is a sidechain", () => {
    const content = chain([assistantLine({ attributionAgent: "Explore" })]);

    expect(mapClaudeCodeTranscriptToSinkRecords(content)).toStrictEqual([BARE_RECORD]);
  });

  it("names the plugin beside the skill the line attributes", () => {
    const content = chain([
      assistantLine({ attributionSkill: "aidd-dev:01-plan", attributionPlugin: "aidd-dev" }),
    ]);

    expect(mapClaudeCodeTranscriptToSinkRecords(content)).toStrictEqual([
      { ...BARE_RECORD, step: "aidd-dev:01-plan", step_plugin: "aidd-dev" },
    ]);
  });

  it("names no plugin when the line attributes a plugin but no skill", () => {
    const content = chain([assistantLine({ attributionPlugin: "aidd-dev" })]);

    expect(mapClaudeCodeTranscriptToSinkRecords(content)).toStrictEqual([BARE_RECORD]);
  });

  it("carries the prompt id with no prompt_skill key when the prompt invoked no skill", () => {
    const content = chain([
      { type: "user", uuid: "u1", promptId: "p-abc" },
      assistantLine({ uuid: "a1", parentUuid: "u1" }),
    ]);

    expect(mapClaudeCodeTranscriptToSinkRecords(content)).toStrictEqual([
      { ...BARE_RECORD, prompt_id: "p-abc" },
    ]);
  });
});

describe("reading the Skill call that names a prompt's step", () => {
  it("passes over a Skill call that carries no input and reads the next one", () => {
    const records = promptedRecords([
      { type: "tool_use", name: "Skill" },
      { type: "tool_use", name: "Skill", input: { skill: "aidd-dev:02-implement" } },
    ]);

    expect(records[0]?.prompt_skill).toBe("aidd-dev:02-implement");
  });

  it("passes over a null content part rather than throwing", () => {
    const records = promptedRecords([
      null,
      { type: "tool_use", name: "Skill", input: { skill: "aidd-dev:02-implement" } },
    ]);

    expect(records[0]?.prompt_skill).toBe("aidd-dev:02-implement");
  });

  it("ignores a part named Skill whose type is not tool_use", () => {
    const records = promptedRecords([
      { type: "text", name: "Skill", input: { skill: "aidd-dev:01-plan" } },
    ]);

    expect(records).toStrictEqual([{ ...BARE_RECORD, prompt_id: "p-abc" }]);
  });
});

describe("two lines restating one call", () => {
  it("collapse on message.id even when neither carries a requestId", () => {
    const content = chain([
      assistantLine({ message: { id: "msg_1", usage: { ...USAGE, output_tokens: 1 } } }),
      assistantLine({ message: { id: "msg_1", usage: { ...USAGE, output_tokens: 9 } } }),
    ]);

    expect(mapClaudeCodeTranscriptToSinkRecords(content)).toStrictEqual([
      { ...BARE_RECORD, output_tokens: 9 },
    ]);
  });

  it("collapse on their text, whitespace aside, when neither carries any id", () => {
    const line = JSON.stringify(assistantLine({ message: { usage: USAGE } }));

    expect(mapClaudeCodeTranscriptToSinkRecords(`${line}\n  ${line}  \n`)).toStrictEqual([
      BARE_RECORD,
    ]);
  });
});
