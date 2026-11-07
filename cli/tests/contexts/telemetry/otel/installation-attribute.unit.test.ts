import { describe, expect, it } from "vitest";
import {
  attachInstallationId,
  checkInstallationClaim,
} from "../../../../src/contexts/telemetry/infrastructure/otel/actions/installation-attribute.js";
import { selectTransfers } from "../../../../src/contexts/telemetry/infrastructure/otel/actions/sync.js";

const id = "6ba7b810-9dad-41d1-80b4-00c04fd430c8";
const attr = (key: string, value: string) => ({ key, value: { stringValue: value } });
const options = {
  config: "codex" as const,
  session: "session",
  tenant: "tenant",
  endpoint: "http://127.0.0.1:3000",
  token: "test",
  home: "/tmp",
  follow: false,
};
const codex = (extra: unknown[] = []) =>
  JSON.stringify({
    signal: "logs",
    payload: {
      resourceLogs: [
        {
          resource: { attributes: [attr("conversation.id", "session"), ...extra] },
          scopeLogs: [
            { logRecords: [{ attributes: [attr("event.name", "codex.conversation_starts")] }] },
          ],
        },
      ],
    },
  });

describe("installation ID opt-in", () => {
  it("adds the ID to selected Codex resources only when requested", () => {
    expect(JSON.stringify(selectTransfers(codex(), options))).not.toContain("aidd.installation.id");
    const output = selectTransfers(codex(), { ...options, installationId: id });
    expect(output).toHaveLength(1);
    expect(JSON.stringify(output)).toContain(JSON.stringify(attr("aidd.installation.id", id)));
  });
  it("refuses a conflicting provider claim", () => {
    expect(() =>
      selectTransfers(codex([attr("aidd.installation.id", "wrong")]), {
        ...options,
        installationId: id,
      })
    ).toThrow("Conflicting OTLP installation ID");
    expect(() =>
      checkInstallationClaim(
        { resourceLogs: [{ attributes: [attr("aidd.installation.id", "wrong")] }] },
        id
      )
    ).toThrow();
  });
  it.each(["logs", "metrics"] as const)("adds the ID to Claude %s resources", (signal) => {
    const resource = { attributes: [attr("session.id", "session")] };
    const payload =
      signal === "logs"
        ? {
            resourceLogs: [
              {
                resource,
                scopeLogs: [{ logRecords: [{ attributes: [attr("event.name", "tool_result")] }] }],
              },
            ],
          }
        : {
            resourceMetrics: [
              {
                resource,
                scopeMetrics: [
                  {
                    metrics: [
                      {
                        name: "claude_code.token.usage",
                        sum: { dataPoints: [{ asInt: "7", attributes: [attr("type", "input")] }] },
                      },
                    ],
                  },
                ],
              },
            ],
          };
    const output = selectTransfers(JSON.stringify({ signal, payload }), {
      ...options,
      config: "claude",
      installationId: id,
    });
    expect(output).toHaveLength(1);
    expect(JSON.stringify(output)).toContain(JSON.stringify(attr("aidd.installation.id", id)));
  });
  it.each(["resourceLogs", "resourceMetrics", "resourceSpans"] as const)(
    "labels %s without overwriting other attributes",
    (field) => {
      const result = attachInstallationId(
        { [field]: [{ resource: { attributes: [attr("service.name", "opencode")] } }] },
        field,
        id
      );
      expect(JSON.stringify(result)).toContain(JSON.stringify(attr("service.name", "opencode")));
      expect(JSON.stringify(result)).toContain(JSON.stringify(attr("aidd.installation.id", id)));
    }
  );
});
