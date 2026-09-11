import { existsSync } from "node:fs";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, runCli } from "./helpers.js";

const FRAMEWORK_REAL_PATH = resolve(process.cwd(), "tests/fixtures/framework-real");
const PLUGIN = "aidd-context";

describe("E2E: two projects on one HOME install the same cursor plugin", () => {
  it("gives each project its hooks, and lets the second remove and clean without taking the first's", async () => {
    const test = await createTestEnv("two-projects-one-home");
    try {
      const second = join(test.tempDir, "second");
      await mkdir(second, { recursive: true });
      const userDir = join(test.fakeHome, ".cursor", "plugins", "local", PLUGIN);
      const setup = (cwd: string) =>
        runCli(
          [
            "setup",
            "--source",
            "local",
            "--path",
            FRAMEWORK_REAL_PATH,
            "--ai",
            "cursor",
            "--plugins",
            PLUGIN,
            "--yes",
          ],
          cwd,
          test.fakeHome
        );
      const hooksOf = (cwd: string) => readFile(join(cwd, ".cursor", "hooks.json"), "utf-8");

      expect((await setup(test.projectDir)).exitCode).toBe(0);
      expect(await hooksOf(test.projectDir)).toContain("update_memory");
      const firstInstall = await readdir(userDir, { recursive: true });
      expect(firstInstall.length).toBeGreaterThan(0);

      const secondSetup = await setup(second);
      expect(secondSetup.exitCode).toBe(0);
      expect(secondSetup.stdout + secondSetup.stderr).toContain("was already there");
      expect(await hooksOf(second)).toContain("update_memory");

      const remove = await runCli(
        ["plugin", "remove", PLUGIN, "--tool", "cursor"],
        second,
        test.fakeHome
      );
      expect(remove.exitCode).toBe(0);
      expect((await runCli(["clean", "--force"], second, test.fakeHome)).exitCode).toBe(0);
      expect(await readdir(userDir, { recursive: true })).toEqual(firstInstall);

      expect((await runCli(["clean", "--force"], test.projectDir, test.fakeHome)).exitCode).toBe(0);
      expect(existsSync(userDir)).toBe(false);
    } finally {
      await test.cleanup();
    }
  });
});
