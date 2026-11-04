import { parse } from "smol-toml";
import { describe, expect, it } from "vitest";
import {
  mergeCodexExporters,
  mergeJsonEnvironment,
  mergeOpenCodeInstrumentation,
  openCodeInstrumentation,
  rejectConflict,
} from "../../../../src/contexts/telemetry/infrastructure/otel/config-edits.js";

const endpoint = "http://127.0.0.1:14318/codex/v1/logs";
const token = "test-token";
const exporters = { exporter: endpoint };
const defaults = { environment: "local", log_user_prompt: true };
const toolResult = { max_bytes: 262144 };
const mergeCodex = (content: string) =>
  mergeCodexExporters(content, exporters, token, defaults, toolResult);

describe("merging Claude and OpenCode settings", () => {
  it("adds the environment without losing unrelated settings or overriding the user's defaults", () => {
    const original = '{"model":"m1","env":{"USER":"keep","DETAILS":"0"}}';
    const merged = mergeJsonEnvironment(original, { OTEL_ENDPOINT: "local" }, () => {}, {
      DETAILS: "1",
    });
    expect(JSON.parse(merged)).toEqual({
      model: "m1",
      env: { USER: "keep", DETAILS: "0", OTEL_ENDPOINT: "local" },
    });
    expect(
      mergeJsonEnvironment(merged, { OTEL_ENDPOINT: "local" }, () => {}, { DETAILS: "1" })
    ).toBe(merged);
  });

  it("creates the missing section and rejects conflicting or duplicate environment keys", () => {
    expect(
      JSON.parse(mergeJsonEnvironment('{"model":"m1"}', { OTEL_ENDPOINT: "local" }, () => {}))
    ).toEqual({ model: "m1", env: { OTEL_ENDPOINT: "local" } });
    for (const invalid of [
      '{"env":{"OTEL_ENDPOINT":"remote"}}',
      '{"env":{},"env":{}}',
      '{"env":{"USER":"one","USER":"two"}}',
      '{"env":[]}',
      '{"env":',
    ]) {
      expect(() => mergeJsonEnvironment(invalid, { OTEL_ENDPOINT: "local" }, () => {})).toThrow();
    }
    expect(() => rejectConflict("endpoint", "remote", "local")).toThrow(/endpoint/);
  });

  it("preserves JSONC comments, quoted punctuation and trailing commas in OpenCode settings", () => {
    const original = `{
      // keep punctuation in values
      "model": "provider/model//name",
      "experimental": {"note": "literal /* text */ and comma,}", /* keep */},
    }`;
    const merged = mergeOpenCodeInstrumentation(original, true);
    expect(merged).toContain("// keep punctuation in values");
    expect(merged).toContain('"provider/model//name"');
    expect(merged).toContain('"literal /* text */ and comma,}"');
    expect(merged).toContain("/* keep */");
    expect(openCodeInstrumentation(merged)).toBe(true);
    expect(mergeOpenCodeInstrumentation(merged, true)).toBe(merged);
    expect(openCodeInstrumentation('{"other":true}')).toBeUndefined();
  });

  it("keeps escaped quotes and comment-like strings when inserting into JSONC", () => {
    const original =
      '{\n  "description": "line // not a comment",\n  "experimental": {\n    "labels": ["comma,}", "quoted \\"value\\"",], // real comment\n  },\n}';
    const merged = mergeOpenCodeInstrumentation(original, true);
    expect(merged).toContain('"line // not a comment"');
    expect(merged).toContain('"quoted \\"value\\""');
    expect(merged).toContain("// real comment");
    expect(openCodeInstrumentation(merged)).toBe(true);
  });

  it("refuses disabled, duplicate, malformed or non-object OpenCode settings", () => {
    for (const invalid of [
      '{"experimental":{"openTelemetry":false}}',
      '{"experimental":{},"experimental":{}}',
      '{"experimental":{"x":1,"x":2}}',
      '{"experimental":[]}',
      '{"experimental":',
    ]) {
      expect(() => mergeOpenCodeInstrumentation(invalid, true)).toThrow();
    }
  });
});

describe("merging Codex TOML exporters", () => {
  it("adds missing exporters and defaults without changing existing options or comments", () => {
    const original =
      '# Keep this comment\nmodel = "m1"\n[otel]\nlog_user_prompt = false\n[otel.tool_result]\nmax_bytes = 1234\n';
    const merged = mergeCodex(original);
    const parsed = parse(merged);
    expect(parsed).toMatchObject({
      model: "m1",
      otel: {
        environment: "local",
        log_user_prompt: false,
        tool_result: { max_bytes: 1234 },
        exporter: {
          "otlp-http": {
            endpoint,
            protocol: "json",
            headers: { authorization: "Bearer test-token" },
          },
        },
      },
    });
    expect(merged).toContain("# Keep this comment");
    expect(mergeCodex(merged)).toBe(merged);
  });

  it("preserves already configured exporter headers and adds only missing values", () => {
    const original = `[otel.exporter.otlp-http]\nendpoint = "${endpoint}"\nheaders = { Authorization = "Bearer test-token", other = "keep" }\n`;
    const merged = mergeCodex(original);
    expect(parse(merged)).toMatchObject({
      otel: {
        exporter: {
          "otlp-http": {
            endpoint,
            protocol: "json",
            headers: { Authorization: "Bearer test-token", other: "keep" },
          },
        },
      },
    });
    expect(mergeCodex(merged)).toBe(merged);
  });

  it.each([
    '[ "otel" ] # keep\nvalue = true\n',
    "['otel']\nvalue = true\n",
    "[otel] # keep",
    "[otel]\r\nvalue = true\r\n",
    "[otel]\nvalue = true",
  ])("preserves valid existing table syntax %j", (original) => {
    const merged = mergeCodex(original);
    const parsed = parse(merged);
    expect(parsed.otel).toMatchObject({ environment: "local", log_user_prompt: true });
    if (original.includes("value")) expect(parsed.otel).toMatchObject({ value: true });
    if (original.includes("# keep")) expect(merged).toContain("# keep");
    expect(mergeCodex(merged)).toBe(merged);
  });

  it.each([
    '[otel.exporter.otlp-http]\nendpoint = "https://other.example"\n',
    `[otel.exporter.otlp-http]\nendpoint = "${endpoint}"\nprotocol = "grpc"\n`,
    '[otel.exporter.otlp-grpc]\nendpoint = "https://other.example"\n',
    `[otel.exporter.otlp-http]\nendpoint = "${endpoint}"\nheaders = { authorization = "Bearer other" }\n`,
    `[otel.exporter.otlp-http]\nendpoint = "${endpoint}"\nheaders = { authorization = "Bearer test-token", Authorization = "Bearer test-token" }\n`,
    "[otel\n",
  ])("refuses an incompatible or invalid existing exporter", (original) => {
    expect(() => mergeCodex(original)).toThrow();
  });
});
