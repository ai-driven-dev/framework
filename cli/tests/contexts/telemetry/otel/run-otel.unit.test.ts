import { expect, it } from "vitest";
import { openCodePromptSpans } from "../../../../src/contexts/telemetry/infrastructure/otel/actions/run.js";

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

it("rejects client spans and invalid timestamps", () => {
  expect(openCodePromptSpans(capture({ kind: 3 }))).toEqual([]);
  expect(openCodePromptSpans(capture({ startTimeUnixNano: "1700000000000000002" }))).toEqual([]);
});
