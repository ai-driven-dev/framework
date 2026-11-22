import { existsSync } from "node:fs";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { delimiter, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestEnv, pathWithoutAidd, runCli } from "../shared/testing/cli-sandbox.builder.js";

const SHELL_FAKE_BINARY = process.platform !== "win32";

/** A `gh` that knows one account, so no run reaches GitHub or the machine's own login. */
async function writeFakeGh(binDir: string): Promise<void> {
  await mkdir(binDir, { recursive: true });
  const file = join(binDir, "gh");
  await writeFile(
    file,
    '#!/bin/sh\ncase "$*" in "api user"*) echo octocat;; *) echo fake-token;; esac\n'
  );
  await chmod(file, 0o755);
}

describe.runIf(SHELL_FAKE_BINARY)("auth through the built binary", () => {
  let test: Awaited<ReturnType<typeof createTestEnv>>;
  let authFile: string;
  let run: (args: string[]) => ReturnType<typeof runCli>;

  beforeAll(async () => {
    test = await createTestEnv("auth");
    const binDir = join(test.tempDir, "bin");
    await writeFakeGh(binDir);
    authFile = join(test.fakeHome, ".config", "aidd", "auth.json");
    const env = { PATH: `${binDir}${delimiter}${pathWithoutAidd()}` };
    run = (args) => runCli(["auth", ...args], test.projectDir, test.fakeHome, { env });
  });
  afterAll(() => test.cleanup());

  it("login stores the account the gh binary names", async () => {
    const { exitCode, stdout } = await run(["login", "--gh", "--level", "user"]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Authenticated as octocat (user)");
    expect(existsSync(authFile)).toBe(true);
  });

  it("status reports the stored account", async () => {
    const { exitCode, stdout } = await run(["status"]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Authenticated as octocat (user)");
  });

  it("logout removes the stored credential", async () => {
    const { exitCode, stdout } = await run(["logout"]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Logged out (user)");
    expect(existsSync(authFile)).toBe(false);
  });
});
