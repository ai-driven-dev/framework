import { cp, mkdir, readdir, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createTestEnv } from "../../e2e/helpers.js";
import { FRAMEWORK_REAL, setupFromFixture } from "../../helpers/fixture-setup.js";
import { runInProcess } from "../../helpers/in-process-cli.js";
import { readJson } from "../../helpers/project-state.js";

type Machine = Awaited<ReturnType<typeof createTestEnv>>;

const machines: Machine[] = [];

async function machine(prefix: string): Promise<Machine> {
  const created = await createTestEnv(prefix);
  machines.push(created);
  return created;
}

afterEach(async () => {
  await Promise.all(machines.splice(0).map((m) => m.cleanup()));
});

const aidd = (args: string[], cwd: string, home: string) => runInProcess(args, { cwd, home });

async function exists(path: string): Promise<boolean> {
  return await stat(path)
    .then(() => true)
    .catch(() => false);
}

/**
 * The pre-migration shape, which no code path still writes: a project-scope registry entry,
 * its build under `.aidd/cache/built/`, and a shared registry that knows nothing of it.
 */
async function seedPreMigrationState(projectDir: string, home: string): Promise<void> {
  const userConfigDir = join(home, ".config", "aidd");
  const builtRoot = join(userConfigDir, "cache", "built");
  const [version] = await readdir(builtRoot);
  if (version === undefined) throw new Error("setup did not build the shared source");
  const sharedBuiltClaude = join(builtRoot, version, "aidd-framework", "claude");
  const projectCacheClaude = join(
    projectDir,
    ".aidd",
    "cache",
    "built",
    "aidd-framework",
    "claude"
  );
  await mkdir(join(projectDir, ".aidd", "cache", "built", "aidd-framework"), { recursive: true });
  await cp(sharedBuiltClaude, projectCacheClaude, { recursive: true });

  await writeFile(
    join(userConfigDir, "marketplaces.json"),
    JSON.stringify({ version: 1, marketplaces: [] }, null, 2)
  );
  await rm(join(userConfigDir, "references.json"), { force: true });

  await writeFile(
    join(projectDir, ".aidd", "marketplaces.json"),
    JSON.stringify(
      {
        version: 1,
        marketplaces: [
          {
            name: "aidd-framework",
            source: { kind: "local", path: FRAMEWORK_REAL },
            scope: "project",
            addedAt: "2020-01-01T00:00:00.000Z",
          },
        ],
      },
      null,
      2
    )
  );
}

/**
 * A clone never carries what its own `.gitignore` excludes, `.aidd/cache/` chief among them,
 * so stripping it is what makes the copy a faithful stand-in for a fresh `git clone`.
 */
async function cloneProjectWithoutCache(sourceDir: string, destDir: string): Promise<void> {
  await cp(sourceDir, destDir, { recursive: true });
  await rm(join(destDir, ".aidd", "cache"), { recursive: true, force: true });
}

