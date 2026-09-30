import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { mapOpencodeExportToSinkRecords } from "../../../../../src/contexts/telemetry/domain/formats/opencode-export.js";

const SESSION_ID = "ses_test_read";

// A real `opencode export --sanitize` capture (opencode 1.14.20), mechanically trimmed to
// `{info, messages: [{info}, ...]}`. No value inside `info` was hand-edited.
function loadFixture(name: string): unknown {
  const url = new URL(`../../../../fixtures/telemetry-sink/${name}`, import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), "utf8"));
}

describe("mapOpencodeExportToSinkRecords", () => {
  // Measured on a non-Anthropic capture: `input` falls from 28242 to 269 as `cache.read`
  // climbs to 28928, and `total` only adds up if the counters are disjoint.
  it("reads a non-Anthropic provider's counters as disjoint, the comparison no capture held", () => {
    const records = mapOpencodeExportToSinkRecords(
      loadFixture("opencode-export-non-anthropic-cache.json"),
      "ses_test_non_anthropic"
    );

    expect(
      records.map((record) => ({
        input: record.input_tokens,
        output: record.output_tokens,
        cacheRead: record.cache_read_tokens,
        cacheCreation: record.cache_creation_tokens,
      }))
    ).toEqual([
      { input: 28242, output: 193, cacheRead: 640, cacheCreation: 0 },
      { input: 269, output: 137, cacheRead: 28928, cacheCreation: 0 },
      { input: 196, output: 56, cacheRead: 29184, cacheCreation: 0 },
    ]);
    expect(records.every((record) => record.model === "ling-3.0-flash-fin-free")).toBe(true);
  });

  it("yields one record per billed message, by value, under the stored field names", () => {
    const records = mapOpencodeExportToSinkRecords(loadFixture("opencode-export.json"), SESSION_ID);

    // The fixture holds 5 user turns, 3 billed assistant turns, and 1 assistant turn
    // OpenCode created but never billed — only the billed ones are counted messages.
    expect(records).toHaveLength(3);
    expect(records).toEqual([
      {
        kind: "request",
        vendor_id: SESSION_ID,
        vendor_field: "sessionID",
        turn_id: "msg_cf515b1b20011NzmARPrSpI1lW",
        turn_field: "id",
        model: "claude-sonnet-4-6",
        event_timestamp: "2026-03-16T05:19:25.618Z",
        input_tokens: 3,
        output_tokens: 115,
        cache_read_tokens: 43639,
        cache_creation_tokens: 3141,
      },
      {
        kind: "request",
        vendor_id: SESSION_ID,
        vendor_field: "sessionID",
        turn_id: "msg_cf515c482001XcMRpKRNVBj0v9",
        turn_field: "id",
        model: "claude-sonnet-4-6",
        event_timestamp: "2026-03-16T05:19:30.434Z",
        input_tokens: 1,
        output_tokens: 238,
        cache_read_tokens: 46780,
        cache_creation_tokens: 176,
      },
      {
        kind: "request",
        vendor_id: SESSION_ID,
        vendor_field: "sessionID",
        turn_id: "msg_cf515d659001v8AyNXNm4y69T8",
        turn_field: "id",
        model: "claude-sonnet-4-6",
        event_timestamp: "2026-03-16T05:19:35.001Z",
        input_tokens: 1,
        output_tokens: 161,
        cache_read_tokens: 46956,
        cache_creation_tokens: 4074,
      },
    ]);
  });

  it("yields no record for a message OpenCode created but never billed — no total, even though tokens is present and every counter reads 0", () => {
    const payload = {
      messages: [
        {
          info: {
            role: "assistant",
            id: "msg_aborted",
            sessionID: SESSION_ID,
            time: { created: 1773638379047 },
            tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          },
        },
      ],
    };

    expect(mapOpencodeExportToSinkRecords(payload, SESSION_ID)).toEqual([]);
  });

  it("keeps the record for a billed message that genuinely used 0 tokens — total is present, even at 0", () => {
    const payload = {
      messages: [
        {
          info: {
            role: "assistant",
            id: "msg_zero_billed",
            sessionID: SESSION_ID,
            time: { created: 1773638379047 },
            tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          },
        },
      ],
    };

    expect(mapOpencodeExportToSinkRecords(payload, SESSION_ID)).toEqual([
      {
        kind: "request",
        vendor_id: SESSION_ID,
        vendor_field: "sessionID",
        turn_id: "msg_zero_billed",
        turn_field: "id",
        event_timestamp: "2026-03-16T05:19:39.047Z",
        input_tokens: 0,
        output_tokens: 0,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
      },
    ]);
  });

  it("sets vendor_id from the sessionId argument, never from the payload's own id", () => {
    const records = mapOpencodeExportToSinkRecords(loadFixture("opencode-export.json"), "s-other");

    expect(records.every((r) => r.vendor_id === "s-other")).toBe(true);
  });

  it("never reads info.cost — it is 0 with no established denomination", () => {
    const records = mapOpencodeExportToSinkRecords(loadFixture("opencode-export.json"), SESSION_ID);

    for (const record of records) {
      expect(record.cost_usd).toBeUndefined();
    }
  });

  it("yields no record for a message with no counters, never an invented zero", () => {
    const payload = { messages: [{ info: { role: "user", id: "msg_1" } }] };

    expect(mapOpencodeExportToSinkRecords(payload, SESSION_ID)).toEqual([]);
  });

  it("returns nothing for an empty or malformed payload rather than throwing", () => {
    expect(mapOpencodeExportToSinkRecords({}, SESSION_ID)).toEqual([]);
    expect(mapOpencodeExportToSinkRecords(null, SESSION_ID)).toEqual([]);
    expect(mapOpencodeExportToSinkRecords({ messages: [] }, SESSION_ID)).toEqual([]);
  });

  it("skips a null message entry rather than throwing", () => {
    expect(mapOpencodeExportToSinkRecords({ messages: [null] }, SESSION_ID)).toEqual([]);
  });
});

