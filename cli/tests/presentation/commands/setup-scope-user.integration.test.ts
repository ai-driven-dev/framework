import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestEnv } from "../../e2e/helpers.js";
import { setupFromFixture } from "../../helpers/fixture-setup.js";
import { initRepository, sandboxGitEnv } from "../../helpers/git-sandbox.js";
import { runInProcess } from "../../helpers/in-process-cli.js";
import { gitStatusPorcelain, readJson } from "../../helpers/project-state.js";

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
    expect(manifest.version).toBe(8);
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
});
