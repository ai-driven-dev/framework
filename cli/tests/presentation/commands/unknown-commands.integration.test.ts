import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestEnv } from "../../e2e/helpers.js";
import { runInProcess } from "../../helpers/in-process-cli.js";

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
  it.each(["uninstall", "cache", "config", "ai", "ide", "status", "restore", "self-update"])(
    "%s exits 1 with an unknown command error",
    async (name) => {
      const { exitCode, stderr } = await runInProcess([name], { cwd: project, home });

      expect(exitCode).toBe(1);
      expect(stderr).toMatch(/unknown command/i);
    }
  );
});
