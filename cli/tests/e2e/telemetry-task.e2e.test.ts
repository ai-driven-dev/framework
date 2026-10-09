import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { git, initRepository, sandboxGitEnv } from "../helpers/git-sandbox.js";
import { createTestEnv, runCli } from "./helpers.js";

const GRANTED = JSON.stringify({ telemetry: { enabled: true, version: 2 } });
const SESSION = "00000000-0000-4000-8000-0000000000aa";

let env: Awaited<ReturnType<typeof createTestEnv>>;
let repo: string;
let telemetry: string;
let gitEnv: NodeJS.ProcessEnv;

beforeEach(async () => {
  env = await createTestEnv("telemetry-task");
  gitEnv = sandboxGitEnv(env.fakeHome);
  repo = join(env.tempDir, "repo");
  telemetry = join(env.tempDir, "telemetry-dir");
  initRepository(repo, gitEnv, { remote: "git@github.com:acme/widgets.git" });
  git(repo, gitEnv, "switch", "-q", "-c", "feat/x");
  await mkdir(join(repo, ".aidd"));
  await writeFile(join(repo, ".aidd", "config.json"), GRANTED);
});
afterEach(async () => {
  await env.cleanup();
});

/** `CLAUDE_CODE_SESSION_ID` is set explicitly in every run: it is in the environment of the
 * session that runs this suite, and a leaked one would bind the wrong session. */
function task(args: string[], extra: Record<string, string> = {}) {
  return runCli(["telemetry", "task", ...args], repo, env.fakeHome, {
    env: {
      AIDD_TELEMETRY_DIR: telemetry,
      AIDD_TELEMETRY: "",
      CLAUDE_CODE_SESSION_ID: SESSION,
      ...extra,
    },
  });
}
const config = (key: string) => git(repo, gitEnv, "config", "--local", "--get", key).trim();
const sessionLines = async () =>
  (await readFile(join(telemetry, "bindings", "sessions.jsonl"), "utf8"))
    .split("\n")
    .filter(Boolean);

