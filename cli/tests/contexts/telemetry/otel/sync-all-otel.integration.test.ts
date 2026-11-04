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

it("retains an identity conflict across a failed invalidation and restart", async () => {
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
  await appendFile(capture, line("allowed"));
  for (let i = 0; i < 100 && !linked; i++) await new Promise((resolve) => setTimeout(resolve, 20));
  expect(linked).toBe(true);
  await appendFile(
    capture,
    line("allowed").replace("developer@example.test", "other@example.test")
  );
  await expect(first).rejects.toThrow("HTTP 403");
  rejectInvalidation = false;
  const abort = new AbortController();
  const second = syncAllOtel({ ...options, signal: abort.signal }, snapshot, async () => "allow");
  await new Promise((resolve) => setTimeout(resolve, 120));
  abort.abort();
  await second;
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
