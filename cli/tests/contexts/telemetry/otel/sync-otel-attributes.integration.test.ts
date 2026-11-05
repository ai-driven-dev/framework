import { appendFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { selectTransfers } from "../../../../src/contexts/telemetry/infrastructure/otel/actions/sync.js";
import { syncAllOtel } from "../../../../src/contexts/telemetry/infrastructure/otel/actions/sync-all.js";

const attribute = (key: string, value: unknown) => ({ key, value });
const text = (key: string, value: string) => attribute(key, { stringValue: value });
const options = {
  config: "codex" as const,
  session: "session",
  tenant: "tenant",
  endpoint: "http://127.0.0.1:1",
  token: "test",
  home: "/tmp",
  follow: false,
};
type Attributes = ReturnType<typeof attribute>[];

function capture(
  record: Attributes,
  resource: Attributes = [],
  scope: Attributes = [],
  body?: unknown
): string {
  return JSON.stringify({
    signal: "logs",
    payload: {
      resourceLogs: [
        {
          resource: { attributes: resource },
          scopeLogs: [
            {
              scope: { attributes: scope },
              logRecords: [
                {
                  ...(body === undefined ? {} : { body }),
                  attributes: [
                    text("conversation.id", "session"),
                    ...(body === undefined ? [text("event.name", "codex.sse_event")] : []),
                    text("event.kind", "response.completed"),
                    text("event.timestamp", "2026-11-05T00:00:00Z"),
                    ...record,
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

test.each([
  { stringValue: ["codex.sse_event"], intValue: "9" },
  { stringValue: ["codex.sse_event"] },
  { stringValue: "" },
  { intValue: "9" },
  {},
  null,
])("rejects invalid fallback event bodies without coercion", (body) => {
  expect(() => select(capture([], [], [], body))).toThrow("Invalid OTLP attribute value.");
});

test("keeps a valid string log body as the event-name fallback", () => {
  expect(select(capture([], [], [], { stringValue: "codex.sse_event" }))).toHaveLength(1);
  expect(
    selectTransfers(
      capture([text("session.id", "session")], [], [], { stringValue: "tool_result" }),
      { ...options, config: "claude" },
      { values: new Map(), conflict: false }
    )
  ).toHaveLength(1);
});

function select(line: string) {
  return selectTransfers(line, options, { values: new Map(), conflict: false });
}

function metricCapture(
  point: Attributes,
  resource: Attributes = [],
  scope: Attributes = []
): string {
  return JSON.stringify({
    signal: "metrics",
    payload: {
      resourceMetrics: [
        {
          resource: { attributes: resource },
          scopeMetrics: [
            {
              scope: { attributes: scope },
              metrics: [
                {
                  name: "claude_code.token.usage",
                  sum: {
                    aggregationTemporality: 1,
                    dataPoints: [
                      {
                        startTimeUnixNano: "1793836800000000000",
                        timeUnixNano: "1793836801000000000",
                        asInt: "5",
                        attributes: [text("session.id", "session"), ...point],
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

test.each(["point", "resource", "scope"])("rejects contradictory Claude %s attributes", (level) => {
  const conflict = [text("type", "input"), text("type", "output")];
  expect(() =>
    selectTransfers(
      metricCapture(
        level === "point" ? conflict : [],
        level === "resource" ? conflict : [],
        level === "scope" ? conflict : []
      ),
      { ...options, config: "claude" },
      { values: new Map(), conflict: false }
    )
  ).toThrow("Conflicting duplicate OTLP attributes.");
});

test("rejects contradictory Claude resource and point identities", () => {
  expect(() =>
    selectTransfers(
      metricCapture([text("user.email", "private-b")], [text("user.email", "private-a")]),
      { ...options, config: "claude" },
      { values: new Map(), conflict: false }
    )
  ).toThrow("Conflicting OTLP identity attributes.");
});

test.each(["input_token_count", "user.email", "private.unforwarded.attribute"])(
  "rejects conflicting duplicate attributes without exposing their contents: %s",
  (key) => {
    expect(() => select(capture([text(key, "private-a"), text(key, "private-b")]))).toThrow(
      "Conflicting duplicate OTLP attributes."
    );
  }
);

test("does not equate differently typed OTLP values that stringify identically", () => {
  expect(() =>
    select(
      capture([attribute("input_token_count", { intValue: 1 }), text("input_token_count", "1")])
    )
  ).toThrow("Conflicting duplicate OTLP attributes.");
});

test.each([
  { stringValue: ["5"], intValue: "900" },
  { stringValue: ["5"] },
  { stringValue: 5 },
  { intValue: Number.MAX_SAFE_INTEGER + 1 },
  { intValue: 1.5 },
  { intValue: "9223372036854775808" },
  { doubleValue: "5" },
  { boolValue: "true" },
  [],
  null,
  {},
  { arrayValue: { values: [{ stringValue: "5" }] } },
  { kvlistValue: { values: [] } },
  { bytesValue: "NQ==" },
])("refuses malformed or non-scalar critical AnyValue without coercion", (value) => {
  expect(() => select(capture([attribute("input_token_count", value)]))).toThrow(
    "Invalid OTLP attribute value."
  );
});

test("does not coerce an identity from a malformed stringValue", () => {
  expect(() =>
    select(capture([attribute("user.email", { stringValue: ["person@example.test"] })]))
  ).toThrow("Invalid OTLP attribute value.");
});

test.each([
  "user.email",
  "user.account_id",
  "organization.id",
  "model",
  "event.name",
  "event.kind",
  "session.id",
])("refuses non-text values for textual telemetry fields: %s", (key) => {
  expect(() => select(capture([attribute(key, { intValue: "5" })]))).toThrow();
});

test.each(["event.name", "event.kind", "session.id", "conversation.id"])(
  "refuses an explicitly empty mandatory context value: %s",
  (key) => {
    const original = key === "session.id" ? metricCapture([]) : capture([]);
    const initial = {
      "event.name": "codex.sse_event",
      "event.kind": "response.completed",
      "session.id": "session",
      "conversation.id": "session",
    }[key];
    const body = original.replace(
      JSON.stringify(text(key, initial ?? "")),
      JSON.stringify(text(key, ""))
    );
    expect(() =>
      selectTransfers(
        body,
        { ...options, config: key === "session.id" ? "claude" : "codex" },
        { values: new Map(), conflict: false }
      )
    ).toThrow();
  }
);

test("keeps supported scalar AnyValue types exact", () => {
  const [transfer] = select(
    capture([
      attribute("input_token_count", { intValue: "9007199254740993" }),
      attribute("success", { boolValue: false }),
      attribute("duration_ms", { doubleValue: 1.5 }),
    ])
  );
  const payload = JSON.stringify(transfer.payload);
  for (const value of ["9007199254740993", "false", "1.5"])
    expect(payload).toContain(`"stringValue":"${value}"`);
});

test("ignores valid empty and structured noncritical values", () => {
  expect(
    select(
      capture([
        attribute("unused.empty", {}),
        attribute("unused.array", { arrayValue: { values: [{ stringValue: "private" }] } }),
        attribute("unused.list", {
          kvlistValue: { values: [{ key: "item", value: { boolValue: true } }] },
        }),
        attribute("unused.bytes", { bytesValue: "NQ==" }),
      ])
    )
  ).toHaveLength(1);
});

test("accepts identical duplicate attributes", () => {
  const [transfer] = select(
    capture([text("input_token_count", "5"), text("input_token_count", "5")])
  );
  expect(JSON.stringify(transfer.payload)).toContain(
    '"key":"input_token_count","value":{"stringValue":"5"}'
  );
});

test.each(["resource", "scope"])("rejects conflicting duplicates in %s attributes", (level) => {
  const conflict = [text("user.email", "private-a"), text("user.email", "private-b")];
  expect(() =>
    select(capture([], level === "resource" ? conflict : [], level === "scope" ? conflict : []))
  ).toThrow("Conflicting duplicate OTLP attributes.");
});

test("preserves non-identity attribute overrides between resource and record", () => {
  const [transfer] = select(
    capture([text("model", "record-model")], [text("model", "resource-model")])
  );
  expect(JSON.stringify(transfer.payload)).toContain("record-model");
  expect(JSON.stringify(transfer.payload)).not.toContain("resource-model");
});

test.each(["user.email", "user.account_id", "organization.id"])(
  "does not choose between contradictory resource and record identities: %s",
  (key) => {
    expect(() => select(capture([text(key, "private-b")], [text(key, "private-a")]))).toThrow(
      "Conflicting OTLP identity attributes."
    );
  }
);

test("keeps identical identity values across resource and record", () => {
  expect(
    select(capture([text("user.email", "a@example.test")], [text("user.email", "a@example.test")]))
  ).toHaveLength(1);
});

test.each(["user.email", "user.account_id", "organization.id"])(
  "does not assume case-insensitive identity semantics: %s",
  (key) => {
    expect(() => select(capture([text(key, "ABC")], [text(key, "abc")]))).toThrow(
      "Conflicting OTLP identity attributes."
    );
  }
);

test("marks case-distinct session identities as conflicting across observations", () => {
  const identity = { values: new Map([["user.account_id", "abc"]]), conflict: false };
  selectTransfers(capture([text("user.account_id", "ABC")]), options, identity);
  expect(identity.conflict).toBe(true);
  expect(identity.values.get("user.account_id")).toBe("abc");
});

const dirs: string[] = [];
let server: Server | undefined;
afterEach(async () => {
  if (server) await new Promise<void>((resolve) => server?.close(() => resolve()));
  server = undefined;
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

test.skipIf(process.platform === "win32").each([
  {
    values: [text("input_token_count", "100"), text("input_token_count", "5")],
    error: "Conflicting duplicate OTLP attributes.",
    body: undefined,
  },
  {
    values: [attribute("input_token_count", { stringValue: ["5"], intValue: "900" })],
    error: "Invalid OTLP attribute value.",
    body: undefined,
  },
  {
    values: [attribute("input_token_count", { intValue: Number.MAX_SAFE_INTEGER + 1 })],
    error: "Invalid OTLP attribute value.",
    body: undefined,
  },
  {
    values: [attribute("user.email", { stringValue: ["person@example.test"] })],
    error: "Invalid OTLP attribute value.",
    body: undefined,
  },
  {
    values: [],
    error: "Invalid OTLP attribute value.",
    body: { stringValue: ["codex.sse_event"], intValue: "9" },
  },
])(
  "invalid attributes stop sync before sending or advancing its checkpoint",
  async ({ values, error, body }) => {
    const home = await mkdtemp(join(tmpdir(), "aidd-conflicting-attributes-"));
    dirs.push(home);
    const captureDir = join(home, ".local/share/aidd-otel-observation");
    await mkdir(captureDir, { recursive: true, mode: 0o700 });
    const file = join(captureDir, "codex.jsonl");
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
    const stateDir = join(home, "state");
    const running = syncAllOtel(
      {
        ...options,
        home,
        stateDir,
        endpoint: `http://127.0.0.1:${address.port}`,
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
      checkpoint = (await readdir(directory).catch(() => [])).find((entry) =>
        entry.endsWith(".checkpoint.json")
      );
      if (!checkpoint) await new Promise((resolve) => setTimeout(resolve, 10));
    }
    if (!checkpoint) throw new Error("No initial checkpoint");
    await appendFile(file, `${capture(values, [], [], body)}\n`);
    await expect(running).rejects.toThrow(error);
    expect(calls).toBe(0);
    expect(JSON.parse(await readFile(join(directory, checkpoint), "utf8")).offset).toBe(0);
  }
);
