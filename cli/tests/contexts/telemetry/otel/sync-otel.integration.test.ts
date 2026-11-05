import { appendFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it as test } from "vitest";
import {
  selectTransfers,
  syncOtel,
} from "../../../../src/contexts/telemetry/infrastructure/otel/actions/sync.js";

const it = test.skipIf(process.platform === "win32");
const attr = (key: string, value: string) => ({ key, value: { stringValue: value } });
const record = (session: string, event: string) => ({
  timeUnixNano: "1793763900000000000",
  attributes: [
    attr("conversation.id", session),
    attr("user.email", "developer@example.test"),
    attr("event.name", event),
    attr("event.kind", "response.completed"),
    attr("input_token_count", "42"),
    attr("tool_use_id", "toolu_123"),
    attr("output", "sensitive output"),
  ],
});

describe("OTLP capture sync", () => {
  let server: Server | undefined;
  const dirs: string[] = [];
  afterEach(async () => {
    if (server) await new Promise<void>((resolve) => server?.close(() => resolve()));
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
    server = undefined;
  });

  test("retains numeric metric data but excludes exemplars and unknown properties", () => {
    const source = JSON.stringify({
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
                      aggregationTemporality: "AGGREGATION_TEMPORALITY_CUMULATIVE",
                      unknown: "SECRET_AGGREGATE",
                      dataPoints: [
                        {
                          startTimeUnixNano: "1793763000000000000",
                          timeUnixNano: "1793763900000000000",
                          asInt: "42",
                          attributes: [attr("session.id", "wanted")],
                          exemplars: [{ filteredAttributes: [attr("private", "SECRET_EXEMPLAR")] }],
                          unknown: "SECRET_POINT",
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
    const transfers = selectTransfers(
      source,
      {
        config: "claude",
        session: "wanted",
        tenant: "tenant",
        endpoint: "http://127.0.0.1:3011",
        token: "test",
        home: "/tmp",
        follow: false,
      },
      { values: new Map(), conflict: false }
    );
    expect(transfers).toHaveLength(1);
    const sent = JSON.stringify(transfers[0]);
    expect(sent).toContain('"asInt":"42"');
    expect(sent).toContain("AGGREGATION_TEMPORALITY_CUMULATIVE");
    expect(sent).not.toContain("SECRET_");
  });

  it("sends only the selected session's useful events to loopback, without tool output", async () => {
    const home = await mkdtemp(join(tmpdir(), "aidd-sync-"));
    dirs.push(home);
    const directory = join(home, ".local/share/aidd-otel-observation");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const wanted = record("wanted", "codex.sse_event");
    wanted.attributes.push(attr("model", "gpt-test"), attr("model_reasoning_effort", "high"));
    const line = {
      signal: "logs",
      payload: {
        resourceLogs: [
          {
            scopeLogs: [
              {
                logRecords: [
                  wanted,
                  record("other", "codex.sse_event"),
                  record("wanted", "codex.user_prompt"),
                ],
              },
            ],
          },
        ],
      },
    };
    const file = join(directory, "codex.jsonl");
    await writeFile(file, `${JSON.stringify(line)}\n`, { mode: 0o600 });
    const received: Array<{ url: string; auth: string; body: string }> = [];
    server = createServer((request, response) => {
      let body = "";
      request.on("data", (chunk: Buffer) => {
        body += chunk.toString();
      });
      request.on("end", () => {
        received.push({ url: request.url ?? "", auth: request.headers.authorization ?? "", body });
        response.writeHead(200).end("{}");
      });
    });
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("No test port");
    const before = await readFile(file, "utf8");
    const syncOptions = {
      config: "codex" as const,
      session: "wanted",
      tenant: "tenant",
      endpoint: `http://127.0.0.1:${address.port}`,
      token: "test-token",
      home,
      follow: false,
    };
    const result = await syncOtel(
      syncOptions,
      async () => ({ state: "unbound" }),
      async () => true
    );
    expect(result.sent).toBe(1);
    expect(received).toHaveLength(1);
    expect(received[0].url).toBe("/api/kpi/otel/codex/tenant/v1/logs");
    expect(received[0].auth).toBe("Bearer test-token");
    expect(received[0].body).not.toContain("sensitive output");
    expect(received[0].body).toContain("toolu_123");
    expect(received[0].body).toContain('"key":"model_reasoning_effort"');
    expect(received[0].body).toContain('"stringValue":"high"');
    expect(received[0].body).not.toContain('"other"');
    expect(await readFile(file, "utf8")).toBe(before);
    const denied = await syncOtel(
      syncOptions,
      async () => ({ state: "unbound" }),
      async () => false
    );
    expect(denied.skipped).toBe(1);
    expect(received).toHaveLength(1);
  });

  test("refuses a non-loopback destination before reading capture or sending credentials", async () => {
    await expect(
      syncOtel(
        {
          config: "claude",
          session: "wanted",
          tenant: "tenant",
          endpoint: "http://example.com:3011",
          token: "test-token",
          home: "/missing",
          follow: false,
        },
        async () => ({ state: "unbound" }),
        async () => true
      )
    ).rejects.toThrow(/loopback/);
  });

  it("replays after a rejected delivery and invalidates a formerly confirmed session", async () => {
    const home = await mkdtemp(join(tmpdir(), "aidd-sync-retry-"));
    dirs.push(home);
    const directory = join(home, ".local/share/aidd-otel-observation");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const line = {
      signal: "logs",
      payload: {
        resourceLogs: [{ scopeLogs: [{ logRecords: [record("wanted", "codex.sse_event")] }] }],
      },
    };
    await writeFile(join(directory, "codex.jsonl"), `${JSON.stringify(line)}\n`, { mode: 0o600 });
    const received: string[] = [];
    let reject = true;
    server = createServer((request, response) => {
      let body = "";
      request.on("data", (chunk: Buffer) => {
        body += chunk.toString();
      });
      request.on("end", () => {
        received.push(body);
        response.writeHead(reject ? 503 : 200).end("{}");
      });
    });
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("No test port");
    const options = {
      config: "codex" as const,
      session: "wanted",
      tenant: "tenant",
      endpoint: `http://127.0.0.1:${address.port}`,
      token: "test-token",
      home,
      follow: false,
      stateDir: join(home, "state"),
      admission: { cwd: "/project", repositoryId: "repo" },
    };
    const confirmed = async () => ({
      state: "confirmed" as const,
      feature: "owner/repo#7",
      branch: "feature/work",
    });
    await expect(syncOtel(options, confirmed, async () => true)).rejects.toThrow("HTTP 503");
    reject = false;
    await syncOtel(options, confirmed, async () => true);
    expect(received.filter((body) => body.includes("codex.sse_event"))).toHaveLength(2);
    expect(received.some((body) => body.includes('aidd.session_feature"'))).toBe(true);
    await syncOtel(
      options,
      async () => ({ state: "unbound" }),
      async () => true
    );
    expect(received.some((body) => body.includes("aidd.session_feature_invalidated"))).toBe(true);
  });

  it("follows only newly appended complete lines for the chosen session", async () => {
    const home = await mkdtemp(join(tmpdir(), "aidd-sync-follow-"));
    dirs.push(home);
    const directory = join(home, ".local/share/aidd-otel-observation");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const line = `${JSON.stringify({ signal: "logs", payload: { resourceLogs: [{ scopeLogs: [{ logRecords: [record("wanted", "codex.sse_event")] }] }] } })}\n`;
    const file = join(directory, "codex.jsonl");
    await writeFile(file, line, { mode: 0o600 });
    const abort = new AbortController();
    let received = 0;
    server = createServer((request, response) => {
      request.resume();
      request.on("end", () => {
        received++;
        response.writeHead(200).end("{}");
        if (received === 1) void appendFile(file, line);
        if (received === 2) abort.abort();
      });
    });
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("No test port");
    const result = await syncOtel(
      {
        config: "codex",
        session: "wanted",
        tenant: "tenant",
        endpoint: `http://127.0.0.1:${address.port}`,
        token: "test-token",
        home,
        follow: true,
        signal: abort.signal,
        intervalMs: 10,
      },
      async () => ({ state: "unbound" }),
      async () => true
    );
    expect(received).toBe(2);
    expect(result.sent).toBe(2);
  });

  it("never uses an identity from an observation outside consent to publish a binding", async () => {
    const home = await mkdtemp(join(tmpdir(), "aidd-sync-unconsented-identity-"));
    dirs.push(home);
    const directory = join(home, ".local/share/aidd-otel-observation");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const source = {
      signal: "logs",
      payload: {
        resourceLogs: [{ scopeLogs: [{ logRecords: [record("wanted", "codex.sse_event")] }] }],
      },
    };
    await writeFile(join(directory, "codex.jsonl"), `${JSON.stringify(source)}\n`, { mode: 0o600 });
    let calls = 0;
    server = createServer((request, response) => {
      calls++;
      request.resume();
      response.writeHead(200).end("{}");
    });
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No test port");
    const result = await syncOtel(
      {
        config: "codex",
        session: "wanted",
        tenant: "tenant",
        endpoint: `http://127.0.0.1:${address.port}`,
        token: "test-token",
        home,
        follow: false,
      },
      async () => ({ state: "confirmed", feature: "owner/repo#7", branch: "feature/work" }),
      async (transfer) => Object.keys(transfer.payload).length === 0
    );
    expect(result).toMatchObject({ sent: 0, skipped: 1 });
    expect(calls).toBe(0);
  });

  it("stops before retrying a failed post after consent is withdrawn", async () => {
    const home = await mkdtemp(join(tmpdir(), "aidd-sync-withdrawn-retry-"));
    dirs.push(home);
    const directory = join(home, ".local/share/aidd-otel-observation");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const source = {
      signal: "logs",
      payload: {
        resourceLogs: [{ scopeLogs: [{ logRecords: [record("wanted", "codex.sse_event")] }] }],
      },
    };
    await writeFile(join(directory, "codex.jsonl"), `${JSON.stringify(source)}\n`, { mode: 0o600 });
    let consenting = true;
    let calls = 0;
    server = createServer((request, response) => {
      calls++;
      request.resume();
      request.on("end", () => {
        consenting = false;
        response.writeHead(503).end("{}");
      });
    });
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No test port");
    await expect(
      syncOtel(
        {
          config: "codex",
          session: "wanted",
          tenant: "tenant",
          endpoint: `http://127.0.0.1:${address.port}`,
          token: "test-token",
          home,
          follow: true,
          intervalMs: 10,
        },
        async () => ({ state: "unbound" }),
        async (transfer) => !transfer.consentAt || consenting
      )
    ).rejects.toThrow(/Consent is no longer confirmed/);
    expect(calls).toBe(1);
  });
});
