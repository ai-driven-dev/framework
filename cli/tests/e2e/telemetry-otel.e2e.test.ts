import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { delimiter, join } from "node:path";
import { describe, expect, it } from "vitest";
import { cliPath, createTestEnv, runCli, sandboxedEnv } from "./helpers.js";

describe.skipIf(process.platform === "win32")("native OTLP launch", () => {
  it.each([
    ["SIGINT", 42],
    ["SIGTERM", 43],
  ] as const)(
    "forwards %s sent to AIDD and preserves OpenCode's exit code",
    async (signal, code) => {
      const { projectDir, fakeHome, cleanup } = await createTestEnv("telemetry-otel");
      const tools = join(fakeHome, "bin");
      const collector = join(fakeHome, ".local/share/aidd-otel-observation");
      const opts = sandboxedEnv(fakeHome);
      const env = {
        PATH: [tools, opts.PATH].join(delimiter),
        OPENCODE_CONFIG: "",
        OPENCODE_CONFIG_DIR: "",
        OPENCODE_CONFIG_CONTENT: "",
        OTEL_EXPORTER_OTLP_ENDPOINT: "",
        OTEL_EXPORTER_OTLP_HEADERS: "",
      };
      try {
        await mkdir(tools);
        await mkdir(collector, { recursive: true });
        await writeFile(join(collector, "collector-token"), "test-token", { mode: 0o600 });
        await writeFile(
          join(tools, "opencode"),
          `#!${process.execPath}
if (process.argv.includes("--version")) {
  console.log("1.19.5");
  process.exit(0);
}
if (JSON.stringify(process.argv.slice(2)) !== '["stats","--days","1"]') process.exit(20);
if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT !== "http://127.0.0.1:14318/opencode") process.exit(21);
if (process.env.OTEL_EXPORTER_OTLP_HEADERS !== "Authorization=Bearer test-token") process.exit(22);
process.on("SIGINT", () => process.exit(42));
process.on("SIGTERM", () => process.exit(43));
console.log(process.pid);
setTimeout(() => process.exit(24), 2000);
`,
          { mode: 0o700 }
        );
        const init = await runCli(
          ["telemetry", "otel", "init", "--config=opencode", "--endpoint=dev"],
          projectDir,
          fakeHome,
          { env }
        );
        expect(init.exitCode).toBe(0);
        const wrapper = spawn(
          process.execPath,
          [
            cliPath(),
            "telemetry",
            "otel",
            "run",
            "--config=opencode",
            "--",
            "stats",
            "--days",
            "1",
          ],
          { cwd: projectDir, env: sandboxedEnv(fakeHome, env), stdio: ["ignore", "pipe", "pipe"] }
        );
        const finished = once(wrapper, "exit");
        const ready = await Promise.race([once(wrapper.stdout, "data"), finished]);
        expect(Number(String(ready[0]))).toBeGreaterThan(0);
        expect(wrapper.kill(signal)).toBe(true);
        expect(await finished).toEqual([code, null]);
      } finally {
        await cleanup();
      }
    }
  );
});
