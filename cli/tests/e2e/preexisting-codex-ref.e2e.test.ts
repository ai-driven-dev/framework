import { mkdir, readFile, writeFile } from "node:fs/promises";
import { delimiter, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, pathWithoutAidd, runCli, writeFakeToolBinary } from "./helpers.js";

const FRAMEWORK_REAL_PATH = resolve(process.cwd(), "tests/fixtures/framework-real");
const PLUGIN_NAME = "aidd-vcs";
const THEIR_OWN_ENABLE = `[plugins."${PLUGIN_NAME}@aidd-framework"]\nenabled = true\n`;

describe("E2E: a codex plugin enabled before setup stays with the person who enabled it", () => {
  it("setup never enables it again, and clean never removes it", async () => {
    const test = await createTestEnv("preexisting-codex-ref");
    try {
      const logFile = join(test.tempDir, "codex-invocations.log");
      const binDir = join(test.tempDir, "bin");
      await writeFakeToolBinary(binDir, "codex", logFile);
      const env = { PATH: `${binDir}${delimiter}${pathWithoutAidd()}` };
      const codexConfig = join(test.fakeHome, ".codex", "config.toml");
      await mkdir(join(test.fakeHome, ".codex"), { recursive: true });
      await writeFile(codexConfig, THEIR_OWN_ENABLE);

      const setupArgs = [
        "setup",
        "--source",
        "local",
        "--path",
        FRAMEWORK_REAL_PATH,
        "--ai",
        "codex",
        "--plugins",
        PLUGIN_NAME,
        "--yes",
      ];
      const setup = await runCli(setupArgs, test.projectDir, test.fakeHome, { env });
      expect(setup.exitCode).toBe(0);
      const clean = await runCli(["clean", "--force"], test.projectDir, test.fakeHome, { env });
      expect(clean.exitCode).toBe(0);

      const log = await readFile(logFile, "utf-8");
      expect(log).not.toContain(`${PLUGIN_NAME}@`);
      expect(await readFile(codexConfig, "utf-8")).toContain(THEIR_OWN_ENABLE);
    } finally {
      await test.cleanup();
    }
  });
});
