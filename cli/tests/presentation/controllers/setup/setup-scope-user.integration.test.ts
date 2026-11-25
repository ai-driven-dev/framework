import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestEnv } from "../../../shared/testing/cli-sandbox.builder.js";
import { initRepository, sandboxGitEnv } from "../../../shared/testing/git-sandbox.builder.js";
import { runInProcess } from "../../../shared/testing/in-process-cli.builder.js";
import { FRAMEWORK_REAL, setupFromFixture } from "../../testing/fixture-setup.builder.js";
import { gitStatusPorcelain, readJson } from "../../testing/project-state.builder.js";

let project: string;
let home: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  ({ projectDir: project, fakeHome: home, cleanup } = await createTestEnv("scope-user-in-process"));
});

afterEach(async () => {
  await cleanup();
});

const aidd = (args: string[]) => runInProcess(args, { cwd: project, home });

describe("setup --scope user in a git-tracked project", () => {
  it("leaves the project untouched and writes the user manifest under the home", async () => {
    // A commit so `git status --porcelain` starts clean: in a freshly initialised directory
    // every file reads as untracked regardless of what `setup` wrote.
    initRepository(project, sandboxGitEnv(home));

    const setupResult = await aidd(setupFromFixture("claude", "none", ["--scope", "user"]));
    expect(setupResult.exitCode, setupResult.stderr).toBe(0);

    // A full-repository delta, not a list of paths this test happens to think of:
    // `setup --scope user` must land nothing under the project.
    expect(await gitStatusPorcelain(project)).toBe("");

    const manifest = await readJson(join(home, ".config", "aidd", "manifest.json"));
    expect(manifest.version).toBe(9);
    expect(Object.keys(manifest.tools as Record<string, unknown>)).toContain("claude");

    const marketplaces = await readJson(join(home, ".config", "aidd", "marketplaces.json"));
    const names = (marketplaces.marketplaces as Array<{ name: string }>).map((m) => m.name);
    expect(names).toContain("aidd-framework");

    // `--scope user` records no shared-source claim; asserted as absence-or-empty since another
    // project on the same home could in principle have written one.
    const references = await readJson(join(home, ".config", "aidd", "references.json")).catch(
      () => ({})
    );
    expect(Object.values(references).flat() as string[]).toEqual([]);

    // This sandbox has no `claude`/`codex`/`copilot` binary on PATH, so these two prove only
    // that the commands resolve the user manifest and exit cleanly with native activation unrun.
    const doctorResult = await aidd(["doctor", "--scope", "user"]);
    expect(doctorResult.exitCode).toBe(0);

    const syncResult = await aidd(["sync", "--scope", "user"]);
    expect(syncResult.exitCode).toBe(0);
    expect(await gitStatusPorcelain(project)).toBe("");
  });

  it("refuses a tool that has no user-scope activation, naming it", async () => {
    const result = await aidd(setupFromFixture("antigravity", "none", ["--scope", "user"]));

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("neither exists for: antigravity");
  });
});

describe("setup --global for OpenCode", () => {
  const globalOpencode = [
    "setup",
    "--global",
    "--source",
    "local",
    "--path",
    FRAMEWORK_REAL,
    "--ide",
    "opencode",
    "--plugins",
    "aidd-dev",
    "--yes",
  ];
  const agentPath = () => join(home, ".config", "opencode", "agents", "aidd-dev-reviewer.md");

  it("installs skills and agents for the machine, refreshes them, and cleans them", async () => {
    initRepository(project, sandboxGitEnv(home));

    const setup = await aidd(globalOpencode);
    expect(setup.stderr).toBe("");
    expect(setup.exitCode).toBe(0);
    expect(setup.stdout).toContain("Installed for every project on this machine: aidd-dev.");
    expect(await gitStatusPorcelain(project)).toBe("");
    expect(await readFile(agentPath(), "utf-8")).toMatch(/^mode: '?subagent'?$/m);
    expect(
      (await readdir(join(home, ".config", "opencode", "skills", "aidd-dev"))).length
    ).toBeGreaterThan(0);

    const sync = await aidd(["sync", "--global"]);
    expect(sync.exitCode).toBe(0);
    expect(sync.stdout).toContain("Refreshed global files for: aidd-dev");

    expect((await aidd(["clean", "--global", "--force"])).exitCode).toBe(0);
    await expect(readFile(agentPath(), "utf-8")).rejects.toThrow();
    expect(await gitStatusPorcelain(project)).toBe("");
  });

  it("preserves a pre-existing identical agent through refused setup and global clean", async () => {
    expect((await aidd(globalOpencode)).exitCode).toBe(0);
    const content = await readFile(agentPath(), "utf-8");
    expect((await aidd(["clean", "--global", "--force"])).exitCode).toBe(0);
    await mkdir(dirname(agentPath()), { recursive: true });
    await writeFile(agentPath(), content);

    const refused = await aidd(globalOpencode);
    expect(refused.exitCode).toBe(1);
    expect(refused.stderr).toContain("already exists and was not installed by aidd");
    expect((await aidd(["clean", "--global", "--force"])).exitCode).toBe(0);
    expect(await readFile(agentPath(), "utf-8")).toBe(content);
  });
});

describe("doctor and sync at --scope user", () => {
  it("honor --tool and refuse --plugin or a file argument rather than ignoring them", async () => {
    initRepository(project, sandboxGitEnv(home));
    const setup = await aidd(setupFromFixture("claude,codex", "none", ["--scope", "user"]));
    expect(setup.exitCode, setup.stderr).toBe(0);

    const scoped = await aidd(["doctor", "--scope", "user", "--tool", "claude"]);
    expect(scoped.exitCode).toBe(0);
    expect(scoped.stdout).toContain("claude");
    expect(scoped.stdout).not.toContain("codex");

    const doctorPlugin = await aidd(["doctor", "--scope", "user", "--plugin", "aidd-context"]);
    expect(doctorPlugin.exitCode).toBe(1);
    expect(doctorPlugin.stderr).toContain("--plugin");

    const syncPlugin = await aidd(["sync", "--scope", "user", "--plugin", "aidd-context"]);
    expect(syncPlugin.exitCode).toBe(1);
    expect(syncPlugin.stderr).toContain("--plugin");

    expect((await aidd(["sync", "--scope", "user", "some-file.md"])).exitCode).toBe(1);
  });
});
