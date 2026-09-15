import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, realpath, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { Manifest } from "../../src/contexts/framework/domain/manifest.js";
import { copyFixtureTree, createTestEnv, runCli } from "./helpers.js";

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
      const manifestAt = async (path: string) =>
        Manifest.fromJSON(JSON.parse(await readFile(path, "utf-8")));

      expect((await setup(test.projectDir)).exitCode).toBe(0);
      expect(await hooksOf(test.projectDir)).toContain("update_memory");
      const firstInstall = await readdir(userDir, { recursive: true });
      expect(firstInstall.length).toBeGreaterThan(0);

      const secondSetup = await setup(second);
      expect(secondSetup.exitCode).toBe(0);
      expect(await hooksOf(second)).toContain("update_memory");
      const machine = await manifestAt(join(test.fakeHome, ".config", "aidd", "manifest.json"));
      const owned = machine.getPlugins("cursor").find((plugin) => plugin.name === PLUGIN);
      expect(owned?.files.size).toBeGreaterThan(0);
      expect(owned?.dependents).toEqual([await realpath(test.projectDir), await realpath(second)]);
      for (const cwd of [test.projectDir, second]) {
        const project = await manifestAt(join(cwd, ".aidd", "manifest.json"));
        expect(
          project.getPlugins("cursor").find((plugin) => plugin.name === PLUGIN)?.files.size
        ).toBe(0);
      }
      const prematureGlobalClean = await runCli(
        ["clean", "--scope", "user", "--force"],
        test.projectDir,
        test.fakeHome
      );
      expect(prematureGlobalClean.exitCode).not.toBe(0);
      expect(prematureGlobalClean.stdout + prematureGlobalClean.stderr).toContain(
        await realpath(second)
      );
      expect(await readdir(userDir, { recursive: true })).toEqual(firstInstall);

      const remove = await runCli(
        ["plugin", "remove", PLUGIN, "--tool", "cursor"],
        second,
        test.fakeHome
      );
      expect(remove.exitCode).toBe(0);
      expect((await runCli(["clean", "--force"], second, test.fakeHome)).exitCode).toBe(0);
      expect(await readdir(userDir, { recursive: true })).toEqual(firstInstall);

      expect((await runCli(["clean", "--force"], test.projectDir, test.fakeHome)).exitCode).toBe(0);
      expect(existsSync(userDir)).toBe(true);
      expect(
        (await runCli(["clean", "--scope", "user", "--force"], test.projectDir, test.fakeHome))
          .exitCode
      ).toBe(0);
      expect(existsSync(userDir)).toBe(false);
    } finally {
      await test.cleanup();
    }
  });

  it("removes one machine-owned plugin only after both projects detach", async () => {
    const test = await createTestEnv("two-projects-targeted-user-remove");
    try {
      const second = join(test.tempDir, "second");
      await mkdir(second, { recursive: true });
      for (const cwd of [test.projectDir, second]) {
        const setup = await runCli(
          [
            "setup",
            "--source",
            "local",
            "--path",
            FRAMEWORK_REAL_PATH,
            "--ai",
            "cursor",
            "--plugins",
            "aidd-context,aidd-dev",
            "--yes",
          ],
          cwd,
          test.fakeHome
        );
        expect(setup.exitCode).toBe(0);
      }
      const contextDir = join(test.fakeHome, ".cursor", "plugins", "local", "aidd-context");
      const devDir = join(test.fakeHome, ".cursor", "plugins", "local", "aidd-dev");
      const blocked = await runCli(
        ["plugin", "remove", "aidd-context", "--tool", "cursor", "--scope", "user"],
        test.projectDir,
        test.fakeHome
      );
      expect(blocked.exitCode).not.toBe(0);
      expect(blocked.stdout + blocked.stderr).toContain(await realpath(second));
      expect(existsSync(contextDir)).toBe(true);
      for (const cwd of [test.projectDir, second]) {
        expect((await runCli(["clean", "--force"], cwd, test.fakeHome)).exitCode).toBe(0);
      }
      const removed = await runCli(
        ["plugin", "remove", "aidd-context", "--tool", "cursor", "--scope", "user"],
        test.projectDir,
        test.fakeHome
      );
      expect(removed.exitCode).toBe(0);
      expect(existsSync(contextDir)).toBe(false);
      expect(existsSync(devDir)).toBe(true);
      expect(
        (await runCli(["clean", "--scope", "user", "--force"], test.projectDir, test.fakeHome))
          .exitCode
      ).toBe(0);
    } finally {
      await test.cleanup();
    }
  });

  it("updates only the selected machine plugin and names dependent projects", async () => {
    const test = await createTestEnv("two-projects-targeted-user-update");
    try {
      const source = join(test.tempDir, "framework-source");
      const second = join(test.tempDir, "second");
      await copyFixtureTree(FRAMEWORK_REAL_PATH, source);
      await mkdir(second, { recursive: true });
      for (const cwd of [test.projectDir, second]) {
        expect(
          (
            await runCli(
              [
                "setup",
                "--source",
                "local",
                "--path",
                source,
                "--ai",
                "cursor",
                "--plugins",
                "aidd-context,aidd-dev",
                "--yes",
              ],
              cwd,
              test.fakeHome
            )
          ).exitCode
        ).toBe(0);
      }
      const userBase = join(test.fakeHome, ".cursor", "plugins", "local");
      const devBefore = await readdir(join(userBase, "aidd-dev"), { recursive: true });
      const hooksBefore = await Promise.all(
        [test.projectDir, second].map((cwd) =>
          readFile(join(cwd, ".cursor", "hooks.json"), "utf-8")
        )
      );
      const pluginJson = join(source, "plugins", "aidd-context", ".claude-plugin", "plugin.json");
      const marketJson = join(source, ".claude-plugin", "marketplace.json");
      const pluginData = JSON.parse(await readFile(pluginJson, "utf-8"));
      pluginData.version = "1.1.0";
      await writeFile(pluginJson, JSON.stringify(pluginData));
      const marketData = JSON.parse(await readFile(marketJson, "utf-8"));
      marketData.version = "1.1.0";
      const contextEntry = marketData.plugins.find(
        (entry: { name: string }) => entry.name === "aidd-context"
      );
      contextEntry.version = "1.1.0";
      await writeFile(marketJson, JSON.stringify(marketData));
      const skill = join(source, "plugins", "aidd-context", "skills", "01-bootstrap", "SKILL.md");
      await writeFile(skill, `${await readFile(skill, "utf-8")}\nMachine update marker.\n`);
      const update = await runCli(
        ["plugin", "update", "aidd-context", "--tool", "cursor", "--scope", "user"],
        test.projectDir,
        test.fakeHome
      );
      expect(update.exitCode).toBe(0);
      expect(update.stdout + update.stderr).toContain(await realpath(second));
      expect(
        await readFile(
          join(userBase, "aidd-context", "skills", "01-bootstrap", "SKILL.md"),
          "utf-8"
        )
      ).toContain("Machine update marker.");
      expect(await readdir(join(userBase, "aidd-dev"), { recursive: true })).toEqual(devBefore);
      expect(
        await Promise.all(
          [test.projectDir, second].map((cwd) =>
            readFile(join(cwd, ".cursor", "hooks.json"), "utf-8")
          )
        )
      ).toEqual(hooksBefore);
    } finally {
      await test.cleanup();
    }
  });
});
