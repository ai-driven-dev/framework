import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { environmentWithoutGitVariables } from "../../src/runtime/git/git-environment.js";
import {
  directoryExists,
  gitStatusPorcelain,
  listFilesUnder,
  readJson,
} from "../helpers/project-state.js";
import { createTestEnv, gitInit, runCli } from "./helpers.js";

// CI runners carry no git identity; a commit made by a test brings its own.
const GIT_TEST_IDENTITY = ["-c", "user.email=t@t.com", "-c", "user.name=t"];

const execFileAsync = promisify(execFile);
const FRAMEWORK_REAL_PATH = resolve(process.cwd(), "tests/fixtures/framework-real");

describe("E2E: clean --scope user purges the shared source", () => {
  it("purges its own whitelist only, leaving auth.json, telemetry/ and an unrelated marketplace entry untouched, after setup --scope user", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("clean-scope-user");
    try {
      await gitInit(projectDir);
      await execFileAsync("git", [...GIT_TEST_IDENTITY, "commit", "--allow-empty", "-m", "empty"], {
        cwd: projectDir,
        env: environmentWithoutGitVariables(process.env),
      });

      const setupResult = await runCli(
        [
          "setup",
          "--source",
          "local",
          "--path",
          FRAMEWORK_REAL_PATH,
          "--ai",
          "claude",
          "--plugins",
          "none",
          "--yes",
          "--scope",
          "user",
        ],
        projectDir,
        fakeHome
      );
      expect(setupResult.exitCode).toBe(0);

      const userConfigDir = join(fakeHome, ".config", "aidd");
      const marketplacesPath = join(userConfigDir, "marketplaces.json");
      const beforeMarketplaces = await readJson(marketplacesPath);
      const beforeNames = (beforeMarketplaces.marketplaces as Array<{ name: string }>).map(
        (m) => m.name
      );
      expect(beforeNames).toContain("aidd-framework");

      // A second, unrelated registration, plus the two files this whitelist has no
      // business touching — `clean --scope user` must leave every one of them alone.
      const marketplaces = beforeMarketplaces.marketplaces as Array<Record<string, unknown>>;
      marketplaces.push({
        name: "other-marketplace",
        source: { kind: "local", path: "/src/other" },
        scope: "user",
        addedAt: "2026-01-01T00:00:00.000Z",
      });
      await writeFile(
        marketplacesPath,
        JSON.stringify({ ...beforeMarketplaces, marketplaces }, null, 2),
        "utf-8"
      );
      await writeFile(join(userConfigDir, "auth.json"), '{"version":1}', "utf-8");
      const telemetryFile = join(userConfigDir, "telemetry", "2026-01-01.jsonl");
      await mkdir(join(userConfigDir, "telemetry"), { recursive: true });
      await writeFile(telemetryFile, '{"kind":"session"}\n', "utf-8");

      // This sandbox reaches no real `claude` binary, so `setup --scope user` never builds
      // the shared source's tree here; the fixture stands in for what a host would leave.
      const builtDir = join(userConfigDir, "cache", "built", "9.9.9", "aidd-framework", "claude");
      await mkdir(builtDir, { recursive: true });
      await writeFile(join(builtDir, "marker.json"), "{}", "utf-8");
      // The self-update check cache, aidd's own file beside `built/`, so the whitelist takes
      // it too — and only then is the `cache/` shell around both empty enough to go.
      await writeFile(
        join(userConfigDir, "cache", "update-check.json"),
        '{"checkedAt":0,"latest":"9.9.9"}',
        "utf-8"
      );

      const before = (await listFilesUnder(userConfigDir)).sort();
      expect(before).toContain(
        join("cache", "built", "9.9.9", "aidd-framework", "claude", "marker.json")
      );
      expect(before).toContain(join("cache", "update-check.json"));

      const cleanResult = await runCli(
        ["clean", "--scope", "user", "--force"],
        projectDir,
        fakeHome
      );
      expect(cleanResult.exitCode).toBe(0);

      // `setup --scope user` never touches the project, and neither does
      // `clean --scope user` — both are machine-scope operations.
      expect(await gitStatusPorcelain(projectDir)).toBe("");

      const after = (await listFilesUnder(userConfigDir)).sort();
      // The full delta, not a list of paths this test happens to think of, so a file the
      // whitelist has no business under fails here rather than going unnoticed.
      expect(before).not.toEqual(after);
      expect(after).toEqual(
        ["auth.json", "marketplaces.json", join("telemetry", "2026-01-01.jsonl")].sort()
      );
      const afterMarketplaces = await readJson(marketplacesPath);
      const afterNames = (afterMarketplaces.marketplaces as Array<{ name: string }>).map(
        (m) => m.name
      );
      expect(afterNames).not.toContain("aidd-framework");
      expect(afterNames).toContain("other-marketplace");
      expect(await readFile(telemetryFile, "utf-8")).toBe('{"kind":"session"}\n');
      // `listFilesUnder` sees files, never an empty directory, so the shell itself has to
      // be asked for by name.
      expect(await directoryExists(join(userConfigDir, "cache"))).toBe(false);
    } finally {
      await cleanup();
    }
  });
});
