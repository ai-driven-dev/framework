import { spawn } from "node:child_process";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cliPath, createTestEnv, sandboxedEnv } from "./helpers.js";

let env: Awaited<ReturnType<typeof createTestEnv>>;

beforeEach(async () => {
  env = await createTestEnv("telemetry-closed-output");
});
afterEach(async () => {
  await env.cleanup();
});

describe("aidd telemetry report into a reader that stops reading", () => {
  it("ends quietly, as `| head -1` does to it", async () => {
    const child = spawn(process.execPath, [cliPath(), "telemetry", "report"], {
      cwd: env.projectDir,
      env: sandboxedEnv(env.fakeHome, {
        AIDD_TELEMETRY_DIR: join(env.tempDir, "telemetry"),
        CLAUDE_CONFIG_DIR: join(env.tempDir, "claude"),
      }),
    });
    child.stdout.destroy();
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    const code = await new Promise<number | null>((done) => child.on("close", done));
    expect(stderr).toBe("");
    expect(code).toBe(0);
  });
});
