import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestEnv } from "../../shared/testing/cli-sandbox.builder.js";
import { initRepository, sandboxGitEnv } from "../../shared/testing/git-sandbox.builder.js";
import { runInProcess } from "../../shared/testing/in-process-cli.builder.js";
import { setupFromFixture } from "../testing/fixture-setup.builder.js";
import {
  directoryExists,
  gitStatusPorcelain,
  listFilesUnder,
  readJson,
  seedEmptyManifest,
} from "../testing/project-state.builder.js";

interface MarketplacesFile {
  marketplaces: Array<{ name: string }>;
}

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

describe("cleaning the user scope after setup --scope user", () => {
  it("purges its own whitelist only, leaving auth.json, telemetry and another marketplace untouched", async () => {
    initRepository(project, sandboxGitEnv(home));
    const setup = await aidd(setupFromFixture("claude", "none", ["--scope", "user"]));
    expect(setup.exitCode, setup.stderr).toBe(0);

    const userConfigDir = join(home, ".config", "aidd");
    const marketplacesPath = join(userConfigDir, "marketplaces.json");
    const registered = await readJson<MarketplacesFile>(marketplacesPath);
    const entries = registered.marketplaces;
    expect(entries.map((m) => m.name)).toContain("aidd-framework");
    await writeFile(
      marketplacesPath,
      JSON.stringify({
        ...registered,
        marketplaces: [
          ...entries,
          {
            name: "other-marketplace",
            source: { kind: "local", path: "/src/other" },
            scope: "user",
            addedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
      "utf-8"
    );
    await writeFile(join(userConfigDir, "auth.json"), '{"version":1}', "utf-8");
    const telemetryFile = join(userConfigDir, "telemetry", "2026-01-01.jsonl");
    await mkdir(join(userConfigDir, "telemetry"), { recursive: true });
    await writeFile(telemetryFile, '{"kind":"session"}\n', "utf-8");
    const builtDir = join(userConfigDir, "cache", "built", "9.9.9", "aidd-framework", "claude");
    await mkdir(builtDir, { recursive: true });
    await writeFile(join(builtDir, "marker.json"), "{}", "utf-8");

    const cleaned = await aidd(["clean", "--scope", "user", "--force"]);

    expect(cleaned.exitCode, cleaned.stderr).toBe(0);
    expect(await gitStatusPorcelain(project)).toBe("");
    const after = (await listFilesUnder(userConfigDir)).sort();
    expect(after).toEqual(
      ["auth.json", "marketplaces.json", join("telemetry", "2026-01-01.jsonl")].sort()
    );
    const left = await readJson<MarketplacesFile>(marketplacesPath);
    const names = left.marketplaces.map((m) => m.name);
    expect(names).not.toContain("aidd-framework");
    expect(names).toContain("other-marketplace");
    expect(await readFile(telemetryFile, "utf-8")).toBe('{"kind":"session"}\n');
    expect(await readFile(join(userConfigDir, "auth.json"), "utf-8")).toBe('{"version":1}');
  });
});

describe("cleaning a project whose claude registration cannot be withdrawn", () => {
  it("leaves the host's plugin cache in place when the claude CLI is not on PATH", async () => {
    const marketplace = "aidd-clean-cache-marketplace";
    await mkdir(join(project, ".aidd"), { recursive: true });
    await writeFile(
      join(project, ".aidd", "manifest.json"),
      JSON.stringify({
        version: 8,
        tools: {
          claude: {
            toolId: "claude",
            version: "1.0.0",
            files: [],
            nativeRegistrations: {
              binary: "claude",
              marketplaces: [{ alias: marketplace, hostName: marketplace }],
              pluginRefs: [],
            },
          },
        },
      }),
      "utf-8"
    );
    const cacheDir = join(home, ".claude", "plugins", "cache", marketplace, "plugin-a");
    await mkdir(cacheDir, { recursive: true });
    const cacheFile = join(cacheDir, "plugin.json");
    await writeFile(cacheFile, "{}", "utf-8");

    const { exitCode } = await aidd(["clean", "--force"]);

    expect(exitCode).toBe(0);
    expect(existsSync(cacheFile)).toBe(true);
  });
});
