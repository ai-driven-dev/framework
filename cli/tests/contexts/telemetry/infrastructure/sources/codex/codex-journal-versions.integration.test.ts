import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import * as zlib from "node:zlib";
import { describe, expect, it } from "vitest";
import { ReadUsage } from "../../../../../../src/contexts/telemetry/application/read-usage.js";
import { CodexTranscriptSourceAdapter } from "../../../../../../src/contexts/telemetry/infrastructure/sources/codex/codex-transcript-source-adapter.js";

const SESSIONS = resolve(import.meta.dirname, "../../../../../fixtures/codex-usage/sessions");
const NO_ZSTD = typeof zlib.createZstdDecompress !== "function";

const read = (roots: string[]) =>
  new ReadUsage(new CodexTranscriptSourceAdapter(roots)).execute({ since: new Map() });

/** Each fixture stands for a group of versions: one starts where a version introduces a line type
 * or a usage payload key (`fixtures/codex-usage/README.md`). A group with no `token_usage_record`
 * holds no call the decoder counts, and that is pinned as observed. */
const COMPRESSED = "0.149.0-alpha.4.1";
const GROUPS = [
  ["0.124.0", "", 0, 0, 0, 0, 0],
  ["0.136.0", "", 0, 0, 0, 0, 0],
  ["0.142.5", "", 0, 0, 0, 0, 0],
  ["0.143.0", "", 0, 0, 0, 0, 0],
  ["0.144.0-alpha.4", "", 0, 0, 0, 0, 0],
  [COMPRESSED, "gpt-5.6-sol", 2, 85416, 2322, 76928, 0],
  ["0.149.0-alpha.4.3", "gpt-5.6-sol", 2, 78725, 492, 77568, 0],
  ["0.154.0-alpha.6.2", "", 0, 0, 0, 0, 0],
  ["0.166.0", "gpt-6.1-sol", 2, 23898, 190, 33536, 0],
] as const;

/** Every line type the fixtures hold, as `type` or `type:payload.type`. A journal line of a type
 * not listed here is one nobody classified: add it here, and to the group that introduces it. */
const KNOWN_LINE_TYPES = [
  "compacted",
  "event_msg:item_completed",
  "event_msg:task_complete",
  "event_msg:task_started",
  "event_msg:thread_goal_updated",
  "event_msg:thread_settings_applied",
  "event_msg:token_count",
  "event_msg:turn_aborted",
  "inter_agent_communication_metadata",
  "realtime_item:realtime_session_closed",
  "realtime_item:realtime_session_started",
  "response_item:additional_tools",
  "response_item:agent_message",
  "response_item:configuration_update",
  "response_item:custom_tool_call",
  "response_item:custom_tool_call_output",
  "response_item:function_call",
  "response_item:function_call_output",
  "response_item:message",
  "response_item:reasoning",
  "response_item:tool_search_call",
  "response_item:tool_search_output",
  "response_item:web_search_call",
  "session_meta",
  "token_usage_record",
  "turn_context",
  "world_state",
];

describe("the Codex journal as each observed tool version writes it", () => {
  for (const [version, model, calls, input, output, cacheRead, cacheWrite] of GROUPS) {
    it.skipIf(NO_ZSTD && version === COMPRESSED)(
      `reads a ${version} session into ${calls} calls: input ${input}, output ${output}, cache read ${cacheRead}, cache write ${cacheWrite}`,
      async () => {
        const { records } = await read([resolve(SESSIONS, version)]);
        const total = (field: "input" | "output" | "cache_read" | "cache_write") =>
          records.reduce((sum, record) => sum + (record[field] ?? Number.NaN), 0);
        expect(records.length).toBe(calls);
        expect([
          total("input"),
          total("output"),
          total("cache_read"),
          total("cache_write"),
        ]).toEqual([input, output, cacheRead, cacheWrite]);
        // The version comes from the file's `session_meta`, the model and directory from its
        // latest `turn_context`.
        for (const record of records) {
          expect([record.tool_version, record.model]).toEqual([version, model]);
          expect(record.cwd).toMatch(/^\/workspace\/p\d+$/);
        }
      }
    );
  }

  it("leaves no line of any observed version unrecognised", async () => {
    const { unrecognised, positions } = await read([SESSIONS]);
    const compressed = [...positions.keys()].filter((path) => path.endsWith(".zst"));
    expect(positions.size).toBe(GROUPS.length);
    expect(compressed).toHaveLength(1);
    expect(unrecognised.filter((note) => !NO_ZSTD || !note.includes(".zst"))).toEqual([]);
  });

  it("holds no line type but the known ones, the compressed file included", () => {
    const types = new Set<string>();
    for (const file of readdirSync(SESSIONS, { recursive: true, encoding: "utf8" })) {
      if (!file.includes("rollout-")) continue;
      if (NO_ZSTD && file.endsWith(".zst")) continue;
      const raw = readFileSync(join(SESSIONS, file));
      const text = (file.endsWith(".zst") ? zlib.zstdDecompressSync(raw) : raw).toString();
      for (const line of text.split("\n").filter(Boolean)) {
        const { type, payload } = JSON.parse(line);
        types.add(payload?.type ? `${type}:${payload.type}` : type);
      }
    }
    const seen = [...types].sort();
    expect(seen.filter((type) => !KNOWN_LINE_TYPES.includes(type))).toEqual([]);
    if (!NO_ZSTD) expect(seen).toEqual(KNOWN_LINE_TYPES);
  });
});
