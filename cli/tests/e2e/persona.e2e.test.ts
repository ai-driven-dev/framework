import { TOOL } from "../contexts/tools/testing/catalog-of.js";
/**
 * TTY scenarios use /usr/bin/expect: only a real terminal proves the banner and the menu.
 */

import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { cliPath, createTestEnv } from "./helpers.js";

const execFileAsync = promisify(execFile);

const EXPECT_BIN = "/usr/bin/expect";
const AIDD_DIR = ".aidd";

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
    const e = err as { stdout?: string; stderr?: string; code?: number };
    return { stdout: (e.stdout ?? "") + (e.stderr ?? ""), exitCode: e.code ?? 1 };
  } finally {
    await rm(scriptDir, { recursive: true, force: true });
  }
}

describe.concurrent("E2E: persona journeys", () => {
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

  it("Persona 5 — returning user: aidd alone with manifest shows full menu", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("persona-returning");
    try {
      await mkdir(join(projectDir, AIDD_DIR), { recursive: true });
      await writeFile(
        join(projectDir, AIDD_DIR, "manifest.json"),
        JSON.stringify({
          version: 8,
          tools: {
            claude: {
              toolId: TOOL.claude,
              version: "4.1.0-beta.18",
              files: [],
              mergeFiles: [],
            },
          },
        })
      );

      const { stdout, exitCode } = await runInteractive(
        projectDir,
        fakeHome,
        `
spawn bash -c "cd '${projectDir}' && ${process.execPath} ${cliPath()}"
expect {
  -re {AI-Driven Development CLI} { puts "BANNER_OK" }
  timeout { puts "TIMEOUT"; exit 1 }
  eof { puts "EOF"; exit 1 }
}
expect {
  -re {What would you like to do} { puts "MENU_OK" }
  -re {AIDD not initialized} { puts "NO_MANIFEST"; exit 1 }
  timeout { puts "TIMEOUT2"; exit 1 }
}
expect {
  -re {Inspect} { puts "INSPECT_OK" }
  timeout { puts "TIMEOUT3"; exit 1 }
}
exit 0
`
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("BANNER_OK");
      expect(stdout).toContain("MENU_OK");
      expect(stdout).toContain("INSPECT_OK");
    } finally {
      await cleanup();
    }
  });
});
