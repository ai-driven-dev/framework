import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestEnv } from "../../e2e/helpers.js";
import { setupFromFixture } from "../../helpers/fixture-setup.js";
import { initRepository, sandboxGitEnv } from "../../helpers/git-sandbox.js";
import { runInProcess } from "../../helpers/in-process-cli.js";
import {
  directoryExists,
  gitStatusPorcelain,
  listFilesUnder,
  readJson,
  seedEmptyManifest,
} from "../../helpers/project-state.js";

let project: string;
let home: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  const env = await createTestEnv("clean-in-process");
  ({ projectDir: project, fakeHome: home, cleanup } = env);
});

afterEach(async () => {
  await cleanup();
});

const aidd = (args: string[]) => runInProcess(args, { cwd: project, home });

describe("cleaning a project that holds several installed tools", () => {
  it("removes every tool directory and the manifest when several tools are installed", async () => {
    await seedEmptyManifest(project);
    await aidd(["framework", "install", "--tool", "claude"]);
    await aidd(["framework", "install", "--tool", "cursor"]);

    const { stdout, exitCode } = await aidd(["clean", "--force"]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Cleaned");
    expect(existsSync(join(project, ".claude"))).toBe(false);
    expect(existsSync(join(project, ".cursor"))).toBe(false);
    expect(existsSync(join(project, ".aidd"))).toBe(false);
  });
});

describe("cleaning the user scope after a plain project-scope setup", () => {
  it("still purges the whitelist when no user manifest exists", async () => {
    const git = sandboxGitEnv(home);
    initRepository(project, git);
    // A plain, project-scope setup, no `--scope user`, never writes a user manifest, yet still
    // registers the shared source machine-wide.
    const setup = await aidd(setupFromFixture("claude", "none"));
    expect(setup.exitCode, setup.stderr).toBe(0);

    const userConfigDir = join(home, ".config", "aidd");
    const before = (await listFilesUnder(userConfigDir)).sort();
    expect(before.some((f) => f.startsWith(join("cache", "built")))).toBe(true);
    expect(before).toContain("references.json");
    expect(await readJson(join(userConfigDir, "manifest.json")).catch(() => null)).toBeNull();

    const blocked = await aidd(["clean", "--scope", "user", "--force"]);
    expect(blocked.exitCode).toBe(1);
    expect(blocked.stderr).toContain(project);

    const projectClean = await aidd(["clean", "--scope", "project", "--force"]);
    expect(projectClean.exitCode).toBe(0);
    const statusBeforeClean = await gitStatusPorcelain(project);
    const cleanResult = await aidd(["clean", "--scope", "user", "--force"]);

    expect(cleanResult.exitCode).toBe(0);
    expect(cleanResult.stdout).toContain("No host registration was undone");
    expect(await gitStatusPorcelain(project)).toBe(statusBeforeClean);

    const after = (await listFilesUnder(userConfigDir)).sort();
    expect(after).not.toContain("references.json");
    expect(after.some((f) => f.startsWith("cache"))).toBe(false);
    expect(await directoryExists(join(userConfigDir, "cache"))).toBe(false);
    const afterMarketplaces = await readJson(join(userConfigDir, "marketplaces.json"));
    const afterNames = (afterMarketplaces.marketplaces as Array<{ name: string }>).map(
      (m) => m.name
    );
    expect(afterNames).not.toContain("aidd-framework");
  });
});
