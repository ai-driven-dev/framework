import { access, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestEnv, FRAMEWORK_PATH, runCli } from "../shared/testing/cli-sandbox.builder.js";

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false
  );

describe("install, restore and remove one tool through the built binary", () => {
  let test: Awaited<ReturnType<typeof createTestEnv>>;
  let installed: string;
  const run = (...args: string[]) => runCli(args, test.projectDir, test.fakeHome);

  beforeAll(async () => {
    test = await createTestEnv("install-remove-restore");
    const setup = await run(
      ...["setup", "--source", "local", "--path", FRAMEWORK_PATH],
      ...["--ai", "cursor", "--plugins", "none", "--yes"]
    );
    expect(setup.exitCode, setup.stderr).toBe(0);
    installed = join(test.projectDir, ".cursor", "settings.json");
  });
  afterAll(() => test.cleanup());

  it("writes the tool's files on install", async () => {
    expect(await exists(installed)).toBe(true);
  });

  it("restores a file deleted after install", async () => {
    await rm(installed);

    const { exitCode, stdout } = await run("sync", "--force", "--tool", "cursor");

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Restored 1 file");
    expect(await exists(installed)).toBe(true);
  });

  it("removes the tool's files", async () => {
    const { exitCode, stdout } = await run("framework", "remove", "--tool", "cursor");

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Removed cursor");
    expect(await exists(installed)).toBe(false);
  });
});
