import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { git } from "../../helpers/git-sandbox.js";
import { runInProcess } from "../../helpers/in-process-cli.js";
import { createTelemetrySandbox, type TelemetrySandbox } from "../../helpers/telemetry-sandbox.js";

const SESSION = "00000000-0000-4000-8000-0000000000aa";

let box: TelemetrySandbox;
let repo: string;

beforeEach(async () => {
  box = createTelemetrySandbox();
  repo = box.repository("repo");
  git(repo, box.gitEnv, "switch", "-q", "-c", "feat/x");
  const on = await telemetry(["on", "--yes", "--anonymous"]);
  expect(on.exitCode, on.stderr + on.stdout).toBe(0);
});

afterEach(async () => {
  await rm(box.root, { recursive: true, force: true });
});

/** `CLAUDE_CODE_SESSION_ID` is set explicitly in every run: it is in the environment of the
 * session that runs this suite, and a leaked one would bind the wrong session. */
function telemetry(args: string[], extra: Record<string, string> = {}) {
  return runInProcess(["telemetry", ...args], {
    cwd: repo,
    home: box.home,
    env: box.env({ CLAUDE_CODE_SESSION_ID: SESSION, ...extra }),
  });
}
const task = (args: string[], extra: Record<string, string> = {}) =>
  telemetry(["task", ...args], extra);
const config = (key: string) => git(repo, box.gitEnv, "config", "--local", "--get", key).trim();
const bindings = (name: string) => join(box.telemetry, "bindings", name);

describe("declaring a task in an opted-in clone", () => {
  it("snapshots the branch declaration at once", async () => {
    await task(["checkout-fix"]);
    const snapshots = (await readFile(bindings("branches.jsonl"), "utf8"))
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({ branch: "feat/x", task: "checkout-fix" });
    expect(snapshots[0].branch_created_at).not.toBeNull();
  });

  it("declares none, once, on the branch", async () => {
    const run = await task(["--none"]);
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain("Declared no task.");
    expect(config("branch.feat/x.aiddDeclaredAt")).not.toBe("");
    expect(() => config("branch.feat/x.aiddTask")).toThrow();
    expect((await telemetry(["status"], { CLAUDE_CODE_SESSION_ID: "" })).stdout).toContain(
      "no task (declared none)"
    );
  });

  it("keeps both declarations of a session, the later one applying", async () => {
    await task(["first"]);
    await task(["second"]);
    const lines = (await readFile(bindings("sessions.jsonl"), "utf8")).split("\n").filter(Boolean);
    expect(lines.map((line) => JSON.parse(line).task)).toEqual(["first", "second"]);
    expect((await telemetry(["status"])).stdout).toContain('task "second"');
  });

  it("warns that nothing was bound on the default branch outside a session", async () => {
    git(repo, box.gitEnv, "switch", "-q", "main");
    const run = await task(["nowhere"], { CLAUDE_CODE_SESSION_ID: "" });
    expect(run.exitCode).toBe(0);
    expect(run.stderr + run.stdout).toContain("Nothing was bound");
  });

  it("refuses a clone whose only consent is a committed .aidd/config.json", async () => {
    git(repo, box.gitEnv, "config", "--local", "--unset", "aidd.telemetry");
    await mkdir(join(repo, ".aidd"));
    await writeFile(
      join(repo, ".aidd", "config.json"),
      JSON.stringify({ telemetry: { enabled: true, version: 2 } })
    );
    const run = await task(["t"]);
    expect(run.exitCode).toBe(1);
    expect(run.stderr).toContain("has not opted in");
  });
});
