import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestEnv, FRAMEWORK_PATH, runCli } from "../shared/testing/cli-sandbox.builder.js";

const CURSOR_AIDD_TEST = ["--ai", "cursor", "--plugins", "aidd-test", "--yes"];

describe("plugin through the built binary", () => {
  let test: Awaited<ReturnType<typeof createTestEnv>>;
  const run = (...args: string[]) => runCli(args, test.projectDir, test.fakeHome);

  beforeAll(async () => {
    test = await createTestEnv("plugin");
    const setup = await run(
      "setup",
      "--source",
      "local",
      "--path",
      FRAMEWORK_PATH,
      ...CURSOR_AIDD_TEST
    );
    expect(setup.exitCode, setup.stderr).toBe(0);
  });
  afterAll(() => test.cleanup());

  it("search finds a plugin of the registered marketplace", async () => {
    const { exitCode, stdout } = await run("plugin", "search", "test");

    expect(exitCode).toBe(0);
    expect(stdout).toContain("aidd-test@? — Test plugin — marketplace: aidd-framework");
  });

  it("update leaves an installed plugin that is current", async () => {
    const { exitCode, stdout } = await run("plugin", "update");

    expect(exitCode).toBe(0);
    expect(stdout).toContain("All plugins are up to date.");
  });
});