describe("sync in a project installed before the shared source", () => {
  it("moves the registry entry to user scope, keeps this project's own stale cache while claude's binary stays off PATH, and warns why", async () => {
    const env = await machine("sync-migrates-project-scope");
    const setupResult = await aidd(
      setupFromFixture("claude", "none"),
      env.projectDir,
      env.fakeHome
    );
    expect(setupResult.exitCode, setupResult.stderr).toBe(0);
    await seedPreMigrationState(env.projectDir, env.fakeHome);
    const userConfigDir = join(env.fakeHome, ".config", "aidd");
    const projectCacheDir = join(env.projectDir, ".aidd", "cache", "built", "aidd-framework");
    expect(
      ((await readJson(join(userConfigDir, "marketplaces.json"))).marketplaces as unknown[]).length
    ).toBe(0);
    expect(await exists(projectCacheDir)).toBe(true);

    const syncResult = await aidd(["sync"], env.projectDir, env.fakeHome);

    expect(syncResult.exitCode).toBe(0);
    expect(syncResult.stderr).toContain(
      "claude: the plugin will not load until the claude CLI has run."
    );
    const userMarketplaces = await readJson(join(userConfigDir, "marketplaces.json"));
    const migrated = (userMarketplaces.marketplaces as Array<{ name: string; scope: string }>).find(
      (m) => m.name === "aidd-framework"
    );
    expect(migrated?.scope).toBe("user");
    const projectMarketplaces = await readJson(join(env.projectDir, ".aidd", "marketplaces.json"));
    expect(
      (projectMarketplaces.marketplaces as Array<{ name: string }>).some(
        (m) => m.name === "aidd-framework"
      )
    ).toBe(false);
    // claude's binary never ran in this sandbox, so a host registration still naming this cache
    // never moved off it: purging it would leave nothing to resolve.
    expect(await exists(projectCacheDir)).toBe(true);
    expect(syncResult.stderr).toContain("pre-migration framework cache kept");
    const doctorResult = await aidd(["doctor"], env.projectDir, env.fakeHome);
    expect(doctorResult.exitCode).toBe(0);
    expect(doctorResult.stdout + doctorResult.stderr).not.toContain("aidd sync");
  });
});

describe("sync on a machine that never ran setup", () => {
  it("registers the shared marketplace without inventing a host-source reference when activation is unavailable", async () => {
    const origin = await machine("machine-scope-sync-origin");
    const clone = await machine("machine-scope-sync-clone");
    const setupResult = await aidd(
      setupFromFixture("claude", "none"),
      origin.projectDir,
      origin.fakeHome
    );
    expect(setupResult.exitCode, setupResult.stderr).toBe(0);
    // A second machine checking out the same project for the first time: its own user config
    // dir has never run `setup`, so `marketplaces.json` does not exist there.
    await cloneProjectWithoutCache(origin.projectDir, clone.projectDir);

    const syncResult = await aidd(["sync"], clone.projectDir, clone.fakeHome);

    expect(syncResult.exitCode).toBe(0);
    // Native activation genuinely could not run in this sandbox (no drivable tool binary on
    // PATH), so the marketplace is registered but the plugin will not load yet.
    expect(syncResult.stderr).toContain(
      "claude: the plugin will not load until the claude CLI has run."
    );
    const marketplaces = await readJson(
      join(clone.fakeHome, ".config", "aidd", "marketplaces.json")
    );
    const names = (marketplaces.marketplaces as Array<{ name: string }>).map((m) => m.name);
    expect(names).toContain("aidd-framework");
    await expect(
      readFile(join(clone.fakeHome, ".config", "aidd", "references.json"))
    ).rejects.toMatchObject({ code: "ENOENT" });
  });
});

describe("a second project's setup on a machine that already registered the source", () => {
  it("adds its own reference, never replacing the first", async () => {
    const first = await machine("machine-scope-shared-home-first");
    const second = await machine("machine-scope-shared-home-second");
    // Both projects share one machine, the first one's home, so the second `setup` finds the
    // source registered and must count two claims, not replace one.
    const firstSetup = await aidd(
      setupFromFixture("claude", "none"),
      first.projectDir,
      first.fakeHome
    );
    expect(firstSetup.exitCode, firstSetup.stderr).toBe(0);

    const secondSetup = await aidd(
      setupFromFixture("claude", "none"),
      second.projectDir,
      first.fakeHome
    );
    expect(secondSetup.exitCode, secondSetup.stderr).toBe(0);

    const references = await readJson(join(first.fakeHome, ".config", "aidd", "references.json"));
    const allProjectRoots = Object.values(references).flat() as string[];
    expect(allProjectRoots).toContain(await realpath(first.projectDir));
    expect(allProjectRoots).toContain(await realpath(second.projectDir));
    expect(allProjectRoots).toHaveLength(2);
  });
});
