import { appendFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it as test } from "vitest";
import { syncAllOtel } from "../../../../src/contexts/telemetry/infrastructure/otel/actions/sync-all.js";

const it = test.skipIf(process.platform === "win32");
const attribute = (key: string, value: string) => ({ key, value: { stringValue: value } });
function line(session: string) {
  return `${JSON.stringify({
    signal: "logs",
    payload: {
      resourceLogs: [
        {
          scopeLogs: [
            {
              logRecords: [
                {
                  timeUnixNano: "1793763900000000000",
                  attributes: [
                    attribute("conversation.id", session),
                    attribute("user.email", "developer@example.test"),
                    attribute("event.name", "codex.sse_event"),
                    attribute("event.kind", "response.completed"),
                    attribute("input_token_count", "42"),
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  })}\n`;
}
let server: Server | undefined;
const dirs: string[] = [];
afterEach(async () => {
  if (server) await new Promise<void>((resolve) => server?.close(() => resolve()));
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  server = undefined;
});

it("discovers a newly consented session without transmitting a different session", async () => {
  const home = await mkdtemp(join(tmpdir(), "aidd-sync-all-"));
  dirs.push(home);
  const captureDir = join(home, ".local/share/aidd-otel-observation");
  await mkdir(captureDir, { recursive: true, mode: 0o700 });
  const capture = join(captureDir, "codex.jsonl");
  await writeFile(capture, "", { mode: 0o600 });
  const received: string[] = [];
  const abort = new AbortController();
  server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    request.on("end", () => {
      received.push(body);
      response.writeHead(200).end("{}");
      abort.abort();
    });
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("No test port");
  let snapshotCount = 0;
  const admission = {
    feature: { state: "unbound" as const },
    cwd: "/project",
    repositoryId: "repo",
  };
  const running = syncAllOtel(
    {
      config: "codex",
      tenant: "tenant",
      endpoint: `http://127.0.0.1:${address.port}`,
      token: "test-token",
      home,
      stateDir: join(home, "state"),
      signal: abort.signal,
      intervalMs: 10,
    },
    async () => {
      snapshotCount++;
      return snapshotCount > 1 ? new Map([["allowed", admission]]) : new Map();
    },
    async () => "allow"
  );
  await new Promise((resolve) => setTimeout(resolve, 80));
  await appendFile(capture, line("allowed") + line("not-consented"));
  const result = await running;
  expect(result.sent).toBe(1);
  expect(received).toHaveLength(1);
  expect(received[0]).toContain("allowed");
  expect(received[0]).not.toContain("not-consented");
});

it("forwards token observations for a consented session whose repository is uncertain", async () => {
  const home = await mkdtemp(join(tmpdir(), "aidd-sync-uncertain-repo-"));
  dirs.push(home);
  const captureDir = join(home, ".local/share/aidd-otel-observation");
  await mkdir(captureDir, { recursive: true, mode: 0o700 });
  const capture = join(captureDir, "codex.jsonl");
  await writeFile(capture, "", { mode: 0o600 });
  const received: string[] = [];
  const abort = new AbortController();
  server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    request.on("end", () => {
      received.push(body);
      response.writeHead(200).end("{}");
      abort.abort();
    });
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("No test port");
  const admission = {
    feature: { state: "ambiguous" as const },
    cwd: "/project",
    repositoryId: null,
  };
  const running = syncAllOtel(
    {
      config: "codex",
      tenant: "tenant",
      endpoint: `http://127.0.0.1:${address.port}`,
      token: "test-token",
      home,
      stateDir: join(home, "state"),
      signal: abort.signal,
      intervalMs: 10,
    },
    async () => new Map([["allowed", admission]]),
    async () => "allow"
  );
  await new Promise((resolve) => setTimeout(resolve, 80));
  await appendFile(capture, line("allowed"));
  const result = await running;
  expect(result.sent).toBe(1);
  expect(received[0]).toContain("input_token_count");
  expect(received[0]).not.toContain("aidd.session_feature");
});

it("invalidates an in-memory binding after a repository change before forwarding new tokens", async () => {
  const home = await mkdtemp(join(tmpdir(), "aidd-sync-origin-change-"));
  dirs.push(home);
  const captureDir = join(home, ".local/share/aidd-otel-observation");
  await mkdir(captureDir, { recursive: true, mode: 0o700 });
  const capture = join(captureDir, "codex.jsonl");
  await writeFile(capture, "", { mode: 0o600 });
  const received: string[] = [];
  const abort = new AbortController();
  let changed = false;
  server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    request.on("end", async () => {
      received.push(body);
      if (body.includes("aidd.session_feature_invalidated")) {
        await appendFile(capture, line("allowed"));
      } else if (body.includes("aidd.session_feature")) {
        changed = true;
        await appendFile(capture, line("allowed"));
      }
      response.writeHead(200).end("{}");
      if (
        changed &&
        !body.includes("aidd.session_feature") &&
        received.some((item) => item.includes("aidd.session_feature_invalidated"))
      )
        abort.abort();
    });
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("No test port");
  const known = {
    feature: { state: "confirmed" as const, feature: "owner/repo#7", branch: "work" },
    cwd: "/project",
    repositoryId: "repo-a",
  };
  const uncertain = {
    feature: { state: "ambiguous" as const },
    cwd: "/project",
    repositoryId: null,
  };
  const timeout = setTimeout(() => abort.abort(), 3000);
  const running = syncAllOtel(
    {
      config: "codex",
      tenant: "tenant",
      endpoint: `http://127.0.0.1:${address.port}`,
      token: "test-token",
      home,
      stateDir: join(home, "state"),
      signal: abort.signal,
      intervalMs: 10,
      refreshMs: 20,
    },
    async () => new Map([["allowed", changed ? uncertain : known]]),
    async () => "allow"
  );
  await new Promise((resolve) => setTimeout(resolve, 80));
  await appendFile(capture, line("allowed"));
  const result = await running;
  clearTimeout(timeout);
  const invalidation = received.findIndex((body) =>
    body.includes("aidd.session_feature_invalidated")
  );
  expect(invalidation).toBeGreaterThan(0);
  expect(received.slice(invalidation + 1).some((body) => body.includes("input_token_count"))).toBe(
    true
  );
  expect(result.pending).toBe(0);
});

