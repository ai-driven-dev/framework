/**
 * TTY scenarios use /usr/bin/expect: only a real terminal proves the banner and the menu.
 */

import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { cliPath, createTestEnv, failedRunOf } from "../shared/testing/cli-sandbox.builder.js";

const execFileAsync = promisify(execFile);

const EXPECT_BIN = "/usr/bin/expect";

/** Runs an expect(1) script that emulates TTY interaction with the CLI. */
async function runInteractive(
  projectDir: string,
  fakeHome: string,
  script: string
): Promise<{ stdout: string; exitCode: number }> {
  const scriptDir = await mkdtemp(join(tmpdir(), "aidd-expect-"));
  const scriptPath = join(scriptDir, "interaction.exp");
  const fullScript = `
set timeout 15
set env(HOME) "${fakeHome}"
set env(XDG_CONFIG_HOME) "${fakeHome}/.config"
${script}
`;
  await writeFile(scriptPath, fullScript);
  try {
    const { stdout } = await execFileAsync(EXPECT_BIN, ["-f", scriptPath], {
      cwd: projectDir,
      env: { ...process.env, PWD: projectDir },
    });
    return { stdout, exitCode: 0 };
  } catch (err) {
    const { stdout, stderr, code } = failedRunOf(err);
    return { stdout: stdout + stderr, exitCode: code ?? 1 };
  } finally {
    await rm(scriptDir, { recursive: true, force: true });
  }
}

describe.concurrent("persona journeys", () => {
  it("Persona 1 — fresh user: aidd alone shows banner and setup prompt", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("persona-fresh");
    try {
      const { stdout, exitCode } = await runInteractive(
        projectDir,
        fakeHome,
        `
spawn ${process.execPath} ${cliPath()}
expect {
  -re {AI-Driven Development CLI} { puts "BANNER_OK" }
  timeout { puts "TIMEOUT"; exit 1 }
  eof { puts "EOF_EARLY"; exit 1 }
}
expect {
  -re {AIDD not initialized} { puts "PROMPT_OK"; send "n\\r" }
  timeout { puts "TIMEOUT2"; exit 1 }
}
expect eof
exit 0
`
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("BANNER_OK");
      expect(stdout).toContain("PROMPT_OK");
    } finally {
      await cleanup();
    }
  });
});