const BARE_MESSAGE = {
  kind: "request",
  vendor_id: SESSION_ID,
  vendor_field: "sessionID",
  turn_id: "msg_1",
  turn_field: "id",
};

function recordsOf(info: Record<string, unknown>) {
  return mapOpencodeExportToSinkRecords(
    { messages: [{ info: { id: "msg_1", ...info } }] },
    SESSION_ID
  );
}

describe("the record carries exactly the keys the message states", () => {
  it("holds identity alone when a billed message states no counter, model or time", () => {
    expect(recordsOf({ tokens: { total: 5 } })).toStrictEqual([BARE_MESSAGE]);
  });

  it("reads a message whose tokens carry no cache block, without throwing", () => {
    expect(recordsOf({ tokens: { total: 5, input: 3, output: 2 } })).toStrictEqual([
      { ...BARE_MESSAGE, input_tokens: 3, output_tokens: 2 },
    ]);
  });

  it("leaves a counter unset rather than storing a string figure", () => {
    expect(recordsOf({ tokens: { total: 5, input: "3", output: 2 } })).toStrictEqual([
      { ...BARE_MESSAGE, output_tokens: 2 },
    ]);
  });

  it("names no model and no turn when neither is a string", () => {
    const records = mapOpencodeExportToSinkRecords(
      { messages: [{ info: { id: 42, modelID: 42, tokens: { total: 5 } } }] },
      SESSION_ID
    );

    expect(records).toStrictEqual([
      { kind: "request", vendor_id: SESSION_ID, vendor_field: "sessionID" },
    ]);
  });

  it.each([0, -1])("carries no moment for a creation time of %s", (created) => {
    expect(recordsOf({ tokens: { total: 5 }, time: { created } })).toStrictEqual([BARE_MESSAGE]);
  });
});
