import { expect, test } from "vitest";
import { selectTransfers } from "../../../../src/contexts/telemetry/infrastructure/otel/actions/sync.js";

const attr = (key: string, value: string) => ({ key, value: { stringValue: value } });
const options = {
  config: "claude" as const,
  session: "session",
  tenant: "tenant",
  endpoint: "http://127.0.0.1:3011",
  token: "test",
  home: "/tmp",
  follow: false,
};

function metricCapture(querySource?: string): string {
  return JSON.stringify({
    signal: "metrics",
    payload: {
      resourceMetrics: [
        {
          scopeMetrics: [
            {
              metrics: [
                {
                  name: "claude_code.token.usage",
                  sum: {
                    aggregationTemporality: 1,
                    dataPoints: [
                      {
                        startTimeUnixNano: "1784505600000000000",
                        timeUnixNano: "1784548800000000000",
                        asInt: "5",
                        attributes: [
                          attr("session.id", "session"),
                          attr("type", "input"),
                          ...(querySource === undefined ? [] : [attr("query_source", querySource)]),
                        ],
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  });
}

function requestCapture(querySource: string): string {
  return JSON.stringify({
    signal: "logs",
    payload: {
      resourceLogs: [
        {
          scopeLogs: [
            {
              logRecords: [
                {
                  attributes: [
                    attr("session.id", "session"),
                    attr("event.name", "api_request"),
                    attr("query_source", querySource),
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  });
}

function attributesOf(source: string): Record<string, string> {
  const transfers = selectTransfers(source, options);
  const payload = transfers[0]?.payload as {
    resourceMetrics?: {
      scopeMetrics: {
        metrics: {
          sum: { dataPoints: { attributes: { key: string; value: { stringValue: string } }[] }[] };
        }[];
      }[];
    }[];
    resourceLogs?: {
      scopeLogs: {
        logRecords: { attributes: { key: string; value: { stringValue: string } }[] }[];
      }[];
    }[];
  };
  const metric = payload.resourceMetrics?.[0]?.scopeMetrics?.[0]?.metrics?.[0];
  const log = payload.resourceLogs?.[0]?.scopeLogs?.[0]?.logRecords?.[0];
  const attributes = metric?.sum.dataPoints[0].attributes ?? log?.attributes ?? [];
  return Object.fromEntries(attributes.map(({ key, value }) => [key, value.stringValue]));
}

test.each(["main", "subagent", "auxiliary", "plugin_model_complete", "plugin_model_classify"])(
  "forwards documented Claude token query_source %s",
  (querySource) => {
    expect(attributesOf(metricCapture(querySource)).query_source).toBe(querySource);
  }
);

test.each([undefined, "custom private agent"])(
  "omits absent or unknown Claude token query_source (%s)",
  (querySource) => {
    const attributes = attributesOf(metricCapture(querySource));
    expect(attributes).not.toHaveProperty("query_source");
  }
);

test("omits Claude api_request query_source names", () => {
  expect(attributesOf(requestCapture("private-agent-name"))).not.toHaveProperty("query_source");
});

test("keeps Codex query_source transfer unchanged", () => {
  const source = JSON.stringify({
    signal: "logs",
    payload: {
      resourceLogs: [
        {
          scopeLogs: [
            {
              logRecords: [
                {
                  attributes: [
                    attr("conversation.id", "session"),
                    attr("event.name", "codex.sse_event"),
                    attr("event.kind", "response.completed"),
                    attr("query_source", "custom source"),
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  });
  const transfers = selectTransfers(source, { ...options, config: "codex" });
  const payload = transfers[0]?.payload as {
    resourceLogs: {
      scopeLogs: {
        logRecords: { attributes: { key: string; value: { stringValue: string } }[] }[];
      }[];
    }[];
  };
  const attributes = payload.resourceLogs[0].scopeLogs[0].logRecords[0].attributes;
  expect(attributes.find(({ key }) => key === "query_source")?.value.stringValue).toBe(
    "custom source"
  );
});