describe("aidd telemetry task", () => {
  it("binds the session and the branch and prints what it bound", async () => {
    const run = await task(["checkout-fix", "--ticket", "PROJ-12"]);
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain('Declared task "checkout-fix" (ticket PROJ-12).');
    expect(run.stdout).toContain("Session 00000000 is bound from now on.");
    expect(run.stdout).toContain("Branch feat/x is bound.");
    expect(config("branch.feat/x.aiddTask")).toBe("checkout-fix");
    expect(config("branch.feat/x.aiddTicket")).toBe("PROJ-12");
    expect(JSON.parse((await sessionLines())[0] ?? "")).toMatchObject({
      session_id: SESSION,
      task: "checkout-fix",
      ticket: "PROJ-12",
      none: false,
      by: "command",
    });
  });

  it("snapshots the branch declaration at once", async () => {
    await task(["checkout-fix"]);
    const snapshots = (await readFile(join(telemetry, "bindings", "branches.jsonl"), "utf8"))
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({ branch: "feat/x", task: "checkout-fix" });
    expect(snapshots[0].branch_created_at).not.toBeNull();
  });

  it("shows the binding and where it comes from", async () => {
    await task(["checkout-fix", "--ticket", "PROJ-12"]);
    const shown = await task([]);
    expect(shown.exitCode).toBe(0);
    expect(shown.stdout).toContain(
      'Bound to task "checkout-fix" (ticket PROJ-12), declared in session 00000000'
    );
    const outside = await task([], { CLAUDE_CODE_SESSION_ID: "" });
    expect(outside.stdout).toContain("declared on branch feat/x");
  });

  it("says nothing is bound before a declaration", async () => {
    expect((await task([])).stdout).toContain(
      "Nothing is bound: branch feat/x and session 00000000"
    );
  });

  it("declares none, once, on the branch", async () => {
    const run = await task(["--none"]);
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain("Declared no task.");
    expect(config("branch.feat/x.aiddDeclaredAt")).not.toBe("");
    expect(() => config("branch.feat/x.aiddTask")).toThrow();
    expect((await task([], { CLAUDE_CODE_SESSION_ID: "" })).stdout).toContain(
      "no task (declared none)"
    );
  });

  it("keeps both declarations of a session, the later one applying", async () => {
    await task(["first"]);
    await task(["second"]);
    expect((await sessionLines()).map((line) => JSON.parse(line).task)).toEqual([
      "first",
      "second",
    ]);
    expect((await task([])).stdout).toContain('task "second"');
  });

  it("marks a declaration made by a hook", async () => {
    await task(["hooked", "--by", "hook-intercept"]);
    expect(JSON.parse((await sessionLines())[0] ?? "").by).toBe("hook-intercept");
  });

  it("binds the session only on the default branch, and leaves git config alone", async () => {
    git(repo, gitEnv, "switch", "-q", "main");
    const before = git(repo, gitEnv, "config", "--local", "--list");
    const run = await task(["on-main"]);
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain("Branch left untouched: main is the default branch.");
    expect(git(repo, gitEnv, "config", "--local", "--list")).toBe(before);
    expect(await sessionLines()).toHaveLength(1);
  });

  it("binds the session only on a detached head", async () => {
    git(repo, gitEnv, "checkout", "-q", "--detach");
    const run = await task(["detached-work"]);
    expect(run.stdout).toContain("Branch left untouched: HEAD is detached.");
    expect(await sessionLines()).toHaveLength(1);
  });

  it("binds the branch only outside a session", async () => {
    const run = await task(["no-session"], { CLAUDE_CODE_SESSION_ID: "" });
    expect(run.stdout).toContain("No Claude session here");
    expect(config("branch.feat/x.aiddTask")).toBe("no-session");
    await expect(readFile(join(telemetry, "bindings", "sessions.jsonl"), "utf8")).rejects.toThrow();
  });

  it("warns that nothing was bound on the default branch outside a session", async () => {
    git(repo, gitEnv, "switch", "-q", "main");
    const run = await task(["nowhere"], { CLAUDE_CODE_SESSION_ID: "" });
    expect(run.exitCode).toBe(0);
    expect(run.stderr + run.stdout).toContain("Nothing was bound");
  });

  it("refuses a project that has not opted in, naming the command that opts in", async () => {
    await rm(join(repo, ".aidd", "config.json"));
    const run = await task(["t"]);
    expect(run.exitCode).toBe(1);
    expect(run.stderr + run.stdout).toContain("aidd telemetry on");
    await expect(readFile(join(telemetry, "bindings", "sessions.jsonl"), "utf8")).rejects.toThrow();
    expect(() => config("branch.feat/x.aiddTask")).toThrow();
  });

  it("refuses a project whose consent is the previous version's bare enabled", async () => {
    await writeFile(
      join(repo, ".aidd", "config.json"),
      JSON.stringify({ telemetry: { enabled: true } })
    );
    expect((await task(["t"])).exitCode).toBe(1);
  });

  it("refuses under AIDD_TELEMETRY=0", async () => {
    const run = await task(["t"], { AIDD_TELEMETRY: "0" });
    expect(run.exitCode).toBe(1);
    expect(run.stderr + run.stdout).toContain("AIDD_TELEMETRY=0");
    expect(() => config("branch.feat/x.aiddTask")).toThrow();
  });

  it.each([
    [["--none", "t"], "--none declares no task"],
    [["--none", "--ticket", "P-1"], "--none declares no task"],
    [["--ticket", "P-1"], "A task needs a name"],
    [["   "], "A task needs a name"],
  ])("rejects %j before touching anything", async (args, message) => {
    const run = await task(args);
    expect(run.exitCode).toBe(1);
    expect(run.stderr + run.stdout).toContain(message);
    expect(() => config("branch.feat/x.aiddTask")).toThrow();
  });

  it("rejects an unknown declarer, and does not list it in the help", async () => {
    expect((await task(["t", "--by", "robot"])).exitCode).not.toBe(0);
    const help = await runCli(["telemetry", "task", "--help"], repo, env.fakeHome);
    expect(help.stdout).not.toContain("--by");
    expect(help.stdout).toContain("--ticket");
  });
});
