import { appendFile, mkdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { delimiter, join } from "node:path";
import { describe, expect, it } from "vitest";
import { initRepository, sandboxGitEnv } from "../helpers/git-sandbox.js";
import { createTestEnv, runCli, sandboxedEnv } from "./helpers.js";

interface LogEnvelope {
  resourceLogs: {
    scopeLogs: {
      logRecords: { attributes: { key: string; value: { stringValue: string } }[] }[];
    }[];
  }[];
}

function logAttributes(body: string): Record<string, string> {
  const payload = JSON.parse(body) as LogEnvelope;
  return Object.fromEntries(
    payload.resourceLogs.flatMap((resource) =>
      resource.scopeLogs.flatMap((scope) =>
        scope.logRecords.flatMap((record) =>
          record.attributes.map(({ key, value }) => [key, value.stringValue])
        )
      )
    )
  );
}

/** The AIDD binary and consent ledger are real. The Codex protocol and receiver are controlled
 * stand-ins: this proves the integration contract, not what an installed Codex emits. */
describe.skipIf(process.platform === "win32")("Codex metadata through the CLI", () => {
  it("sends consented session metadata and rejects an inconsistent native project", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("otel-metadata");
    const telemetry = join(fakeHome, "telemetry");
    const bin = join(fakeHome, "bin");
    const session = "00000000-0000-4000-8000-000000000123";
    const received: { url: string; auth: string | undefined; body: string }[] = [];
    const server = createServer((request, response) => {
      let body = "";
      request.on("data", (chunk: Buffer) => {
        body += chunk.toString();
      });
      request.on("end", () => {
        received.push({ url: request.url ?? "", auth: request.headers.authorization, body });
        response.writeHead(200, { "content-type": "application/json" }).end("{}");
      });
    });
    try {
      initRepository(projectDir, sandboxGitEnv(fakeHome), {
        remote: "git@github.com:example/project.git",
      });
      await mkdir(bin);
      await writeFile(
        join(bin, "codex"),
        `#!${process.execPath}
const readline = require('node:readline');
readline.createInterface({ input: process.stdin }).on('line', (line) => {
  const message = JSON.parse(line);
  if (!message.id) return;
  if (!['initialize', 'project/read', 'thread/read'].includes(message.method)) {
    process.stdout.write(JSON.stringify({ id: message.id, error: { code: -32601, message: 'Unknown method' } }) + '\\n');
    return;
  }
  const result = message.method === 'initialize' ? {} : message.method === 'project/read'
    ? { project: { id: process.env.AIDD_TEST_BAD_PROJECT ? 'other-project' : 'project-1', name: 'Example project' } }
    : { thread: { id: message.params.threadId, sessionId: message.params.threadId, name: 'Example session', projectId: 'project-1', turns: [] } };
  process.stdout.write(JSON.stringify({ id: message.id, result }) + '\\n');
});
`,
        { mode: 0o700 }
      );
      const env = {
        AIDD_TELEMETRY_DIR: telemetry,
        AIDD_TELEMETRY: "",
        AIDD_OTEL_TOKEN: "test-token",
        AIDD_TEST_BAD_PROJECT: "",
        PATH: [bin, sandboxedEnv(fakeHome).PATH].join(delimiter),
      };
      const cli = (args: string[], extra: Record<string, string> = {}) =>
        runCli(["telemetry", ...args], projectDir, fakeHome, { env: { ...env, ...extra } });
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Receiver did not start");
      const sync = (extra: Record<string, string> = {}, titlesOnly = true) =>
        cli(
          [
            "otel",
            "sync",
            "--config=codex",
            `--session=${session}`,
            "--tenant=test",
            `--endpoint=http://127.0.0.1:${address.port}`,
            ...(titlesOnly ? ["--titles-only"] : ["--include-session-titles"]),
            "--include-session-projects",
          ],
          extra
        );
      const transcriptDir = join(fakeHome, ".codex/sessions");
      await mkdir(transcriptDir, { recursive: true });
      const captureDir = join(fakeHome, ".local/share/aidd-otel-observation");
      await mkdir(captureDir, { recursive: true, mode: 0o700 });
      const attr = (key: string, value: string) => ({ key, value: { stringValue: value } });
      const capture = (at: string, input: string) => ({
        signal: "logs",
        payload: {
          resourceLogs: [
            {
              scopeLogs: [
                {
                  logRecords: [
                    {
                      timeUnixNano: (BigInt(Date.parse(at)) * 1_000_000n).toString(),
                      attributes: [
                        attr("conversation.id", session),
                        attr("user.email", "person@example.test"),
                        attr("event.name", "codex.sse_event"),
                        attr("event.kind", "response.completed"),
                        attr("model", "model-test"),
                        attr("input_token_count", input),
                        attr("output_token_count", "2"),
                        attr("cached_token_count", "4"),
                        attr("prompt", "private prompt"),
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      });
      const writeSession = async (at: string) => {
        const transcript = [
          {
            timestamp: at,
            type: "session_meta",
            payload: { id: session, cwd: projectDir, cli_version: "test", source: "cli" },
          },
          {
            timestamp: at,
            type: "turn_context",
            payload: { cwd: projectDir, model: "model-test" },
          },
          {
            timestamp: at,
            type: "token_usage_record",
            payload: {
              response_id: "response-1",
              session_id: session,
              thread_id: session,
              usage: {
                input_tokens: 10,
                cached_input_tokens: 4,
                cache_write_input_tokens: 0,
                output_tokens: 2,
                reasoning_output_tokens: 1,
              },
            },
          },
        ];
        await writeFile(
          join(transcriptDir, `rollout-test-${session}.jsonl`),
          `${transcript.map((line) => JSON.stringify(line)).join("\n")}\n`
        );
        await writeFile(join(captureDir, "codex.jsonl"), `${JSON.stringify(capture(at, "10"))}\n`, {
          mode: 0o600,
        });
      };

      await writeSession(new Date().toISOString());
      const withoutConsent = await sync();
      expect(withoutConsent.exitCode).not.toBe(0);
      expect(received).toHaveLength(0);

      await rm(join(transcriptDir, `rollout-test-${session}.jsonl`));
      const on = await cli(["on", "--yes", "--anonymous"]);
      expect(on.exitCode, on.stderr).toBe(0);
      await writeSession(new Date().toISOString());

      const sent = await sync();
      expect(sent.exitCode, sent.stderr + sent.stdout).toBe(0);
      expect(received).toHaveLength(2);
      expect(
        received.every(
          (request) =>
            request.url === "/api/kpi/otel/codex/test/v1/logs" &&
            request.auth === "Bearer test-token"
        )
      ).toBe(true);
      const attributes = received.map(({ body }) => logAttributes(body));
      expect(attributes).toContainEqual(
        expect.objectContaining({
          "event.name": "aidd.session_title",
          "conversation.id": session,
          "aidd.session_title": "Example session",
        })
      );
      expect(attributes).toContainEqual(
        expect.objectContaining({
          "event.name": "aidd.session_project",
          "conversation.id": session,
          "aidd.project_id": "project-1",
          "aidd.project_name": "Example project",
        })
      );
      expect(JSON.stringify(received)).not.toContain("private prompt");
      expect(JSON.stringify(received)).not.toContain("input_token_count");

      received.length = 0;
      const full = await sync({}, false);
      expect(full.exitCode, full.stderr + full.stdout).toBe(0);
      expect(received).toHaveLength(3);
      expect(received.map(({ body }) => logAttributes(body))).toContainEqual(
        expect.objectContaining({
          "event.name": "codex.sse_event",
          "event.kind": "response.completed",
          "conversation.id": session,
          model: "model-test",
          input_token_count: "10",
          output_token_count: "2",
          cached_token_count: "4",
        })
      );
      expect(JSON.stringify(received)).not.toContain("private prompt");

      received.length = 0;
      const inconsistent = await sync({ AIDD_TEST_BAD_PROJECT: "1" });
      expect(inconsistent.exitCode, inconsistent.stderr).toBe(0);
      expect(received).toHaveLength(1);
      expect(received[0].body).toContain("aidd.session_title");
      expect(received[0].body).not.toContain("project-1");

      const off = await cli(["off"]);
      expect(off.exitCode, off.stderr).toBe(0);
      received.length = 0;
      const revoked = await sync();
      expect(revoked.exitCode, revoked.stderr).toBe(0);
      expect(received).toHaveLength(0);

      // No historical or new event is sent while current consent is off.
      await appendFile(
        join(captureDir, "codex.jsonl"),
        `${JSON.stringify(capture(new Date().toISOString(), "999"))}\n`
      );
      const afterOff = await sync({}, false);
      expect(afterOff.exitCode).not.toBe(0);
      expect(afterOff.stderr + afterOff.stdout).toContain("Consent is no longer confirmed");
      expect(received).toHaveLength(0);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await cleanup();
    }
  });
});
