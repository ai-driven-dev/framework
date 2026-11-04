import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initializeOtel } from "../../../../src/contexts/telemetry/infrastructure/otel/actions/init.js";
import { verifyOtel } from "../../../../src/contexts/telemetry/infrastructure/otel/actions/verify.js";

let home: string;
let capture: string;
beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "aidd-otel-verify-"));
  const directory = join(home, ".local/share/aidd-otel-observation");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "collector-token"), "test-token", { mode: 0o600 });
  capture = join(directory, "claude.jsonl");
});
afterEach(async () => {
  await rm(home, { recursive: true, force: true });
});

describe.skipIf(process.platform === "win32")("OTLP verification", () => {
  it("requires initialization without creating settings", async () => {
    await expect(verifyOtel("claude", "dev", { home, env: {} })).rejects.toThrow(/not initialized/);
    await expect(readFile(join(home, ".claude/settings.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
  it("requires captured receipt and leaves configuration unchanged", async () => {
    await initializeOtel("claude", "dev", { home, env: {} });
    const path = join(home, ".claude/settings.json");
    const original = await readFile(path, "utf8");
    await expect(verifyOtel("claude", "dev", { home, env: {} })).rejects.toThrow(/capture/);
    await writeFile(capture, "\n", { mode: 0o600 });
    await expect(verifyOtel("claude", "dev", { home, env: {} })).rejects.toThrow(/capture/);
    await writeFile(capture, '{"signal":"logs"}\n{"signal":"metrics"}\n');
    expect(await verifyOtel("claude", "dev", { home, env: {} })).toMatchObject({
      capture,
      lines: 2,
    });
    expect(await readFile(path, "utf8")).toBe(original);
    await chmod(path, 0o644);
    await expect(verifyOtel("claude", "dev", { home, env: {} })).rejects.toThrow(/private/);
  });
  it("accepts OpenCode 1 instrumentation supplied only through its inline environment", async () => {
    const host = {
      home,
      env: { OPENCODE_CONFIG_CONTENT: '{"experimental":{"openTelemetry":true}}' },
      opencodeVersion: async () => "1.19.5",
    };
    await initializeOtel("opencode", "dev", host);
    await writeFile(join(home, ".local/share/aidd-otel-observation/opencode.jsonl"), "{}\n", {
      mode: 0o600,
    });
    expect(await verifyOtel("opencode", "dev", host)).toMatchObject({ lines: 1 });
  });

  it("counts normalized observations without returning raw content", async () => {
    await initializeOtel("claude", "dev", { home, env: {} });
    const record = {
      signal: "logs",
      payload: {
        resourceLogs: [
          {
            resource: { attributes: [] },
            scopeLogs: [
              {
                logRecords: [
                  {
                    attributes: [
                      { key: "event.name", value: { stringValue: "user_prompt" } },
                      { key: "prompt", value: { stringValue: "private-example" } },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    };
    await writeFile(capture, `${JSON.stringify(record)}\ninvalid\n`, { mode: 0o600 });
    const result = await verifyOtel("claude", "dev", { home, env: {} });
    expect(result).toMatchObject({ lines: 2, observations: 1, unrecognisedLines: 1 });
    expect(JSON.stringify(result)).not.toContain("private-example");
  });

  it("refuses a capture symlink and a directory without reading either target", async () => {
    await initializeOtel("claude", "dev", { home, env: {} });
    const target = join(home, "outside.jsonl");
    await writeFile(target, "private\n", { mode: 0o600 });
    await symlink(target, capture);
    await expect(verifyOtel("claude", "dev", { home, env: {} })).rejects.toThrow();
    expect(await readFile(target, "utf8")).toBe("private\n");
    await rm(capture);
    await mkdir(capture);
    await expect(verifyOtel("claude", "dev", { home, env: {} })).rejects.toThrow(/regular file/);
  });

  it("reports counts for valid and malformed lines while ignoring blank lines", async () => {
    await initializeOtel("claude", "dev", { home, env: {} });
    const record = {
      signal: "logs",
      payload: {
        resourceLogs: [
          {
            scopeLogs: [
              {
                logRecords: [
                  { attributes: [{ key: "event.name", value: { stringValue: "user_prompt" } }] },
                  { attributes: [{ key: "event.name", value: { stringValue: "tool_result" } }] },
                ],
              },
            ],
          },
        ],
      },
    };
    await writeFile(capture, `\n${JSON.stringify(record)}\nnot-json\n\n`, { mode: 0o600 });
    expect(await verifyOtel("claude", "dev", { home, env: {} })).toMatchObject({
      lines: 2,
      observations: 2,
      unrecognisedLines: 1,
      eventLines: 0,
    });
  });

  it("also counts a local OpenCode SSE capture when present", async () => {
    const host = {
      home,
      env: { OPENCODE_CONFIG_CONTENT: '{"experimental":{"openTelemetry":true}}' },
      opencodeVersion: async () => "1.19.5",
    };
    await initializeOtel("opencode", "dev", host);
    const directory = join(home, ".local/share/aidd-otel-observation");
    await writeFile(join(directory, "opencode.jsonl"), "{}\n", { mode: 0o600 });
    await mkdir(join(directory, "opencode"));
    await writeFile(
      join(directory, "opencode/events.jsonl"),
      `${JSON.stringify({
        type: "session.step.ended",
        data: { tokens: { input: 4 } },
      })}\n`,
      { mode: 0o600 }
    );
    expect(await verifyOtel("opencode", "dev", host)).toMatchObject({
      observations: 1,
      eventLines: 1,
    });
  });

  it("refuses an OpenCode event capture that is not a regular file", async () => {
    const host = {
      home,
      env: { OPENCODE_CONFIG_CONTENT: '{"experimental":{"openTelemetry":true}}' },
      opencodeVersion: async () => "1.19.5",
    };
    await initializeOtel("opencode", "dev", host);
    const directory = join(home, ".local/share/aidd-otel-observation");
    await writeFile(join(directory, "opencode.jsonl"), "{}\n", { mode: 0o600 });
    await mkdir(join(directory, "opencode", "events.jsonl"), { recursive: true });
    await expect(verifyOtel("opencode", "dev", host)).rejects.toThrow(
      /event capture must be a regular file/
    );
  });

  it("refuses production", async () => {
    await expect(verifyOtel("claude", "prod", { home, env: {} })).rejects.toThrow(/production/);
  });
});