it("retries a denial caused by an admission changing during the consent check", async () => {
  const home = await mkdtemp(join(tmpdir(), "aidd-sync-stale-admission-"));
  dirs.push(home);
  const captureDir = join(home, ".local/share/aidd-otel-observation");
  await mkdir(captureDir, { recursive: true, mode: 0o700 });
  const capture = join(captureDir, "codex.jsonl");
  await writeFile(capture, "", { mode: 0o600 });
  const received: string[] = [];
  const abort = new AbortController();
  server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    request.on("end", () => {
      received.push(body);
      response.writeHead(200).end("{}");
      abort.abort();
    });
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("No test port");
  const known = { feature: { state: "unbound" as const }, cwd: "/project", repositoryId: "repo" };
  const uncertain = {
    feature: { state: "ambiguous" as const },
    cwd: "/project",
    repositoryId: null,
  };
  let changed = false;
  const timeout = setTimeout(() => abort.abort(), 3000);
  const running = syncAllOtel(
    {
      config: "codex",
      tenant: "tenant",
      endpoint: `http://127.0.0.1:${address.port}`,
      token: "test-token",
      home,
      stateDir: join(home, "state"),
      signal: abort.signal,
      intervalMs: 10,
      refreshMs: 20,
    },
    async () => new Map([["allowed", changed ? uncertain : known]]),
    async (admission) => {
      if (admission.repositoryId !== null) {
        changed = true;
        return "deny";
      }
      return "allow";
    }
  );
  await new Promise((resolve) => setTimeout(resolve, 80));
  await appendFile(capture, line("allowed"));
  const result = await running;
  clearTimeout(timeout);
  expect(result.denied).toBe(0);
  expect(received.some((body) => body.includes("input_token_count"))).toBe(true);
});

it("forwards consented observations when the same capture line also contains denied or undated records", async () => {
  const home = await mkdtemp(join(tmpdir(), "aidd-sync-mixed-consent-"));
  dirs.push(home);
  const captureDir = join(home, ".local/share/aidd-otel-observation");
  await mkdir(captureDir, { recursive: true, mode: 0o700 });
  const capture = join(captureDir, "codex.jsonl");
  await writeFile(capture, "", { mode: 0o600 });
  const received: string[] = [];
  const abort = new AbortController();
  server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    request.on("end", () => {
      received.push(body);
      response.writeHead(200).end("{}");
      abort.abort();
    });
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("No test port");
  const admission = {
    feature: { state: "unbound" as const },
    cwd: "/project",
    repositoryId: "repo",
  };
  const validAt = new Date(1793763900000).toISOString();
  const running = syncAllOtel(
    {
      config: "codex",
      tenant: "tenant",
      endpoint: `http://127.0.0.1:${address.port}`,
      token: "test-token",
      home,
      stateDir: join(home, "state"),
      signal: abort.signal,
      intervalMs: 10,
    },
    async () => new Map([["allowed", admission]]),
    async (_admission, at) => (at === validAt ? "allow" : "deny"),
    async (_admission, at) => (at === validAt ? "a".repeat(64) : null)
  );
  const payload = JSON.parse(line("allowed"));
  const records = payload.payload.resourceLogs[0].scopeLogs[0].logRecords;
  const valid = records[0];
  const denied = structuredClone(valid);
  denied.timeUnixNano = "1793763800000000000";
  denied.attributes.find(
    (entry: { key: string }) => entry.key === "input_token_count"
  ).value.stringValue = "17";
  const undated = structuredClone(valid);
  delete undated.timeUnixNano;
  undated.attributes.find(
    (entry: { key: string }) => entry.key === "input_token_count"
  ).value.stringValue = "28";
  records.push(denied, undated);
  await new Promise((resolve) => setTimeout(resolve, 80));
  await appendFile(capture, `${JSON.stringify(payload)}\n`);
  const result = await running;
  expect(result.denied).toBe(2);
  expect(result.pending).toBe(0);
  expect(received).toHaveLength(1);
  expect(received[0]).toContain('"42"');
  expect(received[0]).not.toContain('"17"');
  expect(received[0]).not.toContain('"28"');
});

it("waits for every consent verdict before sending a capture line once", async () => {
  const home = await mkdtemp(join(tmpdir(), "aidd-sync-unknown-batch-"));
  dirs.push(home);
  const captureDir = join(home, ".local/share/aidd-otel-observation");
  await mkdir(captureDir, { recursive: true, mode: 0o700 });
  const capture = join(captureDir, "codex.jsonl");
  await writeFile(capture, "", { mode: 0o600 });
  const received: string[] = [];
  const abort = new AbortController();
  server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    request.on("end", () => {
      received.push(body);
      response.writeHead(200).end("{}");
      abort.abort();
    });
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("No test port");
  const admission = {
    feature: { state: "unbound" as const },
    cwd: "/project",
    repositoryId: "repo",
  };
  const firstAt = new Date(1793763900000).toISOString();
  let ready = false;
  const timeout = setTimeout(() => abort.abort(), 3000);
  const running = syncAllOtel(
    {
      config: "codex",
      tenant: "tenant",
      endpoint: `http://127.0.0.1:${address.port}`,
      token: "test-token",
      home,
      stateDir: join(home, "state"),
      signal: abort.signal,
      intervalMs: 10,
      refreshMs: 20,
    },
    async () => new Map([["allowed", admission]]),
    async (_admission, at) => (at === firstAt || ready ? "allow" : "unknown"),
    async () => "a".repeat(64)
  );
  const payload = JSON.parse(line("allowed"));
  const records = payload.payload.resourceLogs[0].scopeLogs[0].logRecords;
  const second = structuredClone(records[0]);
  second.timeUnixNano = "1793763901000000000";
  records.push(second);
  await new Promise((resolve) => setTimeout(resolve, 80));
  await appendFile(capture, `${JSON.stringify(payload)}\n`);
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(received).toHaveLength(0);
  ready = true;
  const result = await running;
  clearTimeout(timeout);
  expect(result.pending).toBe(0);
  expect(received).toHaveLength(1);
  expect(received[0]).toContain("1793763900000000000");
  expect(received[0]).toContain("1793763901000000000");
});

