import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestEnv, FRAMEWORK_PATH, runCli } from "../shared/testing/cli-sandbox.builder.js";

describe("marketplace through the built binary", () => {
  let test: Awaited<ReturnType<typeof createTestEnv>>;
  const run = (...args: string[]) =>
    runCli(["marketplace", ...args], test.projectDir, test.fakeHome);

  beforeAll(async () => {
    test = await createTestEnv("marketplace");
  });
  afterAll(() => test.cleanup());

  it("add registers a local marketplace", async () => {
    const { exitCode, stdout } = await run("add", "probe", FRAMEWORK_PATH, "--yes");

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Marketplace 'probe' registered.");
  });

  it("refresh fetches its catalog again", async () => {
    const { exitCode, stdout } = await run("refresh", "probe");

    expect(exitCode).toBe(0);
    expect(stdout).toContain("probe: ok");
  });

  it("check finds the refreshed marketplace fresh", async () => {
    const { exitCode, stdout } = await run("check");

    expect(exitCode).toBe(0);
    expect(stdout).toContain("All marketplaces fresh.");
  });

  it("remove unregisters it", async () => {
    const { exitCode, stdout } = await run("remove", "probe", "--yes");
    const listed = await run("list");

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Marketplace 'probe' removed");
    expect(listed.stdout).not.toContain("probe");
  });
});
