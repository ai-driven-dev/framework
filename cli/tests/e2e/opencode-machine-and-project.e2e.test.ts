import { access, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Manifest } from "../../src/contexts/installation/domain/manifest.js";
import { posixRelative } from "../../src/shared/domain/paths.model.js";
import { createTestEnv, FRAMEWORK_PATH, runCli } from "../shared/testing/cli-sandbox.builder.js";
import { resolveRegisteredToolId, TOOL } from "../shared/testing/registered-tools.builder.js";

const SETUP = ["setup", "--source", "local", "--path", FRAMEWORK_PATH, "--ai", "opencode"];
const PLUGIN = ["--plugins", "aidd-test", "--yes"];

describe("an opencode project set up again once the machine installed the same plugin", () => {
  let test: Awaited<ReturnType<typeof createTestEnv>>;
  const run = (...args: string[]) => runCli(args, test.projectDir, test.fakeHome);
  const placed = async (): Promise<string[]> => {
    const dir = join(test.projectDir, ".opencode");
    const entries = await readdir(dir, { recursive: true, withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) =>
        posixRelative(test.projectDir, join(entry.parentPath, entry.name), process.platform)
      )
      .sort();
  };
  const tracked = async (): Promise<string[]> => {
    const raw = await readFile(join(test.projectDir, ".aidd/manifest.json"), "utf-8");
    const manifest = Manifest.fromJSON(JSON.parse(raw), resolveRegisteredToolId);
    return [
      ...manifest.getToolFiles(TOOL.opencode).map((file) => file.relativePath),
      ...manifest.getPlugins(TOOL.opencode).flatMap((plugin) => [...plugin.files.keys()]),
    ]
      .filter((path) => path.startsWith(".opencode/"))
      .sort();
  };

  beforeAll(async () => {
    test = await createTestEnv("opencode-machine-and-project");
    for (const scope of [[], ["--global"], []]) {
      const setup = await run(...SETUP, ...PLUGIN, ...scope);
      expect(setup.exitCode, setup.stderr).toBe(0);
    }
  });
  afterAll(() => test.cleanup());

  it("tracks every file it placed in the project", async () => {
    expect(await tracked()).toEqual(await placed());
  });

  it("removes every file it placed on clean, and the directory they leave empty", async () => {
    const clean = await run("clean", "--force");

    expect(clean.exitCode, clean.stderr).toBe(0);
    await expect(access(join(test.projectDir, ".opencode"))).rejects.toThrow("ENOENT");
  });
});
