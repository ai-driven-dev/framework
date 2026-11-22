import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestEnv, runCli } from "../shared/testing/cli-sandbox.builder.js";
import { initRepository, sandboxGitEnv } from "../shared/testing/git-sandbox.builder.js";

describe("telemetry lifecycle through the built binary", () => {
  let test: Awaited<ReturnType<typeof createTestEnv>>;
  const run = (...args: string[]) =>
    runCli(["telemetry", ...args], test.projectDir, test.fakeHome, { env: { AIDD_TELEMETRY: "" } });

  beforeAll(async () => {
    test = await createTestEnv("telemetry-lifecycle");
    initRepository(test.projectDir, sandboxGitEnv(test.fakeHome));
    const on = await run("on", "--yes", "--anonymous");
    expect(on.exitCode, on.stderr).toBe(0);
  });
  afterAll(() => test.cleanup());

  it("status says the clone is measured", async () => {
    const { exitCode, stdout } = await run("status");

    expect(exitCode).toBe(0);
    expect(stdout).toContain("This clone is measured since");
  });

  it("off stops measuring and keeps what was measured", async () => {
    const { exitCode, stdout } = await run("off");

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Measurement is off for this clone.");
    expect(existsSync(join(test.fakeHome, ".config", "aidd", "telemetry", "ledger"))).toBe(true);
  });

  it("forget removes what was measured", async () => {
    const { exitCode, stdout } = await run("forget", "--yes");

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Removed:");
    expect(existsSync(join(test.fakeHome, ".config", "aidd", "telemetry", "ledger"))).toBe(false);
  });
});
