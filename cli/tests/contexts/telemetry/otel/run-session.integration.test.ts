import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runOtel } from "../../../../src/contexts/telemetry/infrastructure/otel/actions/run.js";

const execFileAsync = promisify(execFile);
const fakeClaude = String.raw`#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
const option = (name) => args[args.indexOf(name) + 1];
const settingsPath = option("--settings");
const mode = process.env.AIDD_OTEL_TEST_MODE;
const report = {
  pid: process.pid,
  args,
  settingsPath,
  collector: new URL(process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT).origin,
  inheritedToken: process.env.AIDD_OTEL_TOKEN !== undefined,
  inheritedCustomOtel: process.env.OTEL_CUSTOM_PRIVATE !== undefined,
  localTelemetry: process.env.AIDD_TELEMETRY,
  logPrompts: process.env.OTEL_LOG_USER_PROMPTS,
  logResponses: process.env.OTEL_LOG_ASSISTANT_RESPONSES,
  rawBodies: process.env.OTEL_LOG_RAW_API_BODIES,
  traceExporter: process.env.OTEL_TRACES_EXPORTER,
  includeRepository: process.env.OTEL_METRICS_INCLUDE_REPOSITORY,
};
fs.appendFileSync(process.env.AIDD_OTEL_TEST_REPORT, JSON.stringify(report) + "\n");
if (mode === "fail") process.exit(7);
if (mode === "wait") { setInterval(() => {}, 1000); return; }
const text = (key, stringValue) => ({ key, value: { stringValue } });
const auth = process.env.OTEL_EXPORTER_OTLP_HEADERS.replace(/^Authorization=/i, "");
const resource = (session) => ({ attributes: [
  text("session.id", session), text("user.email", "person@example.test"),
  text("prompt", "private-prompt-must-not-leave"),
] });
async function main() {
  const resumed = args.includes("--resume");
  const followup = mode === "followup" || mode === "duplicate";
  const session = followup ? option(resumed ? "--resume" : "--session-id") : "session_one";
  let url, payload;
  if (followup) {
    const prompt = resumed && mode !== "duplicate" ? "prompt_two" : "prompt_one";
    const event = (name) => ({
      timeUnixNano: "1793763900000000000",
      attributes: [text("event.name", name), text("prompt.id", prompt),
        text("request_id", "request_" + prompt), text("model", "claude-test"),
        text("input_tokens", "17"), text("output_tokens", "2"),
        text("cache_read_tokens", "3"), text("cache_creation_tokens", "4"),
        text("query_source", "private-agent-name")],
    });
    url = process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT;
    payload = { resourceLogs: [{ resource: resource(session),
      scopeLogs: [{ logRecords: [event("user_prompt"), event("api_request")] }] }] };
  } else {
    const point = (id) => ({ resource: resource(id), scopeMetrics: [{ metrics: [{
      name: "claude_code.token.usage", unit: "token", sum: {
        aggregationTemporality: 2, isMonotonic: true, dataPoints: [{
          startTimeUnixNano: "1793763000000000000", timeUnixNano: "1793763900000000000",
          asInt: "17", attributes: [text("type", "input"), text("model", "claude-test"),
            text("query_source", "main")],
        }],
      },
    }] }] });
    url = process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT;
    payload = { resourceMetrics: [point(session), ...(mode === "multiple" ? [point("session_two")] : [])] };
  }
  const response = await fetch(url, { method: "POST", headers: {
    authorization: auth, "content-type": "application/json",
  }, body: JSON.stringify(payload) });
  if (!response.ok) throw new Error("collector rejected synthetic observation: " + response.status);
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
`;

type ProviderReport = {
  pid: number;
  args: string[];
  settingsPath: string;
  collector: string;
  inheritedToken: boolean;
  inheritedCustomOtel: boolean;
  localTelemetry: string;
  logPrompts: string;
  logResponses: string;
  rawBodies: string;
  traceExporter: string;
  includeRepository: string;
};

