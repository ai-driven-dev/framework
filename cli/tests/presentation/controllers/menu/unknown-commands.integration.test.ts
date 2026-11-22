import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestEnv } from "../../../shared/testing/cli-sandbox.builder.js";
import { runInProcess } from "../../../shared/testing/in-process-cli.builder.js";

let project: string;
let home: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  ({ projectDir: project, fakeHome: home, cleanup } = await createTestEnv("unknown-commands"));
});

afterEach(async () => {
  await cleanup();
});

describe("a command name the program does not register", () => {
  // Names a person may still type from an older release: each must be refused, never reinterpreted.
  it.each([
    "install",
    "uninstall",
    "cache",
    "config",
    "ai",
    "ide",
    "status",
    "restore",
    "self-update",
  ])("%s exits 1 with an unknown command error naming it", async (name) => {
    const { exitCode, stderr } = await runInProcess([name], { cwd: project, home });

    expect(exitCode).toBe(1);
    expect(stderr).toMatch(/unknown command/i);
    expect(stderr).toContain(name);
  });

  it("install --help exits 0 and prints the usage, the help flag being read before the name", async () => {
    const { exitCode, stdout } = await runInProcess(["install", "--help"], {
      cwd: project,
      home,
    });

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Usage:");
  });
});