it("keeps an oversized line pending without sending a partial batch", async () => {
  const home = await mkdtemp(join(tmpdir(), "aidd-sync-oversize-batch-"));
  dirs.push(home);
  const captureDir = join(home, ".local/share/aidd-otel-observation");
  await mkdir(captureDir, { recursive: true, mode: 0o700 });
  const capture = join(captureDir, "codex.jsonl");
  await writeFile(capture, "", { mode: 0o600 });
  let received = 0;
  server = createServer((request, response) => {
    request.resume();
    received++;
    response.writeHead(200).end("{}");
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("No test port");
  const admission = {
    feature: { state: "unbound" as const },
    cwd: "/project",
    repositoryId: "repo",
  };
  const abort = new AbortController();
  const running = syncAllOtel(
    {
      config: "codex",
      tenant: "tenant",
      endpoint: `http://127.0.0.1:${address.port}`,
      token: "test-token",
      home,
      stateDir: join(home, "state"),
      signal: abort.signal,
      intervalMs: 10,
    },
    async () => new Map([["allowed", admission]]),
    async () => "allow",
    async () => "a".repeat(64)
  );
  const payload = JSON.parse(line("allowed"));
  const records = payload.payload.resourceLogs[0].scopeLogs[0].logRecords;
  records[0].attributes.push(attribute("model", "x".repeat(1_100_000)));
  records.push(structuredClone(records[0]));
  await new Promise((resolve) => setTimeout(resolve, 80));
  await appendFile(capture, `${JSON.stringify(payload)}\n`);
  await new Promise((resolve) => setTimeout(resolve, 200));
  abort.abort();
  const result = await running;
  expect(result.pending).toBe(1);
  expect(received).toBe(0);
});

it("keeps one oversized observation pending and continues with the next line", async () => {
  const home = await mkdtemp(join(tmpdir(), "aidd-sync-single-oversize-"));
  dirs.push(home);
  const captureDir = join(home, ".local/share/aidd-otel-observation");
  await mkdir(captureDir, { recursive: true, mode: 0o700 });
  const capture = join(captureDir, "codex.jsonl");
  await writeFile(capture, "", { mode: 0o600 });
  const received: string[] = [];
  const abort = new AbortController();
  server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    request.on("end", () => {
      received.push(body);
      response.writeHead(200).end("{}");
      abort.abort();
    });
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("No test port");
  const admission = {
    feature: { state: "unbound" as const },
    cwd: "/project",
    repositoryId: "repo",
  };
  const timeout = setTimeout(() => abort.abort(), 3000);
  const running = syncAllOtel(
    {
      config: "codex",
      tenant: "tenant",
      endpoint: `http://127.0.0.1:${address.port}`,
      token: "test-token",
      home,
      stateDir: join(home, "state"),
      signal: abort.signal,
      intervalMs: 10,
    },
    async () => new Map([["allowed", admission]]),
    async () => "allow",
    async () => "a".repeat(64)
  );
  const payload = JSON.parse(line("allowed"));
  payload.payload.resourceLogs[0].scopeLogs[0].logRecords[0].attributes.push(
    attribute("model", "x".repeat(2_100_000))
  );
  await new Promise((resolve) => setTimeout(resolve, 80));
  await appendFile(capture, `${JSON.stringify(payload)}\n${line("allowed")}`);
  const result = await running;
  clearTimeout(timeout);
  expect(result.pending).toBe(1);
  expect(received).toHaveLength(1);
  expect(received[0]).toContain("input_token_count");
  expect(received[0]).not.toContain("xxxxxxxxxxxxxxxxxxxxxxxx");
});

it("replays a held v2 range after restart only for the original consented clone", async () => {
  const home = await mkdtemp(join(tmpdir(), "aidd-sync-pending-v2-"));
  dirs.push(home);
  const captureDir = join(home, ".local/share/aidd-otel-observation");
  await mkdir(captureDir, { recursive: true, mode: 0o700 });
  const capture = join(captureDir, "codex.jsonl");
  await writeFile(capture, "", { mode: 0o600 });
  const received: string[] = [];
  server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    request.on("end", () => {
      received.push(body);
      response.writeHead(200).end("{}");
    });
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("No test port");
  const options = {
    config: "codex" as const,
    tenant: "tenant",
    endpoint: `http://127.0.0.1:${address.port}`,
    token: "test-token",
    home,
    stateDir: join(home, "state"),
    intervalMs: 10,
    refreshMs: 20,
  };
  const known = { feature: { state: "unbound" as const }, cwd: "/project", repositoryId: "repo" };
  const uncertain = {
    feature: { state: "ambiguous" as const },
    cwd: "/project",
    repositoryId: null,
  };
  const firstAbort = new AbortController();
  const first = syncAllOtel(
    { ...options, signal: firstAbort.signal },
    async () => new Map([["allowed", known]]),
    async (_admission, _at, _start, current) => (current ? "unknown" : "allow"),
    async () => "a".repeat(64)
  );
  await new Promise((resolve) => setTimeout(resolve, 80));
  await appendFile(capture, line("allowed"));
  await new Promise((resolve) => setTimeout(resolve, 100));
  firstAbort.abort();
  expect((await first).pending).toBe(1);
  const secondAbort = new AbortController();
  const second = syncAllOtel(
    { ...options, signal: secondAbort.signal },
    async () => new Map([["allowed", uncertain]]),
    async () => "allow",
    async () => "b".repeat(64)
  );
  await new Promise((resolve) => setTimeout(resolve, 100));
  secondAbort.abort();
  expect((await second).pending).toBe(1);
  expect(received).toHaveLength(0);
  const thirdAbort = new AbortController();
  const third = syncAllOtel(
    { ...options, signal: thirdAbort.signal },
    async () => new Map([["allowed", uncertain]]),
    async () => "allow",
    async () => "a".repeat(64)
  );
  await new Promise((resolve) => setTimeout(resolve, 100));
  thirdAbort.abort();
  expect((await third).pending).toBe(0);
  expect(received.some((body) => body.includes("input_token_count"))).toBe(true);
});

it("replays a failed post from its last durable checkpoint", async () => {
  const home = await mkdtemp(join(tmpdir(), "aidd-sync-all-retry-"));
  dirs.push(home);
  const captureDir = join(home, ".local/share/aidd-otel-observation");
  await mkdir(captureDir, { recursive: true, mode: 0o700 });
  const capture = join(captureDir, "codex.jsonl");
  await writeFile(capture, "", { mode: 0o600 });
  let fail = true;
  let calls = 0;
  const abort = new AbortController();
  server = createServer((request, response) => {
    request.resume();
    request.on("end", () => {
      calls++;
      response.writeHead(fail ? 403 : 200).end("{}");
      if (!fail) abort.abort();
    });
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("No test port");
  const options = {
    config: "codex" as const,
    tenant: "tenant",
    endpoint: `http://127.0.0.1:${address.port}`,
    token: "test-token",
    home,
    stateDir: join(home, "state"),
    intervalMs: 10,
  };
  const admission = {
    feature: { state: "unbound" as const },
    cwd: "/project",
    repositoryId: "repo",
  };
  const snapshot = async () => new Map([["allowed", admission]]);
  const first = syncAllOtel(options, snapshot, async () => "allow");
  await new Promise((resolve) => setTimeout(resolve, 80));
  await appendFile(capture, line("allowed"));
  await expect(first).rejects.toThrow("HTTP 403");
  fail = false;
  const result = await syncAllOtel(
    { ...options, signal: abort.signal },
    snapshot,
    async () => "allow"
  );
  expect(result.sent).toBe(1);
  expect(calls).toBe(2);
});

it("retries a transient HTTP failure without losing its checkpoint", async () => {
  const home = await mkdtemp(join(tmpdir(), "aidd-sync-retry-live-"));
  dirs.push(home);
  const captureDir = join(home, ".local/share/aidd-otel-observation");
  await mkdir(captureDir, { recursive: true, mode: 0o700 });
  const capture = join(captureDir, "codex.jsonl");
  await writeFile(capture, "", { mode: 0o600 });
  const abort = new AbortController();
  let calls = 0;
  server = createServer((request, response) => {
    request.resume();
    request.on("end", () => {
      calls++;
      response.writeHead(calls === 1 ? 503 : 200).end("{}");
      if (calls > 1) abort.abort();
    });
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("No test port");
  const admission = {
    feature: { state: "unbound" as const },
    cwd: "/project",
    repositoryId: "repo",
  };
  const running = syncAllOtel(
    {
      config: "codex",
      tenant: "tenant",
      endpoint: `http://127.0.0.1:${address.port}`,
      token: "test-token",
      home,
      stateDir: join(home, "state"),
      signal: abort.signal,
      intervalMs: 10,
    },
    async () => new Map([["allowed", admission]]),
    async () => "allow"
  );
  await new Promise((resolve) => setTimeout(resolve, 80));
  await appendFile(capture, line("allowed"));
  const result = await running;
  expect(calls).toBe(2);
  expect(result.sent).toBe(1);
});

it("retains an unsent capture across consent withdrawal and resumes only after consent returns", async () => {
  const home = await mkdtemp(join(tmpdir(), "aidd-sync-withdrawn-all-"));
  dirs.push(home);
  const captureDir = join(home, ".local/share/aidd-otel-observation");
  await mkdir(captureDir, { recursive: true, mode: 0o700 });
  const capture = join(captureDir, "codex.jsonl");
  await writeFile(capture, "", { mode: 0o600 });
  let consenting = true;
  let calls = 0;
  const abort = new AbortController();
  const firstAbort = new AbortController();
  server = createServer((request, response) => {
    request.resume();
    request.on("end", () => {
      calls++;
      if (calls === 1) {
        consenting = false;
        response.writeHead(503).end("{}");
        setTimeout(() => firstAbort.abort(), 100);
      } else {
        response.writeHead(200).end("{}");
        abort.abort();
      }
    });
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  const options = {
    config: "codex" as const,
    tenant: "tenant",
    endpoint: `http://127.0.0.1:${address.port}`,
    token: "test-token",
    home,
    stateDir: join(home, "state"),
    intervalMs: 10,
  };
  const admission = {
    feature: { state: "unbound" as const },
    cwd: "/project",
    repositoryId: "repo",
  };
  const snapshot = async () => new Map([["allowed", admission]]);
  const historical = new Date(1_793_763_900_000).toISOString();
  const permits = async (_admission: unknown, at: string, _start?: string, current?: string) =>
    at === historical && (!current || consenting) ? ("allow" as const) : ("deny" as const);
  const first = syncAllOtel({ ...options, signal: firstAbort.signal }, snapshot, permits);
  await new Promise((resolve) => setTimeout(resolve, 80));
  await appendFile(capture, line("allowed"));
  expect(await first).toMatchObject({ sent: 0, pending: 1 });
  expect(calls).toBe(1);
  consenting = true;
  const result = await syncAllOtel({ ...options, signal: abort.signal }, snapshot, permits);
  expect(result.sent).toBe(1);
  expect(calls).toBe(2);
});

it("isolates a revoked session across restarts while another session continues", async () => {
  const home = await mkdtemp(join(tmpdir(), "aidd-sync-two-sessions-"));
  dirs.push(home);
  const captureDir = join(home, ".local/share/aidd-otel-observation");
  await mkdir(captureDir, { recursive: true, mode: 0o700 });
  const capture = join(captureDir, "codex.jsonl");
  await writeFile(capture, "", { mode: 0o600 });
  let consenting = true;
  let historicalAllowed = true;
  let firstFailure = true;
  let abort = new AbortController();
  const accepted: string[] = [];
  const attempts: string[] = [];
  server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    request.on("end", () => {
      const id = body.includes('"stringValue":"one"') ? "one" : "two";
      attempts.push(id);
      if (id === "one" && firstFailure) {
        firstFailure = false;
        consenting = false;
        response.writeHead(503).end("{}");
      } else {
        accepted.push(id);
        response.writeHead(200).end("{}");
        abort.abort();
      }
    });
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  const options = {
    config: "codex" as const,
    tenant: "tenant",
    endpoint: `http://127.0.0.1:${address.port}`,
    token: "test-token",
    home,
    stateDir: join(home, "state"),
    intervalMs: 10,
    refreshMs: 20,
  };
  const one = { feature: { state: "unbound" as const }, cwd: "/one", repositoryId: "one-repo" };
  const two = { feature: { state: "unbound" as const }, cwd: "/two", repositoryId: "two-repo" };
  const snapshot = async () =>
    new Map([
      ["one", one],
      ["two", two],
    ]);
  const permits = async (
    admission: { repositoryId: string | null },
    _at: string,
    _start?: string,
    current?: string
  ) =>
    admission.repositoryId === "one-repo" && (!historicalAllowed || (!!current && !consenting))
      ? ("deny" as const)
      : ("allow" as const);
  const initial = JSON.parse(line("one"));
  initial.payload.resourceLogs[0].scopeLogs[0].logRecords.push(
    JSON.parse(line("two")).payload.resourceLogs[0].scopeLogs[0].logRecords[0]
  );
  const first = syncAllOtel({ ...options, signal: abort.signal }, snapshot, permits);
  await new Promise((resolve) => setTimeout(resolve, 80));
  await appendFile(capture, `${JSON.stringify(initial)}\n`);
  expect(await first).toMatchObject({ sent: 1, pending: 1 });
  expect(attempts).toEqual(["one", "two"]);
  expect(accepted).toEqual(["two"]);

  historicalAllowed = false;
  abort = new AbortController();
  const second = syncAllOtel({ ...options, signal: abort.signal }, snapshot, permits);
  await new Promise((resolve) => setTimeout(resolve, 80));
  await appendFile(capture, line("two"));
  expect(await second).toMatchObject({ sent: 1, pending: 1 });
  expect(attempts).toEqual(["one", "two", "two"]);

  historicalAllowed = true;
  consenting = true;
  abort = new AbortController();
  const third = await syncAllOtel({ ...options, signal: abort.signal }, snapshot, permits);
  expect(third).toMatchObject({ sent: 1, pending: 0 });
  expect(accepted).toEqual(["two", "two", "one"]);
});

it("defers one revoked binding without blocking another and restores a proven identity after restart", async () => {
  const home = await mkdtemp(join(tmpdir(), "aidd-sync-two-bindings-"));
  dirs.push(home);
  const captureDir = join(home, ".local/share/aidd-otel-observation");
  await mkdir(captureDir, { recursive: true, mode: 0o700 });
  const capture = join(captureDir, "codex.jsonl");
  await writeFile(capture, "", { mode: 0o600 });
  let consenting = true;
  let failOne = true;
  let abort = new AbortController();
  const bindings: string[] = [];
  server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    request.on("end", () => {
      if (!body.includes("aidd.session_feature")) return void response.writeHead(200).end("{}");
      const id = body.includes('"stringValue":"one"') ? "one" : "two";
      bindings.push(id);
      if (id === "one" && failOne) {
        failOne = false;
        consenting = false;
        response.writeHead(503).end("{}");
      } else {
        response.writeHead(200).end("{}");
        abort.abort();
      }
    });
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  const options = {
    config: "codex" as const,
    tenant: "tenant",
    endpoint: `http://127.0.0.1:${address.port}`,
    token: "test-token",
    home,
    stateDir: join(home, "state"),
    intervalMs: 10,
    refreshMs: 20,
  };
  const feature = { state: "confirmed" as const, feature: "owner/repo#7", branch: "feature/work" };
  const one = { feature, cwd: "/one", repositoryId: "one-repo" };
  const two = { feature, cwd: "/two", repositoryId: "two-repo" };
  const snapshot = async () =>
    new Map([
      ["one", one],
      ["two", two],
    ]);
  const permits = async (admission: { repositoryId: string | null }) =>
    admission.repositoryId === "one-repo" && !consenting ? ("deny" as const) : ("allow" as const);
  const first = syncAllOtel({ ...options, signal: abort.signal }, snapshot, permits);
  await new Promise((resolve) => setTimeout(resolve, 80));
  await appendFile(capture, line("one") + line("two"));
  await first;
  expect(bindings).toEqual(["one", "two"]);
  consenting = true;
  abort = new AbortController();
  setTimeout(() => abort.abort(), 150);
  await syncAllOtel({ ...options, signal: abort.signal }, snapshot, permits);
  expect(bindings).toEqual(["one", "two", "one", "two"]);
});

it.each(["missing", "cwd", "repository", "unavailable"] as const)(
  "does not retry if the session admission is %s after a failed post",
  async (change) => {
    const home = await mkdtemp(join(tmpdir(), "aidd-sync-admission-retry-"));
    dirs.push(home);
    const captureDir = join(home, ".local/share/aidd-otel-observation");
    await mkdir(captureDir, { recursive: true, mode: 0o700 });
    const capture = join(captureDir, "codex.jsonl");
    await writeFile(capture, "", { mode: 0o600 });
    let changed = false;
    let calls = 0;
    const abort = new AbortController();
    server = createServer((request, response) => {
      calls++;
      request.resume();
      request.on("end", () => {
        changed = true;
        response.writeHead(503).end("{}");
        setTimeout(() => abort.abort(), 100);
      });
    });
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No test port");
    const admission = {
      feature: { state: "unbound" as const },
      cwd: "/project",
      repositoryId: "repo",
    };
    const running = syncAllOtel(
      {
        config: "codex",
        tenant: "tenant",
        endpoint: `http://127.0.0.1:${address.port}`,
        token: "test-token",
        home,
        stateDir: join(home, "state"),
        intervalMs: 10,
        signal: abort.signal,
      },
      async () => {
        if (changed && change === "unavailable") throw new Error("Admission unavailable");
        if (changed && change === "missing") return new Map();
        return new Map([
          [
            "allowed",
            {
              ...admission,
              cwd: changed && change === "cwd" ? "/elsewhere" : admission.cwd,
              repositoryId: changed && change === "repository" ? "other" : admission.repositoryId,
            },
          ],
        ]);
      },
      async () => "allow"
    );
    await new Promise((resolve) => setTimeout(resolve, 80));
    await appendFile(capture, line("allowed"));
    if (change === "unavailable") await expect(running).rejects.toThrow(/Admission unavailable/);
    else expect(await running).toMatchObject({ sent: 0, pending: 1 });
    expect(calls).toBe(1);
  }
);

it("does not use an outside-consent identity for a later feature binding", async () => {
  const home = await mkdtemp(join(tmpdir(), "aidd-sync-unconsented-all-"));
  dirs.push(home);
  const captureDir = join(home, ".local/share/aidd-otel-observation");
  await mkdir(captureDir, { recursive: true, mode: 0o700 });
  const capture = join(captureDir, "codex.jsonl");
  await writeFile(capture, "", { mode: 0o600 });
  let calls = 0;
  server = createServer((request, response) => {
    calls++;
    request.resume();
    response.writeHead(200).end("{}");
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  const abort = new AbortController();
  const admission = {
    feature: { state: "confirmed" as const, feature: "owner/repo#7", branch: "feature/work" },
    cwd: "/project",
    repositoryId: "repo",
  };
  const historical = new Date(1_793_763_900_000).toISOString();
  const running = syncAllOtel(
    {
      config: "codex",
      tenant: "tenant",
      endpoint: `http://127.0.0.1:${address.port}`,
      token: "test-token",
      home,
      stateDir: join(home, "state"),
      intervalMs: 10,
      signal: abort.signal,
    },
    async () => new Map([["allowed", admission]]),
    async (_admission, at) => (at === historical ? "deny" : "allow")
  );
  await new Promise((resolve) => setTimeout(resolve, 80));
  await appendFile(capture, line("allowed"));
  await new Promise((resolve) => setTimeout(resolve, 100));
  abort.abort();
  const result = await running;
  expect(result).toMatchObject({ sent: 0, denied: 1 });
  expect(calls).toBe(0);
});

it("does not reuse legacy checkpoint identity until a new admitted observation supplies it", async () => {
  const home = await mkdtemp(join(tmpdir(), "aidd-sync-legacy-identity-"));
  dirs.push(home);
  const captureDir = join(home, ".local/share/aidd-otel-observation");
  await mkdir(captureDir, { recursive: true, mode: 0o700 });
  const capture = join(captureDir, "codex.jsonl");
  await writeFile(capture, "", { mode: 0o600 });
  const received: string[] = [];
  let abort = new AbortController();
  server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    request.on("end", () => {
      received.push(body);
      response.writeHead(200).end("{}");
      if (body.includes("aidd.session_feature")) abort.abort();
    });
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  const options = {
    config: "codex" as const,
    tenant: "tenant",
    endpoint: `http://127.0.0.1:${address.port}`,
    token: "test-token",
    home,
    stateDir: join(home, "state"),
    intervalMs: 10,
  };
  const admission = {
    feature: { state: "confirmed" as const, feature: "owner/repo#7", branch: "feature/work" },
    cwd: "/project",
    repositoryId: "repo",
  };
  const snapshot = async () => new Map([["allowed", admission]]);
  const first = syncAllOtel({ ...options, signal: abort.signal }, snapshot, async () => "allow");
  await new Promise((resolve) => setTimeout(resolve, 80));
  await appendFile(capture, line("allowed"));
  await first;
  expect(received.some((body) => body.includes("aidd.session_feature"))).toBe(true);
  const directory = join(home, "state", "otel-sync");
  const stateFile = (await readdir(directory)).find(
    (name) => name.endsWith(".json") && !name.includes("checkpoint")
  );
  if (!stateFile) throw new Error("Missing binding state");
  const path = join(directory, stateFile);
  const legacy = JSON.parse(await readFile(path, "utf8"));
  delete legacy.identityConsentChecked;
  delete legacy.identityProof;
  await writeFile(path, JSON.stringify(legacy), { mode: 0o600 });
  received.length = 0;
  abort = new AbortController();
  const restart = syncAllOtel({ ...options, signal: abort.signal }, snapshot, async () => "allow");
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(received).toHaveLength(0);
  await appendFile(capture, line("allowed"));
  await new Promise((resolve) => setTimeout(resolve, 100));
  abort.abort();
  await restart;
  expect(received.filter((body) => body.includes("aidd.session_feature"))).toHaveLength(0);
  expect(received.some((body) => body.includes("developer@example.test"))).toBe(true);
});

it("does not reuse an identity when a clone at the same path and repository is replaced", async () => {
  const home = await mkdtemp(join(tmpdir(), "aidd-sync-replaced-clone-"));
  dirs.push(home);
  const captureDir = join(home, ".local/share/aidd-otel-observation");
  await mkdir(captureDir, { recursive: true, mode: 0o700 });
  const capture = join(captureDir, "codex.jsonl");
  await writeFile(capture, "", { mode: 0o600 });
  const received: string[] = [];
  server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    request.on("end", () => {
      received.push(body);
      response.writeHead(200).end("{}");
    });
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  const options = {
    config: "codex" as const,
    tenant: "tenant",
    endpoint: `http://127.0.0.1:${address.port}`,
    token: "test-token",
    home,
    stateDir: join(home, "state"),
    intervalMs: 10,
    refreshMs: 20,
  };
  let changed = false;
  const oldAt = new Date(1_793_763_900_000).toISOString();
  const snapshot = async () =>
    new Map([
      [
        "allowed",
        {
          feature: changed
            ? { state: "unbound" as const }
            : { state: "confirmed" as const, feature: "owner/repo#7", branch: "feature/work" },
          cwd: "/project",
          repositoryId: "repo",
        },
      ],
    ]);
  const permits = async (_admission: unknown, at: string, _start?: string, current?: string) =>
    changed && current && at === oldAt ? ("deny" as const) : ("allow" as const);
  const abort = new AbortController();
  const first = syncAllOtel({ ...options, signal: abort.signal }, snapshot, permits);
  await new Promise((resolve) => setTimeout(resolve, 80));
  await appendFile(capture, line("allowed"));
  for (let i = 0; i < 100 && !received.some((body) => body.includes('aidd.session_feature"')); i++)
    await new Promise((resolve) => setTimeout(resolve, 20));
  expect(received.some((body) => body.includes('aidd.session_feature"'))).toBe(true);
  changed = true;
  const replacement = JSON.parse(
    line("allowed").replace("developer@example.test", "replacement@example.test")
  );
  replacement.payload.resourceLogs[0].scopeLogs[0].logRecords[0].timeUnixNano =
    "1793763901000000000";
  await appendFile(capture, `${JSON.stringify(replacement)}\n`);
  await new Promise((resolve) => setTimeout(resolve, 150));
  abort.abort();
  await first;
  expect(received.some((body) => body.includes("replacement@example.test"))).toBe(true);
  expect(received.some((body) => body.includes("aidd.session_feature_invalidated"))).toBe(false);
  const beforeRestart = received.length;
  const restartAbort = new AbortController();
  const restart = syncAllOtel({ ...options, signal: restartAbort.signal }, snapshot, permits);
  await new Promise((resolve) => setTimeout(resolve, 120));
  restartAbort.abort();
  await restart;
  expect(received).toHaveLength(beforeRestart);
});

it("does not send an event outside the clone's consent interval", async () => {
  const home = await mkdtemp(join(tmpdir(), "aidd-sync-all-consent-"));
  dirs.push(home);
  const captureDir = join(home, ".local/share/aidd-otel-observation");
  await mkdir(captureDir, { recursive: true, mode: 0o700 });
  const capture = join(captureDir, "codex.jsonl");
  await writeFile(capture, "", { mode: 0o600 });
  let calls = 0;
  server = createServer((request, response) => {
    calls++;
    request.resume();
    response.writeHead(200).end("{}");
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("No test port");
  const abort = new AbortController();
  const admission = {
    feature: { state: "unbound" as const },
    cwd: "/project",
    repositoryId: "repo",
  };
  const running = syncAllOtel(
    {
      config: "codex",
      tenant: "tenant",
      endpoint: `http://127.0.0.1:${address.port}`,
      token: "test-token",
      home,
      stateDir: join(home, "state"),
      signal: abort.signal,
      intervalMs: 10,
    },
    async () => new Map([["allowed", admission]]),
    async () => "deny"
  );
  await new Promise((resolve) => setTimeout(resolve, 80));
  await appendFile(capture, line("allowed"));
  await new Promise((resolve) => setTimeout(resolve, 100));
  abort.abort();
  const result = await running;
  expect(result.denied).toBe(1);
  expect(calls).toBe(0);
});

it("recovers an interrupted pending append without losing either session on the same line", async () => {
  const home = await mkdtemp(join(tmpdir(), "aidd-sync-all-pending-"));
  dirs.push(home);
  const captureDir = join(home, ".local/share/aidd-otel-observation");
  await mkdir(captureDir, { recursive: true, mode: 0o700 });
  const capture = join(captureDir, "codex.jsonl");
  await writeFile(capture, "", { mode: 0o600 });
  const received: string[] = [];
  server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    request.on("end", () => {
      received.push(body);
      response.writeHead(200).end("{}");
    });
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("No test port");
  const options = {
    config: "codex" as const,
    tenant: "tenant",
    endpoint: `http://127.0.0.1:${address.port}`,
    token: "test-token",
    home,
    stateDir: join(home, "state"),
    intervalMs: 10,
  };
  const admission = {
    feature: { state: "unbound" as const },
    cwd: "/project",
    repositoryId: "repo",
  };
  const firstAbort = new AbortController();
  const first = syncAllOtel(
    { ...options, signal: firstAbort.signal },
    async () => new Map([["allowed", admission]]),
    async () => "allow"
  );
  await new Promise((resolve) => setTimeout(resolve, 80));
  await expect(
    syncAllOtel(
      options,
      async () => new Map(),
      async () => "allow"
    )
  ).rejects.toThrow(/lock/i);
  const combined = JSON.parse(line("allowed"));
  combined.payload.resourceLogs[0].scopeLogs[0].logRecords.push(
    JSON.parse(line("waiting")).payload.resourceLogs[0].scopeLogs[0].logRecords[0]
  );
  await appendFile(capture, `${JSON.stringify(combined)}\n`);
  await new Promise((resolve) => setTimeout(resolve, 100));
  firstAbort.abort();
  await first;
  expect(received).toHaveLength(1);
  expect(received[0]).toContain("allowed");
  const stateFiles = await readdir(join(home, "state", "otel-sync"));
  const pendingDirectory = join(
    home,
    "state",
    "otel-sync",
    stateFiles.find((name) => name.endsWith(".pending")) ?? "missing"
  );
  const pending = join(pendingDirectory, (await readdir(pendingDirectory))[0]);
  await appendFile(pending, "123"); // interrupted append before its checkpoint
  await appendFile(capture, line("waiting"));
  const secondAbort = new AbortController();
  const second = syncAllOtel(
    { ...options, signal: secondAbort.signal },
    async () => new Map(),
    async () => "allow"
  );
  await new Promise((resolve) => setTimeout(resolve, 100));
  secondAbort.abort();
  await second;
  expect((await readFile(pending, "utf8")).trim().split("\n")).toHaveLength(2);
  const thirdAbort = new AbortController();
  const third = syncAllOtel(
    { ...options, signal: thirdAbort.signal },
    async () => new Map([["waiting", admission]]),
    async () => "allow"
  );
  await new Promise((resolve) => setTimeout(resolve, 100));
  thirdAbort.abort();
  await third;
  expect(received).toHaveLength(3);
  expect(
    received.slice(1).every((body) => body.includes("waiting") && !body.includes('"allowed"'))
  ).toBe(true);
});

it("invalidates a v2 binding after restart only for the original consented clone", async () => {
  const home = await mkdtemp(join(tmpdir(), "aidd-sync-binding-v2-"));
  dirs.push(home);
  const captureDir = join(home, ".local/share/aidd-otel-observation");
  await mkdir(captureDir, { recursive: true, mode: 0o700 });
  const capture = join(captureDir, "codex.jsonl");
  await writeFile(capture, "", { mode: 0o600 });
  const received: string[] = [];
  server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    request.on("end", () => {
      received.push(body);
      response.writeHead(200).end("{}");
    });
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("No test port");
  const options = {
    config: "codex" as const,
    tenant: "tenant",
    endpoint: `http://127.0.0.1:${address.port}`,
    token: "test-token",
    home,
    stateDir: join(home, "state"),
    intervalMs: 10,
  };
  const admission = {
    feature: { state: "confirmed" as const, branch: "work", feature: "owner/repo#1" },
    cwd: "/project",
    repositoryId: "repo",
  };
  const uncertain = {
    feature: { state: "ambiguous" as const },
    cwd: "/project",
    repositoryId: null,
  };
  const firstAbort = new AbortController();
  const first = syncAllOtel(
    { ...options, signal: firstAbort.signal },
    async () => new Map([["allowed", admission]]),
    async () => "allow",
    async () => "a".repeat(64)
  );
  await new Promise((resolve) => setTimeout(resolve, 80));
  await appendFile(capture, line("allowed"));
  await new Promise((resolve) => setTimeout(resolve, 120));
  firstAbort.abort();
  await first;
  expect(received.some((body) => body.includes('aidd.session_feature"'))).toBe(true);
  const secondAbort = new AbortController();
  const second = syncAllOtel(
    { ...options, signal: secondAbort.signal },
    async () => new Map([["allowed", uncertain]]),
    async () => "allow",
    async () => "b".repeat(64)
  );
  await new Promise((resolve) => setTimeout(resolve, 100));
  secondAbort.abort();
  await second;
  expect(received.some((body) => body.includes("aidd.session_feature_invalidated"))).toBe(false);
  const thirdAbort = new AbortController();
  const third = syncAllOtel(
    { ...options, signal: thirdAbort.signal },
    async () => new Map([["allowed", uncertain]]),
    async () => "allow",
    async () => "a".repeat(64)
  );
  await new Promise((resolve) => setTimeout(resolve, 100));
  thirdAbort.abort();
  await third;
  expect(received.some((body) => body.includes("aidd.session_feature_invalidated"))).toBe(true);
});

it("invalidates a persisted feature after restart when the session becomes ambiguous", async () => {
  const home = await mkdtemp(join(tmpdir(), "aidd-sync-binding-restart-"));
  dirs.push(home);
  const captureDir = join(home, ".local/share/aidd-otel-observation");
  await mkdir(captureDir, { recursive: true, mode: 0o700 });
  const capture = join(captureDir, "codex.jsonl");
  await writeFile(capture, "", { mode: 0o600 });
  const received: string[] = [];
  server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    request.on("end", () => {
      received.push(body);
      response.writeHead(200).end("{}");
    });
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("No test port");
  const options = {
    config: "codex" as const,
    tenant: "tenant",
    endpoint: `http://127.0.0.1:${address.port}`,
    token: "test-token",
    home,
    stateDir: join(home, "state"),
    intervalMs: 10,
  };
  const admission = {
    feature: { state: "confirmed" as const, branch: "work", feature: "owner/repo#1" },
    cwd: "/project",
    repositoryId: "repo",
  };
  const firstAbort = new AbortController();
  const first = syncAllOtel(
    { ...options, signal: firstAbort.signal },
    async () => new Map([["allowed", admission]]),
    async () => "allow"
  );
  await new Promise((resolve) => setTimeout(resolve, 80));
  await appendFile(capture, line("allowed"));
  await new Promise((resolve) => setTimeout(resolve, 120));
  firstAbort.abort();
  await first;
  expect(received.some((body) => body.includes('aidd.session_feature"'))).toBe(true);
  const secondAbort = new AbortController();
  const second = syncAllOtel(
    { ...options, signal: secondAbort.signal },
    async () => new Map([["allowed", { ...admission, feature: { state: "ambiguous" as const } }]]),
    async () => "allow"
  );
  await new Promise((resolve) => setTimeout(resolve, 120));
  secondAbort.abort();
  await second;
  expect(received.some((body) => body.includes("aidd.session_feature_invalidated"))).toBe(true);
});

it("retries a feature link rejected after its intent was persisted", async () => {
  const home = await mkdtemp(join(tmpdir(), "aidd-sync-binding-retry-"));
  dirs.push(home);
  const captureDir = join(home, ".local/share/aidd-otel-observation");
  await mkdir(captureDir, { recursive: true, mode: 0o700 });
  const capture = join(captureDir, "codex.jsonl");
  await writeFile(capture, "", { mode: 0o600 });
  let reject = true;
  let links = 0;
  server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    request.on("end", () => {
      const isLink = body.includes('aidd.session_feature"');
      if (isLink) links++;
      response.writeHead(isLink && reject ? 403 : 200).end("{}");
    });
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("No test port");
  const options = {
    config: "codex" as const,
    tenant: "tenant",
    endpoint: `http://127.0.0.1:${address.port}`,
    token: "test-token",
    home,
    stateDir: join(home, "state"),
    intervalMs: 10,
  };
  const admission = {
    feature: { state: "confirmed" as const, branch: "work", feature: "owner/repo#1" },
    cwd: "/project",
    repositoryId: "repo",
  };
  const snapshot = async () => new Map([["allowed", admission]]);
  const first = syncAllOtel(options, snapshot, async () => "allow");
  await new Promise((resolve) => setTimeout(resolve, 80));
  await appendFile(capture, line("allowed"));
  await expect(first).rejects.toThrow("HTTP 403");
  reject = false;
  const abort = new AbortController();
  const second = syncAllOtel({ ...options, signal: abort.signal }, snapshot, async () => "allow");
  await new Promise((resolve) => setTimeout(resolve, 120));
  abort.abort();
  await second;
  expect(links).toBe(2);
});

it("revalidates every identity source before resuming a conflicted binding", async () => {
  const home = await mkdtemp(join(tmpdir(), "aidd-sync-conflict-"));
  dirs.push(home);
  const captureDir = join(home, ".local/share/aidd-otel-observation");
  await mkdir(captureDir, { recursive: true, mode: 0o700 });
  const capture = join(captureDir, "codex.jsonl");
  await writeFile(capture, "", { mode: 0o600 });
  let rejectInvalidation = true;
  let invalidations = 0;
  let linked = false;
  server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    request.on("end", () => {
      const invalidation = body.includes("aidd.session_feature_invalidated");
      if (invalidation) invalidations++;
      if (body.includes('aidd.session_feature"')) linked = true;
      response.writeHead(invalidation && rejectInvalidation ? 403 : 200).end("{}");
    });
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("No test port");
  const options = {
    config: "codex" as const,
    tenant: "tenant",
    endpoint: `http://127.0.0.1:${address.port}`,
    token: "test-token",
    home,
    stateDir: join(home, "state"),
    intervalMs: 10,
  };
  const admission = {
    feature: { state: "confirmed" as const, branch: "work", feature: "owner/repo#1" },
    cwd: "/project",
    repositoryId: "repo",
  };
  const snapshot = async () => new Map([["allowed", admission]]);
  const first = syncAllOtel(options, snapshot, async () => "allow");
  await new Promise((resolve) => setTimeout(resolve, 80));
  const initial = JSON.parse(line("allowed"));
  const original = initial.payload.resourceLogs[0].scopeLogs[0].logRecords[0];
  const second = structuredClone(original);
  second.timeUnixNano = "1793763900001000000";
  second.attributes = second.attributes.filter(
    (item: { key: string }) => item.key !== "user.email"
  );
  second.attributes.push(attribute("user.account_id", "account-1"));
  const third = structuredClone(original);
  third.timeUnixNano = "1793763900002000000";
  third.attributes = third.attributes.filter((item: { key: string }) => item.key !== "user.email");
  third.attributes.push(attribute("organization.id", "org-1"));
  initial.payload.resourceLogs[0].scopeLogs[0].logRecords.push(second, third);
  await appendFile(capture, `${JSON.stringify(initial)}\n`);
  for (let i = 0; i < 100 && !linked; i++) await new Promise((resolve) => setTimeout(resolve, 20));
  expect(linked).toBe(true);
  await appendFile(
    capture,
    line("allowed").replace("developer@example.test", "other@example.test")
  );
  await expect(first).rejects.toThrow("HTTP 403");
  const directory = join(home, "state", "otel-sync");
  const stateName = (await readdir(directory)).find(
    (name) => name.endsWith(".json") && !name.includes("checkpoint")
  );
  if (!stateName) throw new Error("Missing binding state");
  const saved = JSON.parse(await readFile(join(directory, stateName), "utf8"));
  expect(saved.identityProof.sources.map((source: { keys: string[] }) => source.keys)).toEqual([
    ["user.email"],
    ["user.account_id"],
    ["organization.id"],
    [],
  ]);
  rejectInvalidation = false;
  const abort = new AbortController();
  const accountAt = new Date(1_793_763_900_001).toISOString();
  const blocked = syncAllOtel(
    { ...options, signal: abort.signal },
    snapshot,
    async (_admission, at, _start, current) => (current && at === accountAt ? "deny" : "allow")
  );
  await new Promise((resolve) => setTimeout(resolve, 120));
  abort.abort();
  await blocked;
  expect(invalidations).toBe(1);
  const retryAbort = new AbortController();
  const retry = syncAllOtel(
    { ...options, signal: retryAbort.signal },
    snapshot,
    async () => "allow"
  );
  await new Promise((resolve) => setTimeout(resolve, 120));
  retryAbort.abort();
  await retry;
  expect(invalidations).toBe(2);
});

it("does not link or invalidate when identity conflicts before the first link, even after restart", async () => {
  const home = await mkdtemp(join(tmpdir(), "aidd-sync-first-conflict-"));
  dirs.push(home);
  const captureDir = join(home, ".local/share/aidd-otel-observation");
  await mkdir(captureDir, { recursive: true, mode: 0o700 });
  const capture = join(captureDir, "codex.jsonl");
  await writeFile(capture, "", { mode: 0o600 });
  const received: string[] = [];
  server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    request.on("end", () => {
      received.push(body);
      response.writeHead(200).end("{}");
    });
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("No test port");
  const options = {
    config: "codex" as const,
    tenant: "tenant",
    endpoint: `http://127.0.0.1:${address.port}`,
    token: "test-token",
    home,
    stateDir: join(home, "state"),
    intervalMs: 10,
  };
  const admission = {
    feature: { state: "confirmed" as const, branch: "work", feature: "owner/repo#1" },
    cwd: "/project",
    repositoryId: "repo",
  };
  const snapshot = async () => new Map([["allowed", admission]]);
  const firstAbort = new AbortController();
  const first = syncAllOtel(
    { ...options, signal: firstAbort.signal },
    snapshot,
    async () => "allow"
  );
  await new Promise((resolve) => setTimeout(resolve, 80));
  const combined = JSON.parse(line("allowed"));
  combined.payload.resourceLogs[0].scopeLogs[0].logRecords.push(
    JSON.parse(line("allowed").replace("developer@example.test", "other@example.test")).payload
      .resourceLogs[0].scopeLogs[0].logRecords[0]
  );
  await appendFile(capture, `${JSON.stringify(combined)}\n`);
  await new Promise((resolve) => setTimeout(resolve, 120));
  firstAbort.abort();
  await first;
  const secondAbort = new AbortController();
  const second = syncAllOtel(
    { ...options, signal: secondAbort.signal },
    snapshot,
    async () => "allow"
  );
  await new Promise((resolve) => setTimeout(resolve, 80));
  await appendFile(capture, line("allowed"));
  await new Promise((resolve) => setTimeout(resolve, 120));
  secondAbort.abort();
  await second;
  expect(received.length).toBeGreaterThan(0);
  expect(received.some((body) => body.includes("aidd.session_feature"))).toBe(false);
});
