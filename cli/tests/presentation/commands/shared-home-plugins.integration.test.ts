import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, realpath, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { copyFixtureTree, createTestEnv } from "../../e2e/helpers.js";
import { FRAMEWORK_REAL, setupFromFixture } from "../../helpers/fixture-setup.js";
import { runInProcess } from "../../helpers/in-process-cli.js";

let first: string;
let second: string;
let root: string;
let home: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  const env = await createTestEnv("shared-home-in-process");
  ({ projectDir: first, fakeHome: home, cleanup } = env);
  root = env.tempDir;
  second = join(root, "second");
  await mkdir(second, { recursive: true });
});

afterEach(async () => {
  await cleanup();
});

const aidd = (args: string[], cwd: string) => runInProcess(args, { cwd, home });
const userPlugins = () => join(home, ".cursor", "plugins", "local");
const names = "aidd-context,aidd-dev";

describe("two projects on one home that installed the same cursor plugins", () => {
  it("removes one machine-owned plugin only after both projects detach", async () => {
    for (const cwd of [first, second]) {
      const setup = await aidd(setupFromFixture("cursor", names), cwd);
      expect(setup.exitCode, setup.stderr).toBe(0);
    }
    const contextDir = join(userPlugins(), "aidd-context");
    const devDir = join(userPlugins(), "aidd-dev");
    const remove = ["plugin", "remove", "aidd-context", "--tool", "cursor", "--scope", "user"];

    const blocked = await aidd(remove, first);

    expect(blocked.exitCode).not.toBe(0);
    expect(blocked.stdout + blocked.stderr).toContain(await realpath(second));
    expect(existsSync(contextDir)).toBe(true);
    for (const cwd of [first, second]) {
      expect((await aidd(["clean", "--force"], cwd)).exitCode).toBe(0);
    }
    const removed = await aidd(remove, first);
    expect(removed.exitCode).toBe(0);
    expect(existsSync(contextDir)).toBe(false);
    expect(existsSync(devDir)).toBe(true);
    expect((await aidd(["clean", "--scope", "user", "--force"], first)).exitCode).toBe(0);
  });

  it("updates only the selected machine plugin and names dependent projects", async () => {
    const source = join(root, "framework-source");
    await copyFixtureTree(FRAMEWORK_REAL, source);
    for (const cwd of [first, second]) {
      const setup = await aidd(setupFromFixture("cursor", names, [], source), cwd);
      expect(setup.exitCode, setup.stderr).toBe(0);
    }
    const devBefore = await readdir(join(userPlugins(), "aidd-dev"), { recursive: true });
    const hooks = () =>
      Promise.all(
        [first, second].map((cwd) => readFile(join(cwd, ".cursor", "hooks.json"), "utf-8"))
      );
    const hooksBefore = await hooks();
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

    const update = await aidd(
      ["plugin", "update", "aidd-context", "--tool", "cursor", "--scope", "user"],
      first
    );

    expect(update.exitCode).toBe(0);
    expect(update.stdout + update.stderr).toContain(await realpath(second));
    expect(
      await readFile(
        join(userPlugins(), "aidd-context", "skills", "01-bootstrap", "SKILL.md"),
        "utf-8"
      )
    ).toContain("Machine update marker.");
    expect(await readdir(join(userPlugins(), "aidd-dev"), { recursive: true })).toEqual(devBefore);
    expect(await hooks()).toEqual(hooksBefore);
  });
});
