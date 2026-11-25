import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestEnv, FRAMEWORK_PATH, runCli } from "../shared/testing/cli-sandbox.builder.js";

describe("machine-wide scope through the built binary", () => {
  let test: Awaited<ReturnType<typeof createTestEnv>>;
  const run = (...args: string[]) => runCli(args, test.projectDir, test.fakeHome);

  beforeAll(async () => {
    test = await createTestEnv("global-scope");
  });
  afterAll(() => test.cleanup());

  it("setup --global registers the framework for every project", async () => {
    const { exitCode, stdout } = await run(
      ...["setup", "--source", "local", "--path", FRAMEWORK_PATH, "--ai", "cursor"],
      ...["--plugins", "none", "--yes", "--global"]
    );
    const listed = await run("marketplace", "list");

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Registered for every project on this machine.");
    expect(listed.stdout).toContain("aidd-framework");
  });

  it("clean --global purges the shared source", async () => {
    const { exitCode, stdout } = await run("clean", "--global", "--force");
    const listed = await run("marketplace", "list");

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Cleaned the shared aidd-framework source for this machine");
    expect(listed.stdout).toContain("No marketplaces registered.");
  });
});
