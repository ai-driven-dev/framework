import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, runCli } from "./helpers.js";

describe.skipIf(process.platform === "win32")("native OTLP verification", () => {
  it("verifies captured receipt through the CLI and fails when capture is absent", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("telemetry-verify");
    const directory = join(fakeHome, ".local/share/aidd-otel-observation");
    try {
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, "collector-token"), "test-token", { mode: 0o600 });
      const args = ["--config=claude", "--endpoint=dev"];
      const init = await runCli(["telemetry", "otel", "init", ...args], projectDir, fakeHome);
      expect(init.exitCode).toBe(0);
      const missing = await runCli(["telemetry", "otel", "verify", ...args], projectDir, fakeHome);
      expect(missing.exitCode).not.toBe(0);
      await writeFile(
        join(directory, "claude.jsonl"),
        `${JSON.stringify({
          signal: "logs",
          payload: {
            resourceLogs: [
              {
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
        })}\n`,
        { mode: 0o600 }
      );
      const verified = await runCli(["telemetry", "otel", "verify", ...args], projectDir, fakeHome);
      expect(verified.exitCode).toBe(0);
      expect(verified.stdout).toContain("1 captured lines");
      expect(verified.stdout).toContain("1 normalized observations");
      expect(verified.stdout).not.toContain("private-example");
      expect(verified.stdout).not.toContain("test-token");
    } finally {
      await cleanup();
    }
  });
});
