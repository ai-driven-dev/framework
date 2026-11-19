import { describe, expect, it } from "vitest";
import { selectTransfers } from "../../../../src/contexts/telemetry/infrastructure/otel/actions/sync.js";

const attr = (key: string, value: string) => ({ key, value: { stringValue: value } });
const options = {
  config: "claude" as const,
  session: "session",
  tenant: "tenant",
  endpoint: "http://127.0.0.1:3000",
  token: "test",
  home: "/tmp",
  follow: false,
};
const payload = (signal: "logs" | "metrics", url: string, conflictingUrl?: string) =>
  JSON.stringify({
    signal,
    payload:
      signal === "logs"
        ? {
            resourceLogs: [
              {
                resource: {
                  attributes: [attr("session.id", "session"), attr("vcs.repository.url.full", url)],
                },
                scopeLogs: [
                  {
                    logRecords: [
                      {
                        timeUnixNano: "1793763900000000000",
                        attributes: [
                          attr("event.name", "tool_result"),
                          ...(conflictingUrl
                            ? [attr("vcs.repository.url.full", conflictingUrl)]
                            : []),
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          }
        : {
            resourceMetrics: [
              {
                resource: {
                  attributes: [attr("session.id", "session"), attr("vcs.repository.url.full", url)],
                },
                scopeMetrics: [
                  {
                    metrics: [
                      {
                        name: "claude_code.token.usage",
                        sum: {
                          dataPoints: [
                            {
                              timeUnixNano: "1793763900000000000",
                              asInt: "42",
                              attributes: [
                                attr("type", "input"),
                                ...(conflictingUrl
                                  ? [attr("vcs.repository.url.full", conflictingUrl)]
                                  : []),
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

describe("optional OTLP repository", () => {
  it.each(["logs", "metrics"] as const)("forwards a safe repository in %s", (signal) => {
    const transfers = selectTransfers(payload(signal, "https://github.com/org/repo"), options);
    expect(transfers).toHaveLength(1);
    expect(JSON.stringify(transfers)).toContain("https://github.com/org/repo");
  });
  it.each([
    "https://user:secret@github.com/org/repo",
    "https://github.com/org/repo?token=secret",
    "https://github.com/org/repo#secret",
    "https://evil.example/org/repo",
  ])("does not forward unsafe URL %s", (url) => {
    for (const signal of ["logs", "metrics"] as const) {
      const transfers = selectTransfers(payload(signal, url), options);
      expect(transfers).toHaveLength(1);
      expect(JSON.stringify(transfers)).not.toContain("vcs.repository.url.full");
      expect(JSON.stringify(transfers)).not.toContain("secret");
    }
  });
  it.each(["logs", "metrics"] as const)(
    "rejects conflicting repository attributes in %s",
    (signal) => {
      expect(() =>
        selectTransfers(
          payload(signal, "https://github.com/org/one", "https://github.com/org/two"),
          options
        )
      ).toThrow();
    }
  );
});
