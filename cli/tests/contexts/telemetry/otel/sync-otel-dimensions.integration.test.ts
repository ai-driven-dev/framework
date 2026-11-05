import { expect, test } from "vitest";
import { seriesFingerprint } from "../../../../src/contexts/telemetry/infrastructure/otel/actions/series-fingerprint.js";
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

function capture(dimension: string, reverse = false, unit = "token"): string {
  const dimensions = [
    attr("session.id", "session"),
    attr("type", "input"),
    attr("agent.name", dimension),
  ];
  if (reverse) dimensions.reverse();
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
                  unit,
                  sum: {
                    aggregationTemporality: 1,
                    dataPoints: [
                      {
                        startTimeUnixNano: "1784505600000000000",
                        timeUnixNano: "1784548800000000000",
                        asInt: "5",
                        attributes: dimensions,
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

function fingerprint(source: string): string {
  const transfers = selectTransfers(source, options, { values: new Map(), conflict: false });
  const body = JSON.stringify(transfers[0]?.payload);
  expect(body).not.toContain("private-agent");
  return (
    body.match(/"key":"aidd.series_fingerprint","value":\{"stringValue":"([0-9a-f]{64})"\}/)?.[1] ??
    ""
  );
}

test("keeps distinct Claude metric dimensions distinguishable without exposing their values", () => {
  const first = fingerprint(capture("private-agent-one"));
  const second = fingerprint(capture("private-agent-two"));
  expect(first).toHaveLength(64);
  expect(second).toHaveLength(64);
  expect(first).not.toBe(second);
  expect(fingerprint(capture("private-agent-one", true))).toBe(first);
  expect(fingerprint(capture("private-agent-one", false, "byte"))).not.toBe(first);
});

test("normalizes scope attribute order and distinguishes schemas", () => {
  const resource = { resource: { attributes: [attr("service", "app")] }, schemaUrl: "schema-a" };
  const attributes = [attr("one", "1"), attr("two", "2")];
  const scope = { scope: { name: "scope", attributes }, schemaUrl: "scope-a" };
  const reordered = { ...scope, scope: { ...scope.scope, attributes: [...attributes].reverse() } };
  expect(seriesFingerprint(resource, scope, [])).toBe(seriesFingerprint(resource, reordered, []));
  expect(seriesFingerprint(resource, scope, [])).not.toBe(
    seriesFingerprint({ ...resource, schemaUrl: "schema-b" }, scope, [])
  );
  expect(seriesFingerprint(resource, { ...scope, metric: { unit: "token" } }, [])).not.toBe(
    seriesFingerprint(resource, { ...scope, metric: { unit: "byte" } }, [])
  );
});

test("normalizes equivalent integer attribute encodings", () => {
  const numeric = [{ key: "attempt", value: { intValue: 5 } }];
  const decimal = [{ key: "attempt", value: { intValue: "5" } }];
  expect(seriesFingerprint({}, {}, numeric)).toBe(seriesFingerprint({}, {}, decimal));
});