describe.skipIf(process.platform === "win32")("isolated OTLP execution", () => {
  let root: string;
  let server: Server;
  let endpoint: string;
  let status: number;
  let received: Array<{ url: string; authorization: string | undefined; body: string }>;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "aidd-run-otel-integration-"));
    await writeFile(join(root, "claude"), fakeClaude, { mode: 0o700 });
    vi.stubEnv("PATH", `${root}${process.platform === "win32" ? ";" : ":"}${process.env.PATH}`);
    vi.stubEnv("AIDD_TELEMETRY", "1");
    vi.stubEnv("AIDD_OTEL_TOKEN", "private-inherited-token");
    vi.stubEnv("OTEL_CUSTOM_PRIVATE", "private-inherited-otel");
    vi.stubEnv("AIDD_OTEL_TEST_REPORT", join(root, "provider.jsonl"));
    vi.stubEnv("AIDD_OTEL_TEST_MODE", "single");
    status = 200;
    received = [];
    server = createServer((request, response) => {
      let body = "";
      request.setEncoding("utf8");
      request.on("data", (chunk: string) => {
        body += chunk;
      });
      request.on("end", () => {
        received.push({
          url: request.url ?? "",
          authorization: request.headers.authorization,
          body,
        });
        response.writeHead(status, { "content-type": "application/json" }).end("{}");
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
    // GitHub's disposable macOS runners do not provide the user's `trash` command.
    if (process.platform === "darwin" && process.env.CI !== "true")
      await execFileAsync("trash", [root]);
    else await rm(root, { recursive: true, force: true });
  });

  function options(signal = new AbortController().signal) {
    return {
      config: "claude" as const,
      endpoint,
      tenant: "test-tenant",
      token: "receiver-token",
      cwd: root,
      prompt: "A synthetic task",
      signal,
    };
  }

  async function reports(): Promise<ProviderReport[]> {
    const file = join(root, "provider.jsonl");
    if (!existsSync(file)) return [];
    return (await readFile(file, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
  }

  it("sends an isolated metric without inherited credentials or private attributes", async () => {
    expect(await runOtel({ ...options(), model: "haiku-test", includeRepository: true })).toBe(1);
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      url: "/api/kpi/otel/test-tenant/v1/metrics",
      authorization: "Bearer receiver-token",
    });
    expect(received[0].body).toContain('"asInt":"17"');
    expect(received[0].body).toContain('"query_source"');
    expect(received[0].body).not.toContain("private-prompt-must-not-leave");
    const [report] = await reports();
    expect(report).toMatchObject({
      inheritedToken: false,
      inheritedCustomOtel: false,
      localTelemetry: "0",
      logPrompts: "0",
      logResponses: "0",
      rawBodies: "0",
      traceExporter: "none",
      includeRepository: "true",
    });
    expect(report.args).toContain("--no-session-persistence");
    expect(report.args).toContain("haiku-test");
    expect(existsSync(dirname(report.settingsPath))).toBe(false);
    await expect(
      fetch(`${report.collector}/claude/v1/metrics`, { method: "POST" })
    ).rejects.toThrow();
  });

  it("runs a follow-up in the same session and forwards two distinct request observations", async () => {
    vi.stubEnv("AIDD_OTEL_TEST_MODE", "followup");
    expect(await runOtel({ ...options(), followUp: "A follow-up" })).toBe(2);
    const [first, second] = await reports();
    const valueAfter = (args: string[], flag: string) => args[args.indexOf(flag) + 1];
    expect(valueAfter(first.args, "--session-id")).toBe(valueAfter(second.args, "--resume"));
    expect(second.args.at(-1)).toBe("A follow-up");
    expect(received).toHaveLength(2);
    expect(received.map((request) => request.url)).toEqual([
      "/api/kpi/otel/test-tenant/v1/logs",
      "/api/kpi/otel/test-tenant/v1/logs",
    ]);
    expect(received[0].body).toContain("request_prompt_one");
    expect(received[1].body).toContain("request_prompt_two");
    expect(received.map((request) => request.body).join("\n")).not.toContain("private-agent-name");
    expect(existsSync(dirname(first.settingsPath))).toBe(false);
  });

  it("rejects a follow-up that only repeats the first usage observation", async () => {
    vi.stubEnv("AIDD_OTEL_TEST_MODE", "duplicate");
    await expect(runOtel({ ...options(), followUp: "A follow-up" })).rejects.toThrow(
      "The follow-up did not emit a distinct usage observation."
    );
    expect(await reports()).toHaveLength(2);
    expect(received).toHaveLength(0);
  });

  it("refuses to send an isolated capture containing two sessions", async () => {
    vi.stubEnv("AIDD_OTEL_TEST_MODE", "multiple");
    await expect(runOtel(options())).rejects.toThrow(
      "The isolated run emitted more than one OTLP session."
    );
    const [report] = await reports();
    expect(received).toHaveLength(0);
    expect(existsSync(dirname(report.settingsPath))).toBe(false);
  });

  it("propagates a provider failure and never sends its incomplete capture", async () => {
    vi.stubEnv("AIDD_OTEL_TEST_MODE", "fail");
    await expect(runOtel(options())).rejects.toThrow(
      "claude execution did not complete successfully."
    );
    const [report] = await reports();
    expect(received).toHaveLength(0);
    expect(existsSync(dirname(report.settingsPath))).toBe(false);
  });

  it("surfaces a rejected delivery and cleans up the private capture", async () => {
    status = 400;
    await expect(runOtel(options())).rejects.toThrow(
      "Gouvernail rejected claude metrics: HTTP 400."
    );
    const [report] = await reports();
    expect(received).toHaveLength(1);
    expect(existsSync(dirname(report.settingsPath))).toBe(false);
  });

  it("does not start a provider when telemetry is disabled or execution is already cancelled", async () => {
    vi.stubEnv("AIDD_TELEMETRY", "0");
    await expect(runOtel(options())).rejects.toThrow("AIDD telemetry is disabled.");
    vi.stubEnv("AIDD_TELEMETRY", "1");
    const controller = new AbortController();
    controller.abort();
    await expect(runOtel(options(controller.signal))).rejects.toThrow(
      "OTLP execution was cancelled."
    );
    expect(await reports()).toEqual([]);
    expect(received).toHaveLength(0);
  });

  it("stops an already running provider when cancelled and closes its collector", async () => {
    vi.stubEnv("AIDD_OTEL_TEST_MODE", "wait");
    const controller = new AbortController();
    const execution = runOtel(options(controller.signal));
    await vi.waitFor(async () => expect(await reports()).toHaveLength(1), {
      interval: 25,
      timeout: 5000,
    });
    const [report] = await reports();
    controller.abort();
    await expect(execution).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(
      () => {
        expect(() => process.kill(report.pid, 0)).toThrow(
          expect.objectContaining({ code: "ESRCH" })
        );
      },
      { interval: 25, timeout: 5000 }
    );
    expect(received).toHaveLength(0);
    expect(existsSync(dirname(report.settingsPath))).toBe(false);
    await expect(
      fetch(`${report.collector}/claude/v1/metrics`, { method: "POST" })
    ).rejects.toThrow();
  });
});
