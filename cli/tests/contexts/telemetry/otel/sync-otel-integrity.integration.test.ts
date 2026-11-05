import { appendFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import {
  selectTransfers,
  send,
  syncOtel,
} from "../../../../src/contexts/telemetry/infrastructure/otel/actions/sync.js";
import { syncAllOtel } from "../../../../src/contexts/telemetry/infrastructure/otel/actions/sync-all.js";

const posixTest = test.skipIf(process.platform === "win32");
const attribute = (key: string, value: string) => ({ key, value: { stringValue: value } });
const options = {
  config: "codex" as const,
  session: "session",
  tenant: "tenant",
  endpoint: "http://127.0.0.1:1",
  token: "test",
  home: "/tmp",
  follow: false,
};
let server: Server | undefined;
const dirs: string[] = [];
afterEach(async () => {
  if (server) await new Promise<void>((resolve) => server?.close(() => resolve()));
  server = undefined;
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function codexLog(time: Record<string, string | number>, timestamp?: string): string {
  return JSON.stringify({
    signal: "logs",
    payload: {
      resourceLogs: [
        {
          scopeLogs: [
            {
              logRecords: [
                {
                  ...time,
                  attributes: [
                    attribute("conversation.id", "session"),
                    attribute("event.name", "codex.sse_event"),
                    attribute("event.kind", "response.completed"),
                    ...(timestamp ? [attribute("event.timestamp", timestamp)] : []),
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

function claudeMetric(startTime: string | number, endTime: string | number): string {
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
                        startTimeUnixNano: startTime,
                        timeUnixNano: endTime,
                        asInt: "42",
                        attributes: [attribute("session.id", "session")],
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

function claudePoint(extra: Record<string, unknown>): string {
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
                        startTimeUnixNano: "1785044858922210000",
                        timeUnixNano: "1785044858922210000",
                        asInt: "42",
                        ...extra,
                        attributes: [attribute("session.id", "session")],
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

function metricData(data: Record<string, unknown>): string {
  return JSON.stringify({
    signal: "metrics",
    payload: {
      resourceMetrics: [
        { scopeMetrics: [{ metrics: [{ name: "claude_code.token.usage", ...data }] }] },
      ],
    },
  });
}

test.each([
  { asDouble: 5 },
  { asInt: undefined, asDouble: [5] },
  { asInt: undefined, asDouble: {} },
  { asInt: undefined, asDouble: true },
  { asInt: undefined, asDouble: null },
  { asInt: undefined, asDouble: "NaN" },
  { asInt: undefined },
  { flags: 1 },
  { flags: "3" },
  { sum: [] },
  { explicitBounds: ["bad"] },
])("rejects malformed or unrecorded NumberDataPoint values", (extra) => {
  expect(() =>
    selectTransfers(
      claudePoint(extra),
      { ...options, config: "claude" },
      { values: new Map(), conflict: false }
    )
  ).toThrow(/OTLP/);
});

test.each([
  {},
  { summary: {} },
  { exponentialHistogram: {} },
  { sum: {}, gauge: {} },
  { sum: {}, histogram: {} },
  { sum: {}, summary: {} },
  { sum: {}, exponentialHistogram: {} },
  { sum: {}, exponential_histogram: {} },
  { sum: { dataPoints: {} } },
])("rejects missing, unsupported or competing data on a supported metric", (data) => {
  expect(() =>
    selectTransfers(
      metricData(data),
      { ...options, config: "claude" },
      { values: new Map(), conflict: false }
    )
  ).toThrow(/OTLP metric data/);
});

test("keeps valid histograms separate from NumberDataPoint's scalar oneof", () => {
  const point = {
    startTimeUnixNano: "1785044858922210000",
    timeUnixNano: "1785044858922210000",
    count: "2",
    sum: 5.5,
    explicitBounds: [1.5],
    bucketCounts: ["1", "1"],
    attributes: [attribute("session.id", "session")],
  };
  const [transfer] = selectTransfers(
    metricData({ histogram: { dataPoints: [point] } }),
    { ...options, config: "claude" },
    { values: new Map(), conflict: false }
  );
  expect(JSON.stringify(transfer.payload)).toContain('"count":"2"');
  expect(JSON.stringify(transfer.payload)).toContain('"sum":5.5');
});

test.each([
  { asInt: 1785044858922210000 },
  { asInt: 1.5 },
  { asInt: "1.5" },
  { asInt: "private-invalid-value" },
  { asInt: null },
  { asInt: "9223372036854775808" },
  { count: 1785044858922210000 },
  { count: -1 },
  { count: "1.5" },
  { count: "18446744073709551616" },
  { bucketCounts: [1, 1785044858922210000] },
  { bucketCounts: [1, "bad"] },
  { bucketCounts: 1 },
  { flags: 1.5 },
])("rejects invalid or inexact integer metric fields before exporting", (extra) => {
  expect(() =>
    selectTransfers(
      claudePoint(extra),
      { ...options, config: "claude" },
      { values: new Map(), conflict: false }
    )
  ).toThrow(/invalid OTLP integer/i);
});

test("preserves exact integer strings for signed and unsigned metric values", () => {
  const extra = {
    asInt: "9223372036854775807",
    count: "18446744073709551615",
    bucketCounts: ["9007199254740993", "0"],
  };
  const [transfer] = selectTransfers(
    claudePoint(extra),
    { ...options, config: "claude" },
    { values: new Map(), conflict: false }
  );
  const payload = JSON.stringify(transfer.payload);
  for (const value of [extra.asInt, extra.count, ...extra.bucketCounts])
    expect(payload).toContain(`"${value}"`);
});

posixTest.each([
  claudePoint({ asInt: 1785044858922210000 }),
  claudePoint({ asDouble: 5 }),
  claudePoint({ flags: 1 }),
  metricData({ sum: {}, summary: {} }),
  metricData({ summary: {} }),
])(
  "an invalid metric stops all-session sync before delivery or checkpoint advance",
  async (line) => {
    const home = await mkdtemp(join(tmpdir(), "aidd-inexact-metric-"));
    dirs.push(home);
    const captureDir = join(home, ".local/share/aidd-otel-observation");
    const stateDir = join(home, "state");
    await mkdir(captureDir, { recursive: true, mode: 0o700 });
    const file = join(captureDir, "claude.jsonl");
    await writeFile(file, "", { mode: 0o600 });
    let calls = 0;
    const abort = new AbortController();
    server = createServer((request, response) => {
      request.resume();
      request.on("end", () => {
        calls++;
        response.writeHead(200).end("{}");
        abort.abort();
      });
    });
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("No test port");
    const running = syncAllOtel(
      {
        config: "claude",
        tenant: "tenant",
        endpoint: `http://127.0.0.1:${address.port}`,
        token: "test",
        home,
        stateDir,
        intervalMs: 10,
        signal: abort.signal,
      },
      async () =>
        new Map([
          ["session", { feature: { state: "unbound" }, cwd: "/project", repositoryId: "repo" }],
        ]),
      async () => "allow"
    );
    const directory = join(stateDir, "otel-sync");
    let checkpoint: string | undefined;
    for (let attempt = 0; attempt < 100 && !checkpoint; attempt++) {
      const entries = await readdir(directory).catch(() => []);
      checkpoint = entries.find((entry) => entry.endsWith(".checkpoint.json"));
      if (!checkpoint) await new Promise((resolve) => setTimeout(resolve, 10));
    }
    if (!checkpoint) throw new Error("No initial checkpoint");
    await appendFile(file, `${line}\n`);
    await expect(running).rejects.toThrow(/OTLP/);
    const saved = JSON.parse(await readFile(join(directory, checkpoint), "utf8"));
    expect(saved.offset).toBe(0);
    expect(calls).toBe(0);
  }
);

function metricWithMetadata(unit: string, temporality: number, monotonic: boolean): string {
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
                    aggregationTemporality: temporality,
                    isMonotonic: monotonic,
                    dataPoints: [
                      {
                        startTimeUnixNano: "1785044858922210000",
                        timeUnixNano: "1785044858922210000",
                        asInt: "42",
                        attributes: [attribute("session.id", "session")],
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

test("distinguishes metric unit, aggregation and monotonicity when computing series identity", () => {
  const fingerprint = (unit: string, temporality: number, monotonic: boolean) => {
    const [transfer] = selectTransfers(
      metricWithMetadata(unit, temporality, monotonic),
      { ...options, config: "claude" },
      { values: new Map(), conflict: false }
    );
    return JSON.stringify(transfer.payload).match(
      /"aidd.series_fingerprint","value":\{"stringValue":"([0-9a-f]+)"/
    )?.[1];
  };
  const base = fingerprint("token", 1, true);
  expect(base).toHaveLength(64);
  expect(fingerprint("byte", 1, true)).not.toBe(base);
  expect(fingerprint("token", 2, true)).not.toBe(base);
  expect(fingerprint("token", 1, false)).not.toBe(base);
});

test("does not convert an unsafe numeric OTLP timestamp into a fabricated Codex event time", () => {
  const unsafe = 1785044858922210000;
  const line = codexLog({ timeUnixNano: unsafe });
  expect(() => selectTransfers(line, options, { values: new Map(), conflict: false })).toThrow(
    /invalid OTLP integer/i
  );
});

test("preserves exact decimal-string nanoseconds, including for Claude metric intervals", () => {
  const time = "1785044858922210000";
  const [log] = selectTransfers(codexLog({ timeUnixNano: time }), options, {
    values: new Map(),
    conflict: false,
  });
  expect(log.at).toBe("2026-07-26T05:47:38.922Z");
  expect(JSON.stringify(log.payload)).toContain(time);
  const [metric] = selectTransfers(
    claudeMetric(time, time),
    { ...options, config: "claude" },
    { values: new Map(), conflict: false }
  );
  expect(metric.start).toBe("2026-07-26T05:47:38.922Z");
  expect(metric.at).toBe("2026-07-26T05:47:38.922Z");
  expect(JSON.stringify(metric.payload)).toContain(time);
});

test.each([
  [1785044858922210000, "1785044858922210000"],
  ["1785044858922210000", 1785044858922210000],
] as const)("rejects unsafe numeric Claude metric bounds", (start, end) => {
  expect(() =>
    selectTransfers(
      claudeMetric(start, end),
      { ...options, config: "claude" },
      { values: new Map(), conflict: false }
    )
  ).toThrow(/invalid OTLP integer/i);
});

test("does not forward an unsafe timestamp beside a valid Codex event timestamp", () => {
  const line = codexLog({ timeUnixNano: 1785044858922210000 }, "2026-07-26T05:47:38.922Z");
  expect(() => selectTransfers(line, options, { values: new Map(), conflict: false })).toThrow(
    /invalid OTLP integer/i
  );
});

test("uses a genuine OTLP event time when a Codex calendar date is invalid", () => {
  const line = codexLog({ timeUnixNano: "1785044858922210000" }, "2026-02-30T12:00:00Z");
  const transfers = selectTransfers(line, options, { values: new Map(), conflict: false });
  expect(transfers[0].at).toBe("2026-07-26T05:47:38.922Z");
  expect(JSON.stringify(transfers[0].payload)).not.toContain("aidd.original_event_timestamp");
  expect(JSON.stringify(transfers[0].payload)).not.toContain("2026-02-30");
});

test.each([
  "2026-02-30T12:00:00Z",
  "2026-01-01T25:00:00Z",
  "2026-01-01T12:00:00+24:00",
  "2026-01-01T12:00:00",
])("does not normalize an invalid provider event time: %s", (time) => {
  const transfers = selectTransfers(codexLog({}, time), options, {
    values: new Map(),
    conflict: false,
  });
  expect(transfers[0].at).toBeUndefined();
  expect(JSON.stringify(transfers[0].payload)).not.toContain("aidd.original_event_timestamp");
});

test("keeps a valid offset and leap date as the original event time", () => {
  const original = "2028-02-29T12:30:00.123456+02:30";
  const transfers = selectTransfers(codexLog({}, original), options, {
    values: new Map(),
    conflict: false,
  });
  expect(transfers[0].at).toBe("2028-02-29T10:00:00.123Z");
  expect(JSON.stringify(transfers[0].payload)).toContain(original);
});

posixTest("does not export an observation-only timestamp as event activity", async () => {
  const home = await mkdtemp(join(tmpdir(), "aidd-missing-event-time-"));
  dirs.push(home);
  const capture = join(home, ".local/share/aidd-otel-observation");
  await mkdir(capture, { recursive: true, mode: 0o700 });
  await writeFile(
    join(capture, "codex.jsonl"),
    `${codexLog({ observedTimeUnixNano: "1785044858922210000" })}\n`,
    { mode: 0o600 }
  );
  let calls = 0;
  server = createServer((request, response) => {
    request.resume();
    request.on("end", () => {
      calls++;
      response.writeHead(200).end("{}");
    });
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("No test port");
  const result = await syncOtel(
    { ...options, home, endpoint: `http://127.0.0.1:${address.port}` },
    async () => ({ state: "unbound" }),
    async () => true
  );
  expect(result.sent).toBe(0);
  expect(result.skipped).toBe(1);
  expect(calls).toBe(0);
});

test("does not use Claude observation time as event activity", () => {
  const line = JSON.stringify({
    signal: "logs",
    payload: {
      resourceLogs: [
        {
          scopeLogs: [
            {
              logRecords: [
                {
                  observedTimeUnixNano: "1785044858922210000",
                  attributes: [
                    attribute("session.id", "session"),
                    attribute("event.name", "tool_result"),
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  });
  const transfers = selectTransfers(
    line,
    { ...options, config: "claude" },
    { values: new Map(), conflict: false }
  );
  expect(transfers).toHaveLength(1);
  expect(transfers[0].at).toBeUndefined();
});

test("preserves distinct submillisecond Codex event timestamps in the transmitted attributes", () => {
  const timestamps = ["2026-11-04T01:00:00.123456100Z", "2026-11-04T01:00:00.123456200Z"];
  const line = JSON.stringify({
    signal: "logs",
    payload: {
      resourceLogs: [
        {
          scopeLogs: [
            {
              logRecords: timestamps.map((time) => ({
                attributes: [
                  attribute("conversation.id", "session"),
                  attribute("event.name", "codex.sse_event"),
                  attribute("event.kind", "response.completed"),
                  attribute("event.timestamp", time),
                ],
              })),
            },
          ],
        },
      ],
    },
  });
  const transfers = selectTransfers(line, options, { values: new Map(), conflict: false });
  expect(transfers).toHaveLength(2);
  for (const [index, transfer] of transfers.entries()) {
    expect(JSON.stringify(transfer.payload)).toContain(timestamps[index]);
    expect(JSON.stringify(transfer.payload)).toContain(
      '"event.timestamp","value":{"stringValue":"2026-11-04T01:00:00.123Z"}'
    );
    expect(JSON.stringify(transfer.payload)).toContain('"aidd.original_event_timestamp"');
    expect(transfer.at).toBe("2026-11-04T01:00:00.123Z");
  }
});

test.each([
  ["logs" as const, { partialSuccess: { rejectedLogRecords: "1" } }],
  ["metrics" as const, { partial_success: { rejected_data_points: 2 } }],
])("does not retry or report success for partial %s delivery", async (signal, body) => {
  let calls = 0;
  server = createServer((request, response) => {
    request.resume();
    request.on("end", () => {
      calls++;
      response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(body));
    });
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("No test port");
  await expect(
    send(
      { ...options, endpoint: `http://127.0.0.1:${address.port}`, follow: true },
      { signal, payload: {} },
      async () => true
    )
  ).rejects.toThrow(/partial/i);
  expect(calls).toBe(1);
});

test.each([
  "not-json",
  '{"partialSuccess":{"rejectedLogRecords":"-1"}}',
  '{"partialSuccess":{"rejectedLogRecords":""}}',
  '{"partialSuccess":{"rejectedLogRecords":"0x0"}}',
  '{"partialSuccess":{"rejectedDataPoints":"1"}}',
  '{"partialSuccess":{"rejectedLogRecord":"1"}}',
])("refuses an invalid successful OTLP response: %s", async (body) => {
  server = createServer((request, response) => {
    request.resume();
    request.on("end", () => response.writeHead(200).end(body));
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("No test port");
  await expect(
    send(
      { ...options, endpoint: `http://127.0.0.1:${address.port}` },
      { signal: "logs", payload: {} },
      async () => true
    )
  ).rejects.toThrow(/response/i);
});

test("accepts a warning with zero rejected records", async () => {
  server = createServer((request, response) => {
    request.resume();
    request.on("end", () =>
      response.writeHead(200).end(
        JSON.stringify({
          partialSuccess: { rejectedLogRecords: "0", errorMessage: "warning" },
        })
      )
    );
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("No test port");
  await expect(
    send(
      { ...options, endpoint: `http://127.0.0.1:${address.port}` },
      { signal: "logs", payload: {} },
      async () => true
    )
  ).resolves.toBeUndefined();
});
