import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { git } from "../helpers/git-sandbox.js";
import {
  assertUnderTemporaryDirectory,
  createTelemetrySandbox,
  type TelemetrySandbox,
} from "../helpers/telemetry-sandbox.js";
import { runCli } from "./helpers.js";

const SESSION = "00000000-0000-4000-8000-0000000000cc";
const DELEGATE = `#!/bin/sh
# Installed by \`aidd telemetry on\`, removed by \`aidd telemetry off\`.
session_id="\${CODEX_THREAD_ID:-\${CLAUDE_CODE_SESSION_ID:-}}"
[ -n "$session_id" ] || exit 0
git interpret-trailers --in-place --if-exists doNothing --trailer "AIDD-Session-Id=$session_id" "$1" || exit 0
exit 0
`;

let box: TelemetrySandbox;
let repo: string;

beforeEach(() => {
  box = createTelemetrySandbox();
  repo = box.repository("widgets");
});
afterEach(() => {
  rmSync(box.root, { recursive: true, force: true });
});

const cli = (args: string[], extra: Record<string, string> = {}) =>
  runCli(["telemetry", ...args], repo, box.home, { env: box.env(extra) });
const commit = () => {
  git(
    repo,
    { ...box.gitEnv, CLAUDE_CODE_SESSION_ID: SESSION },
    "commit",
    "-q",
    "--allow-empty",
    "-m",
    "work"
  );
  return git(repo, box.gitEnv, "log", "-1", "--format=%B");
};

function leaveV1(): void {
  const hooks = join(repo, ".git", "hooks");
  mkdirSync(hooks, { recursive: true });
  writeFileSync(join(hooks, "aidd-session-trailer.sh"), DELEGATE);
  chmodSync(join(hooks, "aidd-session-trailer.sh"), 0o755);
  writeFileSync(
    join(hooks, "prepare-commit-msg"),
    `#!/bin/sh\nsh "${join(hooks, "aidd-session-trailer.sh")}" "$@"\n`
  );
  chmodSync(join(hooks, "prepare-commit-msg"), 0o755);
  mkdirSync(join(repo, "aidd_docs", "runs"), { recursive: true });
  writeFileSync(join(repo, "aidd_docs", "runs", "a.jsonl"), "{}\n");
  writeFileSync(join(repo, ".gitignore"), "aidd_docs/runs/\n");
  mkdirSync(join(repo, ".aidd"));
  writeFileSync(join(repo, ".aidd", "config.json"), '{"telemetry":{"enabled":true}}');
}

describe("aidd telemetry on", () => {
  it("leaves a repository that commits without a trailer, and prints what it removed", async () => {
    leaveV1();
    expect(commit()).toContain(`AIDD-Session-Id: ${SESSION}`);

    const run = await cli(["on", "--yes"]);

    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain("Measurement is on for this clone");
    expect(run.stdout).toContain("never committed");
    expect(run.stdout).toContain("Next: declare what you work on");
    expect(run.stdout).toContain("Removed the commit hook line");
    expect(run.stdout).toContain("Removed aidd_docs/runs/");
    expect(run.stderr).toContain('"cleanupPeriodDays": 3650');
    expect(git(repo, box.gitEnv, "config", "--local", "--get", "aidd.telemetry").trim()).toMatch(
      /^2:[0-9a-f-]{36}$/u
    );
    expect(existsSync(join(repo, ".aidd", "config.json"))).toBe(false);
    expect(run.stdout).toContain("Deleted .aidd/config.json");
    expect(commit()).not.toContain("AIDD-Session-Id");
    expect(existsSync(join(repo, "aidd_docs", "runs"))).toBe(false);
  });

  it("asks nothing it cannot ask: without --yes and a terminal it changes nothing and exits 1", async () => {
    leaveV1();
    await expect(cli(["on"])).resolves.toMatchObject({ exitCode: 1 });
    expect(readFileSync(join(repo, ".aidd", "config.json"), "utf8")).toBe(
      '{"telemetry":{"enabled":true}}'
    );
    expect(() => git(repo, box.gitEnv, "config", "--local", "--get", "aidd.telemetry")).toThrow();
    expect(existsSync(join(repo, ".git", "hooks", "aidd-session-trailer.sh"))).toBe(true);
  });
});

describe("aidd telemetry off", () => {
  it("switches off by setting the git config value to off", async () => {
    await cli(["on", "--yes"]);
    const run = await cli(["off"]);
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain("Measurement is off");
    expect(git(repo, box.gitEnv, "config", "--local", "--get", "aidd.telemetry").trim()).toBe(
      "off"
    );
  });
});

describe("aidd telemetry forget", () => {
  it("previews, then removes with --yes", async () => {
    await cli(["on", "--yes"]);
    mkdirSync(join(box.telemetry, "ledger"), { recursive: true });
    writeFileSync(join(box.telemetry, "ledger", "2026-10.jsonl"), "{}\n");
    writeFileSync(join(box.telemetry, "identity.json"), "{}\n");
    git(repo, box.gitEnv, "config", "--local", "branch.main.aiddTask", "x");
    assertUnderTemporaryDirectory([box.telemetry, box.home, repo]);

    const preview = await cli(["forget"]);
    expect(preview.stdout).toContain("This would remove:");
    expect(preview.stdout).toContain("Nothing was removed.");
    expect(existsSync(join(box.telemetry, "identity.json"))).toBe(true);

    const removed = await cli(["forget", "--yes"]);
    expect(removed.exitCode).toBe(0);
    expect(removed.stdout).toContain("Removed:");
    expect(readdirSync(box.telemetry)).toEqual([]);
  });

  it("leaves no consent behind in a clone where `on` ran and no session ever did", async () => {
    await cli(["on", "--yes"]);
    expect(git(repo, box.gitEnv, "config", "--local", "--get", "aidd.telemetry").trim()).toMatch(
      /^2:[0-9a-f-]{36}$/u
    );
    const removed = await cli(["forget", "--yes"]);
    expect(removed.exitCode).toBe(0);
    expect(removed.stdout).toContain("the consent (aidd.telemetry)");
    expect(() => git(repo, box.gitEnv, "config", "--local", "--get", "aidd.telemetry")).toThrow();
  });
});
