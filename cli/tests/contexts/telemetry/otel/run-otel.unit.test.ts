import { appendFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import {
  openCodePluginLogs,
  relatedOpenCodeLogs,
} from "../../../../src/contexts/telemetry/infrastructure/otel/actions/opencode-plugin-logs.js";
import {
  completeCaptureEnd,
  openCodePromptSpans,
} from "../../../../src/contexts/telemetry/infrastructure/otel/actions/run.js";

const text = (key: string, stringValue: string) => ({ key, value: { stringValue } });

function capture(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    signal: "traces",
    payload: {
      resourceSpans: [
        {
          resource: {
            attributes: [
              text("service.name", "opencode"),
              text("service.version", "2.2.5"),
              text("host.name", "private-host"),
            ],
          },
          scopeSpans: [
            {
              spans: [
                {
                  traceId: "00000000000000000000000000000001",
                  spanId: "0000000000000002",
                  name: "POST",
                  kind: 2,
                  startTimeUnixNano: "1700000000000000000",
                  endTimeUnixNano: "1700000000000000001",
                  attributes: [
                    text("http.route", "/api/session/:sessionID/prompt"),
                    text("url.path", "/api/session/ses_probe/prompt"),
                    text("http.request.method", "POST"),
                    { key: "http.response.status_code", value: { intValue: "200" } },
                    text("url.full", "http://localhost/private?secret=value"),
                  ],
                  ...overrides,
                },
              ],
            },
          ],
        },
      ],
    },
  });
}

it("forwards only allowlisted OpenCode prompt span data", () => {
  const output = openCodePromptSpans(capture());
  expect(output).toHaveLength(1);
  expect(JSON.stringify(output)).toContain('"url.path"');
  expect(JSON.stringify(output)).toContain('"spanId":"0000000000000002"');
  expect(JSON.stringify(output)).not.toMatch(/url.full|host.name|secret/);
});

it("only keeps child sessions linked by an unambiguous explicit parent", () => {
  const logs = [
    { session: "ses_root", payload: "root" },
    { session: "ses_child", parent: "ses_root", payload: "child" },
    { session: "ses_grandchild", parent: "ses_child", payload: "grandchild" },
    { session: "ses_unknown", payload: "unrelated" },
    { session: "ses_conflict", parent: "ses_root", payload: "conflict one" },
    { session: "ses_conflict", parent: "ses_unknown", payload: "conflict two" },
  ];
  expect(relatedOpenCodeLogs("ses_root", logs).map((item) => item.payload)).toEqual([
    "root",
    "child",
    "grandchild",
  ]);
});

it("rejects client spans and invalid timestamps", () => {
  expect(openCodePromptSpans(capture({ kind: 3 }))).toEqual([]);
  expect(openCodePromptSpans(capture({ startTimeUnixNano: "1700000000000000002" }))).toEqual([]);
});

it("forwards only allowlisted plugin observations and never turns an ambiguous zero into usage", () => {
  const value = (key: string, intValue: string) => ({ key, value: { intValue } });
  const attributes = [
    text("event.name", "session.step.ended"),
    text("event.id", "evt_probe"),
    text("session.id", "ses_probe"),
    text("assistant.message.id", "msg_probe"),
    value("opencode.event.sequence", "12"),
    value("opencode.event.version", "1"),
    value("opencode.usage.input", "15"),
    value("opencode.usage.cache_read", "0"),
    text("prompt", "private-prompt"),
  ];
  const scope = {
    scope: { name: "aidd.opencode.otel", version: "1" },
    logRecords: [
      {
        timeUnixNano: "1700000000000000000",
        body: { stringValue: "private-response" },
        attributes,
      },
    ],
  };
  const capture = JSON.stringify({
    signal: "logs",
    payload: {
      resourceLogs: [
        {
          resource: {
            attributes: [text("service.name", "opencode"), text("host.name", "private-host")],
          },
          scopeLogs: [scope],
        },
      ],
    },
  });
  const output = openCodePluginLogs(capture);
  expect(output).toHaveLength(1);
  expect(output[0].session).toBe("ses_probe");
  expect(JSON.stringify(output)).toContain('"intValue":"15"');
  expect(JSON.stringify(output)).not.toMatch(/private|prompt|cache_read/);
  scope.scope.version = "2";
  expect(
    openCodePluginLogs(
      JSON.stringify({
        signal: "logs",
        payload: {
          resourceLogs: [
            {
              resource: { attributes: [text("service.name", "opencode")] },
              scopeLogs: [scope],
            },
          ],
        },
      })
    )
  ).toEqual([]);
});

it("only advances the capture boundary after a complete JSONL record", async () => {
  const directory = await mkdtemp(join(tmpdir(), "aidd-otel-boundary-"));
  const file = join(directory, "capture.jsonl");
  try {
    const first = '{"value":"é"}\n';
    await writeFile(file, `${first}{"value":`);
    const firstEnd = Buffer.byteLength(first);
    expect(await completeCaptureEnd(file, 0)).toBe(firstEnd);
    expect(await completeCaptureEnd(file, firstEnd)).toBe(firstEnd);
    await appendFile(file, '"complete"}\n');
    expect(await completeCaptureEnd(file, firstEnd)).toBe(
      firstEnd + Buffer.byteLength('{"value":"complete"}\n')
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
