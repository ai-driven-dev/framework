import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestEnv } from "../../shared/testing/cli-sandbox.builder.js";
import { runInProcess } from "../../shared/testing/in-process-cli.builder.js";

let cwd: string;
let home: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  ({ projectDir: cwd, fakeHome: home, cleanup } = await createTestEnv("setup-help-tools"));
});

afterEach(async () => {
  await cleanup();
});

describe("setup --help", () => {
  it("lists every registered profile, kilo included", async () => {
    const result = await runInProcess(["setup", "--help"], { cwd, home });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("--ide claude,codex,copilot,cursor,kilo,opencode");
  });
});
