import { execFileSync } from "node:child_process";
import { constants } from "node:fs";
import { mkdir, mkdtemp, open, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initializeOtel } from "../../../../src/contexts/telemetry/infrastructure/otel/actions/init.js";
import { hasOpenCodePlugin } from "../../../../src/contexts/telemetry/infrastructure/otel/actions/opencode-plugin-file.js";
import { verifyOtel } from "../../../../src/contexts/telemetry/infrastructure/otel/actions/verify.js";

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
  it.each(["package.json", "server.ts", "server.tsx", "server.js", "index.ts", "index.tsx"])(
    "refuses competing %s without changing it",
    async (name) => {
      await seedToken();
      const host = { home, env: {}, opencodeVersion: async () => "2.2.5" };
      const entry = join(home, ".config/opencode/plugins/aidd-otel", name);
      await seed(entry, "user content");
      await expect(initializeOtel("opencode", "dev", host)).rejects.toThrow(
        /competing entry point/
      );
      expect(await readFile(entry, "utf8")).toBe("user content");
      await expect(stat(join(dirname(entry), "index.js"))).rejects.toMatchObject({
        code: "ENOENT",
      });
    }
  );
  it("rejects a competing symlink and FIFO without reading either", async () => {
    const directory = join(home, ".config/opencode/plugins/aidd-otel");
    await mkdir(directory, { recursive: true });
    await symlink(join(home, "missing"), join(directory, "package.json"));
    await expect(hasOpenCodePlugin({ home, env: {} })).rejects.toThrow(/competing entry point/);
    await rm(join(directory, "package.json"));
    execFileSync("/usr/bin/mkfifo", [join(directory, "server.js")]);
    await expect(hasOpenCodePlugin({ home, env: {} })).rejects.toThrow(/competing entry point/);
  });
  it("refuses a competing entry added after installation", async () => {
    await seedToken();
    const host = { home, env: {}, opencodeVersion: async () => "2.2.5" };
    await initializeOtel("opencode", "dev", host);
    const entry = join(home, ".config/opencode/plugins/aidd-otel/server.js");
    await writeFile(entry, "user plugin\n");
    await expect(hasOpenCodePlugin(host)).rejects.toThrow(/competing entry point/);
    await expect(verifyOtel("opencode", "dev", host)).rejects.toThrow(/competing entry point/);
    expect(await readFile(entry, "utf8")).toBe("user plugin\n");
  });
  it("rejects a FIFO plugin without blocking", async () => {
    const path = join(home, ".config/opencode/plugins/aidd-otel/index.js");
    await mkdir(dirname(path), { recursive: true });
    execFileSync("/usr/bin/mkfifo", [path]);
    const check = hasOpenCodePlugin({ home, env: {} }).then(
      () => "accepted",
      (error: Error) => error.message
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    const result = await Promise.race([
      check,
      new Promise<string>((resolve) => {
        timer = setTimeout(() => resolve("blocked"), 1000);
      }),
    ]);
    if (timer) clearTimeout(timer);
    if (result === "blocked") {
      // Release a regressed blocking read so this behavioral check can fail cleanly.
      const writer = await open(path, constants.O_WRONLY | constants.O_NONBLOCK);
      await check;
      await writer.close();
    }
    expect(result).toBe("OpenCode telemetry plugin is unsafe or has different content.");
  });
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
    const content = await readFile(path, "utf8");
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
    expect(await readFile(path, "utf8")).toBe(content);
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });

  it("writes Claude settings privately on the first initialization", async () => {
    await seedToken();
    await initializeOtel("claude", "dev", { home, env: {} });
    const handle = await open(join(home, ".claude/settings.json"), "r");
    try {
      expect((await handle.stat()).mode & 0o777).toBe(0o600);
    } finally {
      await handle.close();
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
      env: {
        EXISTING: "keep",
        OTEL_EXPORTER_OTLP_ENDPOINT: "http://127.0.0.1:14318/opencode",
        AIDD_OPENCODE_OTEL_LOGS_ENDPOINT: "http://127.0.0.1:14318/opencode/v1/logs",
      },
    });
    const plugin = join(dir, "plugins/aidd-otel/index.js");
    expect(await readFile(plugin, "utf8")).toContain('id: "aidd.otel"');
    expect(await initializeOtel("opencode", "dev", v2)).toMatchObject({ changed: false });
    await writeFile(plugin, "user plugin\n");
    await expect(initializeOtel("opencode", "dev", v2)).rejects.toThrow(/plugin.*different/);
    expect(await readFile(plugin, "utf8")).toBe("user plugin\n");
  });

  it("rejects OpenCode 1 and versions before 2.2.5", async () => {
    await seedToken();
    for (const version of ["1.18.35", "1.19.5", "2.2.4", "not-a-version"]) {
      await expect(
        initializeOtel("opencode", "dev", {
          home,
          env: {},
          opencodeVersion: async () => version,
        })
      ).rejects.toThrow(/Unsupported OpenCode version/);
    }
  });
});
