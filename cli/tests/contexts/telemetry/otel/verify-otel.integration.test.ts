import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

  it("refuses production", async () => {
    await expect(verifyOtel("claude", "prod", { home, env: {} })).rejects.toThrow(/production/);
  });
});
