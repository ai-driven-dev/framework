import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initializeOtel } from "../../../../src/contexts/telemetry/infrastructure/otel/actions/init.js";
import { readToken } from "../../../../src/contexts/telemetry/infrastructure/otel/settings.js";

let home: string;
const tokenPath = () => join(home, ".local/share/aidd-otel-observation/collector-token");

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "aidd-otel-settings-"));
});
afterEach(async () => {
  await rm(home, { recursive: true, force: true });
});

describe.skipIf(process.platform === "win32")("collector credential and exporter conflicts", () => {
  it("reads a valid private token and rejects missing, malformed or public tokens", async () => {
    await expect(readToken(home)).rejects.toThrow(/private collector token/);
    await mkdir(dirname(tokenPath()), { recursive: true });
    await writeFile(tokenPath(), "safe-token_123\n", { mode: 0o600 });
    expect(await readToken(home)).toBe("safe-token_123");
    await writeFile(tokenPath(), "invalid header\n");
    await expect(readToken(home)).rejects.toThrow(/private collector token/);
    await writeFile(tokenPath(), "safe-token_123\n");
    await chmod(tokenPath(), 0o644);
    await expect(readToken(home)).rejects.toThrow(/private collector token/);
  });

  it("never follows a symlink to a collector token", async () => {
    const target = join(home, "target");
    await writeFile(target, "safe-token", { mode: 0o600 });
    await mkdir(dirname(tokenPath()), { recursive: true });
    await symlink(target, tokenPath());
    await expect(readToken(home)).rejects.toThrow(/private collector token/);
  });

  it.each([
    ["OTEL_EXPORTER_OTLP_ENDPOINT", "https://different.example"],
    ["OTEL_EXPORTER_OTLP_LOGS_HEADERS", "Authorization=Bearer other"],
    ["OTEL_EXPORTER_OTLP_METRICS_HEADERS", "Authorization=Bearer other"],
    ["OTEL_EXPORTER_OTLP_TRACES_HEADERS", "Authorization=Bearer other"],
    ["OTEL_EXPORTER_OTLP_LOGS_PROTOCOL", "grpc"],
    ["OTEL_EXPORTER_OTLP_METRICS_PROTOCOL", "grpc"],
    ["OTEL_EXPORTER_OTLP_TRACES_PROTOCOL", "grpc"],
  ])("refuses conflicting Claude setting %s without replacing the file", async (key, value) => {
    await mkdir(dirname(tokenPath()), { recursive: true });
    await writeFile(tokenPath(), "safe-token", { mode: 0o600 });
    const settings = join(home, ".claude/settings.json");
    await mkdir(dirname(settings));
    const original = JSON.stringify({ env: { [key]: value }, untouched: true });
    await writeFile(settings, original, { mode: 0o600 });
    await expect(initializeOtel("claude", "dev", { home, env: {} })).rejects.toThrow(
      /Conflicting OTLP/
    );
    expect(await readFile(settings, "utf8")).toBe(original);
  });
});
