import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { git, initRepository, sandboxGitEnv } from "../helpers/git-sandbox.js";
import { createTestEnv, runCli } from "./helpers.js";

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
  await runCli(["telemetry", "on", "--yes", "--anonymous"], repo, env.fakeHome, {
    env: { AIDD_TELEMETRY_DIR: telemetry, AIDD_TELEMETRY: "" },
  });
});
afterEach(async () => {
  await env.cleanup();
});

/** `CLAUDE_CODE_SESSION_ID` is set explicitly in every run: it is in the environment of the
 * session that runs this suite, and a leaked one would bind the wrong session. */
function task(args: string[], extra: Record<string, string> = {}) {
  return telemetryCommand(["task", ...args], extra);
}
function status(extra: Record<string, string> = {}) {
  return telemetryCommand(["status"], extra);
}
function telemetryCommand(args: string[], extra: Record<string, string>) {
  return runCli(["telemetry", ...args], repo, env.fakeHome, {
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

  it("declares at once while an ingest holds the ledger lock", async () => {
    await mkdir(join(telemetry, "ledger"), { recursive: true });
    await writeFile(
      join(telemetry, "ledger", ".lock"),
      JSON.stringify({ pid: process.pid, created_at: new Date().toISOString() })
    );
    const blocked = Symbol("still waiting for the ledger lock");
    const outcome = await Promise.race([
      task(["checkout-fix"]),
      new Promise<symbol>((resolve) => setTimeout(() => resolve(blocked), 5_000)),
    ]);
    expect(outcome).not.toBe(blocked);
    expect((await sessionLines()).length).toBe(1);
    expect(config("branch.feat/x.aiddTask")).toBe("checkout-fix");
  }, 20_000);

  it("shows the binding and where it comes from", async () => {
    await task(["checkout-fix", "--ticket", "PROJ-12"]);
    const shown = await status();
    expect(shown.exitCode).toBe(0);
    expect(shown.stdout).toContain(
      'Bound to task "checkout-fix" (ticket PROJ-12), declared in session 00000000'
    );
    const outside = await status({ CLAUDE_CODE_SESSION_ID: "" });
    expect(outside.stdout).toContain("declared on branch feat/x");
  });

  it("refuses a task with no name, and points at status", async () => {
    const run = await task([]);
    expect(run.exitCode).toBe(1);
    expect(run.stderr).toContain("aidd telemetry status");
  });

  it("refuses a project that has not opted in, naming the command that opts in", async () => {
    git(repo, gitEnv, "config", "--local", "--unset", "aidd.telemetry");
    const run = await task(["t"]);
    expect(run.exitCode).toBe(1);
    expect(run.stderr + run.stdout).toContain("aidd telemetry on");
    await expect(readFile(join(telemetry, "bindings", "sessions.jsonl"), "utf8")).rejects.toThrow();
    expect(() => config("branch.feat/x.aiddTask")).toThrow();
  });
});
