import { mkdir, readFile, writeFile } from "node:fs/promises";
import { delimiter, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, pathWithoutAidd, runCli } from "./helpers.js";

const FRAMEWORK_REAL_PATH = resolve(process.cwd(), "tests/fixtures/framework-real");
const SHELL_FAKE_BINARY = process.platform !== "win32";

async function writeCopilotThatRefusesMarketplaceAdd(binDir: string, logFile: string) {
  await mkdir(binDir, { recursive: true });
  await writeFile(
    join(binDir, "copilot"),
    [
      "#!/bin/sh",
      `echo "$@" >> "${logFile}"`,
      'case "$*" in *"marketplace add"*) echo "marketplace is already registered" >&2; exit 1;; esac',
      "exit 0",
      "",
    ].join("\n"),
    { mode: 0o755 }
  );
}

describe("E2E: clean leaves a marketplace the host refused to register for this project", () => {
  it.runIf(SHELL_FAKE_BINARY)("never asks copilot to remove it", async () => {
    const test = await createTestEnv("refused-marketplace-clean");
    try {
      const logFile = join(test.tempDir, "copilot-invocations.log");
      const binDir = join(test.tempDir, "bin");
      await writeCopilotThatRefusesMarketplaceAdd(binDir, logFile);
      const env = { PATH: `${binDir}${delimiter}${pathWithoutAidd()}` };
      const run = (args: string[]) => runCli(args, test.projectDir, test.fakeHome, { env });

      const setup = await run([
        "setup",
        "--source",
        "local",
        "--path",
        FRAMEWORK_REAL_PATH,
        "--ai",
        "copilot",
        "--plugins",
        "none",
        "--yes",
      ]);
      expect(setup.exitCode).toBe(0);
      const add = await run([
        "marketplace",
        "add",
        "probe",
        FRAMEWORK_REAL_PATH,
        "--scope",
        "project",
        "--yes",
      ]);
      expect(add.exitCode).toBe(0);
      expect(await readFile(logFile, "utf-8")).toContain("marketplace add");

      await writeFile(logFile, "");
      const clean = await run(["clean", "--force"]);
      expect(clean.exitCode).toBe(0);

      expect(await readFile(logFile, "utf-8")).not.toContain("marketplace remove");
    } finally {
      await test.cleanup();
    }
  });
});
