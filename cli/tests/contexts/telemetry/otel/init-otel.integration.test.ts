import { mkdir, mkdtemp, open, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initializeOtel } from "../../../../src/contexts/telemetry/infrastructure/otel/actions/init.js";

const TOKEN = "example-private-token";
let home: string;

async function seed(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, { mode: 0o600 });
}

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "aidd-otel-"));
});
afterEach(async () => {
  await rm(home, { recursive: true, force: true });
});

function seedToken() {
  return seed(join(home, ".local/share/aidd-otel-observation/collector-token"), TOKEN);
}

describe.skipIf(process.platform === "win32")("OTLP initialization", () => {
  it("refuses production before even needing the local token or executable", async () => {
    await expect(initializeOtel("opencode", "prod", { home, env: {} })).rejects.toThrow(
      /production.*Gouvernail/
    );
    await expect(stat(join(home, ".config"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("requires the collector token and leaves the target untouched", async () => {
    await expect(initializeOtel("claude", "dev", { home, env: {} })).rejects.toThrow(
      /collector-token/
    );
    await expect(stat(join(home, ".claude"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("merges Claude settings, preserves content options and writes a private file once", async () => {
    await seedToken();
    const path = join(home, ".claude/settings.json");
    await seed(
      path,
      '{"env":{"OTEL_LOG_USER_PROMPTS":"0","CLAUDE_CODE_OTEL_CONTENT_MAX_LENGTH":"16000"},"permissions":{"allow":[]}}'
    );
    const result = await initializeOtel("claude", "dev", { home, env: {} });
    expect(result.changed).toBe(true);
    const handle = await open(path, "r");
    const content = await handle.readFile("utf8");
    expect((await handle.stat()).mode & 0o777).toBe(0o600);
    await handle.close();
    expect(JSON.parse(content)).toMatchObject({
      permissions: { allow: [] },
      env: {
        OTEL_LOG_USER_PROMPTS: "0",
        OTEL_LOG_RAW_API_BODIES: "1",
        CLAUDE_CODE_OTEL_CONTENT_MAX_LENGTH: "16000",
        OTEL_METRICS_INCLUDE_REPOSITORY: "true",
        OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: "http://127.0.0.1:14318/claude/v1/logs",
        OTEL_EXPORTER_OTLP_HEADERS: `Authorization=Bearer ${TOKEN}`,
      },
    });
    expect(await initializeOtel("claude", "dev", { home, env: {} })).toMatchObject({
      changed: false,
    });
    const after = await open(path, "r");
    try {
      expect(await after.readFile("utf8")).toBe(content);
    } finally {
      await after.close();
    }
  });

  it("refuses a symlink without reading or replacing its target", async () => {
    await seedToken();
    const target = join(home, "original.json");
    await seed(target, "{}");
    await mkdir(join(home, ".claude"));
    await symlink(target, join(home, ".claude/settings.json"));
    await expect(initializeOtel("claude", "dev", { home, env: {} })).rejects.toThrow();
    expect(await readFile(target, "utf8")).toBe("{}");
  });

  it("refuses invalid config or a conflicting exporter without altering the file", async () => {
    await seedToken();
    const path = join(home, ".claude/settings.json");
    for (const content of [
      '{"env":',
      '{"env":{"OTEL_EXPORTER_OTLP_LOGS_ENDPOINT":"https://collector.example/logs"}}',
    ]) {
      await seed(path, content);
      await expect(initializeOtel("claude", "dev", { home, env: {} })).rejects.toThrow();
      expect(await readFile(path, "utf8")).toBe(content);
    }
  });

  it("adds Codex exporters without changing TOML comments or content flags", async () => {
    await seedToken();
    const dir = join(home, "codex-custom");
    const path = join(dir, "config.toml");
    const original =
      "# User config\n[otel]\nlog_user_prompt = false # Keep this\n\n[otel.tool_result]\nmax_bytes = 1234\n";
    await seed(path, original);
    const options = { home, env: { CODEX_HOME: dir } };
    expect(await initializeOtel("codex", "dev", options)).toMatchObject({ changed: true });
    const updated = await readFile(path, "utf8");
    expect(updated).toContain("# User config\n[otel]\n");
    expect(updated).toContain(
      "log_user_prompt = false # Keep this\n\n[otel.tool_result]\nmax_bytes = 1234\n"
    );
    expect(updated).toContain("log_agent_responses = true");
    expect(updated).toContain('endpoint = "http://127.0.0.1:14318/codex/v1/traces"');
    expect(await initializeOtel("codex", "dev", options)).toMatchObject({ changed: false });
    expect(await readFile(path, "utf8")).toBe(updated);
  });

  it("merges v2 daemon environment and refuses an unknown major", async () => {
    await seedToken();
    const dir = join(home, "opencode-custom");
    const path = join(dir, "service.json");
    await seed(path, '{"port":1234,"env":{"EXISTING":"keep"}}');
    const options = { home, env: { OPENCODE_CONFIG_DIR: dir } };
    await expect(
      initializeOtel("opencode", "dev", { ...options, opencodeVersion: async () => "3.0.0" })
    ).rejects.toThrow(/OpenCode version/);
    expect(await readFile(path, "utf8")).toBe('{"port":1234,"env":{"EXISTING":"keep"}}');
    await expect(
      initializeOtel("opencode", "dev", { ...options, opencodeVersion: async () => "2.0.0" })
    ).rejects.toThrow(/OpenCode version/);
    expect(await readFile(path, "utf8")).toBe('{"port":1234,"env":{"EXISTING":"keep"}}');
    const v2 = { ...options, opencodeVersion: async () => "opencode v2.2.5" };
    expect(await initializeOtel("opencode", "dev", v2)).toMatchObject({ changed: true });
    expect(JSON.parse(await readFile(path, "utf8"))).toMatchObject({
      port: 1234,
      env: { EXISTING: "keep", OTEL_EXPORTER_OTLP_ENDPOINT: "http://127.0.0.1:14318/opencode" },
    });
    expect(await initializeOtel("opencode", "dev", v2)).toMatchObject({ changed: false });
  });

  it("merges the v1 instrumentation flag into the native JSONC config without touching shell profiles", async () => {
    await seedToken();
    const profile = join(home, ".zshrc");
    await seed(profile, "# keep me");
    const path = join(home, ".config/opencode/opencode.jsonc");
    const original =
      '{\n  // keep this comment\n  "experimental": { "todo": true, /* keep this too */ },\n}\n';
    await seed(path, original);
    const options = { home, env: {}, opencodeVersion: async () => "1.19.5" };
    const result = await initializeOtel("opencode", "dev", options);
    expect(result).toMatchObject({ path, changed: true });
    expect(result.launch).toContain("aidd telemetry otel run --config=opencode");
    const next = await readFile(path, "utf8");
    expect(next).toContain('"openTelemetry": true');
    expect(next).toContain("// keep this comment");
    expect(next).toContain('"todo": true, /* keep this too */');
    expect(next).not.toContain(TOKEN);
    expect(await readFile(profile, "utf8")).toBe("# keep me");
    expect(await initializeOtel("opencode", "dev", options)).toMatchObject({ changed: false });
    expect(await readFile(path, "utf8")).toBe(next);
  });

  it("preserves a disabled v1 instrumentation flag and refuses to initialize", async () => {
    await seedToken();
    const path = join(home, ".config/opencode/opencode.json");
    const original = '{"experimental":{"openTelemetry":false}}';
    await seed(path, original);
    const options = { home, env: {}, opencodeVersion: async () => "1.19.5" };
    await expect(initializeOtel("opencode", "dev", options)).rejects.toThrow(
      /openTelemetry.*disabled/
    );
    expect(await readFile(path, "utf8")).toBe(original);
  });

  it("initializes the locally verified v1.18.35 without admitting unverified earlier versions", async () => {
    await seedToken();
    const options = { home, env: {}, opencodeVersion: async () => "1.18.35" };
    expect(await initializeOtel("opencode", "dev", options)).toMatchObject({ changed: true });
    expect(
      JSON.parse(await readFile(join(home, ".config/opencode/opencode.json"), "utf8"))
    ).toMatchObject({ experimental: { openTelemetry: true } });
    await expect(
      initializeOtel("opencode", "dev", { ...options, opencodeVersion: async () => "1.18.34" })
    ).rejects.toThrow(/OpenCode version/);
  });
});
