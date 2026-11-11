import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestEnv } from "../../e2e/helpers.js";
import { FRAMEWORK_REAL, setupFromFixture } from "../../helpers/fixture-setup.js";
import { runInProcess } from "../../helpers/in-process-cli.js";
import { readJson, seedEmptyManifest } from "../../helpers/project-state.js";

type PluginEntry = { name: string; version?: string };
type ManifestShape = { version: number; tools: Record<string, { plugins?: PluginEntry[] }> };

let project: string;
let home: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  ({ projectDir: project, fakeHome: home, cleanup } = await createTestEnv("setup-in-process"));
});

afterEach(async () => {
  await cleanup();
});

const aidd = (args: string[]) => runInProcess(args, { cwd: project, home });
const manifestPath = () => join(project, ".aidd", "manifest.json");
const readManifest = async () => readJson<ManifestShape>(manifestPath());

describe("setup from a local source with a named plugin", () => {
  beforeEach(async () => {
    await seedEmptyManifest(project);
  });

  it("does not crash when it runs a second time", async () => {
    await aidd(setupFromFixture("claude", "aidd-context"));

    const { exitCode, stderr } = await aidd(setupFromFixture("claude", "aidd-context"));

    expect(exitCode).toBe(0);
    expect(stderr).not.toContain("local path does not exist");
  });

  it("propagates the catalog version to a new tool when the manifest recorded a drifted one", async () => {
    // The local fixture's catalog declares aidd-dev 1.0.0.
    await aidd(setupFromFixture("claude", "aidd-dev"));
    const manifestBefore = await readManifest();
    for (const plugin of manifestBefore.tools.claude?.plugins ?? []) {
      if (plugin.name === "aidd-dev") plugin.version = "0.9.0";
    }
    await writeFile(manifestPath(), JSON.stringify(manifestBefore), "utf-8");

    const { exitCode, stdout, stderr } = await aidd(["framework", "install", "--tool", "cursor"]);

    expect(exitCode).toBe(0);
    expect(stderr).not.toContain("VersionMismatchError");
    expect(stderr).not.toContain("version mismatch");
    expect(stdout).toContain("aidd-dev");
    const manifestAfter = await readManifest();
    const propagated = (manifestAfter.tools.cursor?.plugins ?? []).find(
      (p) => p.name === "aidd-dev"
    );
    expect(propagated).toBeDefined();
  });
});

describe("setup from the local framework fixture", () => {
  it("writes the tools to the manifest and the framework marketplace to the user config", async () => {
    const { stdout, exitCode } = await aidd(setupFromFixture("claude", "none"));

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Installed");
    const manifest = await readManifest();
    expect(manifest.version).toBe(8);
    expect(manifest.tools).toHaveProperty("claude");
    // The framework marketplace is machine-scope: every project on this machine shares one
    // registration, so it lives under the user config dir, never under the project's `.aidd/`.
    const marketplaces = (await readJson(join(home, ".config", "aidd", "marketplaces.json"))) as {
      marketplaces: Array<{ name: string; source: { kind: string; path: string } }>;
    };
    const fw = marketplaces.marketplaces.find((m) => m.name === "aidd-framework");
    expect(fw).toBeDefined();
    expect(fw?.source.kind).toBe("local");
    expect(fw?.source.path).toBe(FRAMEWORK_REAL);
  });

  it("adds a second tool to the manifest when it runs again with one more", async () => {
    const first = await aidd(setupFromFixture("claude", "none"));
    expect(first.exitCode).toBe(0);
    const afterFirst = await readManifest();
    expect(afterFirst.tools).toHaveProperty("claude");
    expect(afterFirst.tools).not.toHaveProperty("cursor");

    const second = await aidd(setupFromFixture("claude,cursor", "none"));

    expect(second.exitCode).toBe(0);
    const afterSecond = await readManifest();
    expect(afterSecond.tools).toHaveProperty("claude");
    expect(afterSecond.tools).toHaveProperty("cursor");
  });
});
