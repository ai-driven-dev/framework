import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { delimiter, join } from "node:path";
import { createInterface } from "node:readline";
import { describe, expect, it } from "vitest";
import { transformCapturedLine } from "../../src/contexts/telemetry/infrastructure/otel/observations.js";
import { cliPath, createTestEnv, runCli, sandboxedEnv } from "./helpers.js";

const attr = (key: string, value: string) => ({ key, value: { stringValue: value } });

// These are synthetic OTLP records, not a claim that every provider exports every field.
describe.skipIf(process.platform === "win32")("OTLP collector on the built CLI", () => {
  it("captures isolated authenticated provider records and verifies their normalized fields", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("otel-collector");
    const bin = join(fakeHome, "bin");
    await mkdir(bin);
    await writeFile(join(bin, "opencode"), `#!${process.execPath}\nconsole.log('2.2.5');\n`, {
      mode: 0o700,
    });
    const env = sandboxedEnv(fakeHome);
    const path = [bin, env.PATH].join(delimiter);
    const child = spawn(process.execPath, [cliPath(), "telemetry", "otel", "collect", "--port=0"], {
      cwd: projectDir,
      env: sandboxedEnv(fakeHome, { PATH: path }),
      stdio: ["ignore", "pipe", "pipe"],
    });
    const exited = once(child, "exit");
    const outputLines = createInterface({ input: child.stdout });
    try {
      const output = await Promise.race([
        once(outputLines, "line", { signal: AbortSignal.timeout(5000) }).then(([line]) =>
          String(line)
        ),
        exited.then(() => {
          throw new Error("Collector exited before listening.");
        }),
      ]);
      const port = /127\.0\.0\.1:(\d+)/.exec(output)?.[1];
      expect(port).toBeDefined();
      const directory = join(fakeHome, ".local/share/aidd-otel-observation");
      const token = (await readFile(join(directory, "collector-token"), "utf8")).trim();
      const configEnv = {
        PATH: path,
        OPENCODE_CONFIG_DIR: "",
        OPENCODE_CONFIG: "",
        OPENCODE_CONFIG_CONTENT: "",
      };
      const tools = [
        { tool: "claude" as const, sessionKey: "session.id", inputKey: "input_tokens" },
        { tool: "codex" as const, sessionKey: "conversation.id", inputKey: "input_token_count" },
        {
          tool: "opencode" as const,
          sessionKey: "session.id",
          inputKey: "gen_ai.usage.input_tokens",
        },
      ];
      for (const { tool, sessionKey, inputKey } of tools) {
        const payload = {
          resourceLogs: [
            {
              scopeLogs: [
                {
                  logRecords: [
                    {
                      timeUnixNano: "1700000000000000000",
                      attributes: [
                        attr("event.name", "synthetic"),
                        attr(sessionKey, `${tool}-session`),
                        attr(inputKey, "17"),
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        };
        const url = `http://127.0.0.1:${port}/${tool}/v1/logs`;
        const body = JSON.stringify(payload);
        expect((await fetch(url, { method: "POST", body })).status).toBe(403);
        expect(
          (
            await fetch(url, {
              method: "POST",
              body,
              headers: { authorization: `Bearer ${token}` },
            })
          ).status
        ).toBe(200);
        const capture = (await readFile(join(directory, `${tool}.jsonl`), "utf8")).trim();
        const observations = transformCapturedLine(tool, capture);
        expect(observations).toHaveLength(1);
        expect(observations[0]).toMatchObject({
          tool,
          sessionId: `${tool}-session`,
          tokens: { input: 17 },
        });
        expect(observations[0]?.tokens?.output).toBeUndefined();
        const init = await runCli(
          ["telemetry", "otel", "init", `--config=${tool}`, "--endpoint=dev"],
          projectDir,
          fakeHome,
          { env: configEnv }
        );
        expect(init.exitCode, init.stderr + init.stdout).toBe(0);
        const verified = await runCli(
          ["telemetry", "otel", "verify", `--config=${tool}`, "--endpoint=dev"],
          projectDir,
          fakeHome,
          { env: configEnv }
        );
        expect(verified.exitCode, verified.stderr + verified.stdout).toBe(0);
        expect(verified.stdout).toContain("1 captured lines");
        expect(verified.stdout).toContain("1 normalized observations");
      }
      for (const { tool } of tools) {
        const lines = (await readFile(join(directory, `${tool}.jsonl`), "utf8")).trim().split("\n");
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain(`${tool}-session`);
      }
    } finally {
      outputLines.close();
      child.kill("SIGTERM");
      await exited;
      await cleanup();
    }
  }, 20_000);
});
