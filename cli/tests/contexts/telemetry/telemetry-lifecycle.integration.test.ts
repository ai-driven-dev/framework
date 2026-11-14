import { execFileSync } from "node:child_process";
import {
  chmodSync,
  closeSync,
  existsSync,
  fstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { wireTelemetry } from "../../../src/composition/telemetry.js";
import type { TelemetryDeps } from "../../../src/presentation/deps.js";
import { git } from "../../helpers/git-sandbox.js";
import {
  assertUnderTemporaryDirectory,
  createTelemetrySandbox,
  type TelemetrySandbox,
} from "../../helpers/telemetry-sandbox.js";

const SESSION = "00000000-0000-4000-8000-0000000000bb";
const BARE = '{"telemetry":{"enabled":true},"keep":{"me":1}}';
const DELEGATE_FILE = "aidd-session-trailer.sh";
/** What the previous version installed, verbatim. */
const DELEGATE = `#!/bin/sh
# Installed by \`aidd telemetry on\`, removed by \`aidd telemetry off\`.
#
# Names the AI session that authored this commit, so what a session cost can be read
# per commit. Writes nothing when no session made the commit.
set -u

message_file="\${1:-}"

[ -n "$message_file" ] || exit 0

session_id="\${CODEX_THREAD_ID:-\${CLAUDE_CODE_SESSION_ID:-}}"
[ -n "$session_id" ] || exit 0

# --if-exists doNothing keeps an amend, or a second run of this hook, from writing it twice.
git interpret-trailers --in-place --if-exists doNothing \\
  --trailer "AIDD-Session-Id=$session_id" "$message_file" || exit 0

exit 0
`;

let box: TelemetrySandbox;
let repo: string;
let deps: TelemetryDeps;

function useSandbox(): void {
  for (const [name, value] of Object.entries(box.env())) vi.stubEnv(name, value);
  deps = wireTelemetry(() => box.home);
}

beforeEach(() => {
  box = createTelemetrySandbox();
  repo = box.repository("widgets");
  useSandbox();
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(box.root, { recursive: true, force: true });
});

const read = (path: string) => readFileSync(path, "utf8");
const hooksDir = () => join(repo, ".git", "hooks");

function install(hookText: string | null = null, delegateDir = hooksDir()): string {
  mkdirSync(delegateDir, { recursive: true });
  const delegate = join(delegateDir, DELEGATE_FILE);
  writeFileSync(delegate, DELEGATE);
  chmodSync(delegate, 0o755);
  const hook = join(hooksDir(), "prepare-commit-msg");
  const call = `sh "${delegate.replaceAll("\\", "/")}" "$@"`;
  if (hookText !== null) {
    mkdirSync(hooksDir(), { recursive: true });
    writeFileSync(hook, hookText.replace("<CALL>", call));
    chmodSync(hook, 0o755);
  }
  return delegate;
}

function commit(message: string): string {
  const env = { ...box.gitEnv, CLAUDE_CODE_SESSION_ID: SESSION };
  git(repo, env, "commit", "-q", "--allow-empty", "-m", message);
  return git(repo, env, "log", "-1", "--format=%B");
}

async function configure(text: string): Promise<void> {
  mkdirSync(join(repo, ".aidd"), { recursive: true });
  writeFileSync(join(repo, ".aidd", "config.json"), text);
}

const retentionOf = (root: string) => deps.readTranscriptRetention.execute({ root });

describe("opting in to a repository a previous version measured", () => {
  it("leaves what a previous version installed as it found it, and the repository still commits", async () => {
    const delegate = install("#!/bin/sh\n<CALL>\n");
    const hook = join(hooksDir(), "prepare-commit-msg");
    await configure(BARE);
    mkdirSync(join(repo, "aidd_docs", "runs"), { recursive: true });
    writeFileSync(join(repo, "aidd_docs", "runs", "a.jsonl"), "{}\n");
    const before = [hook, delegate, join(repo, ".aidd", "config.json")].map(read);

    const result = await deps.enableTelemetry.execute({ cwd: repo, choice: "keep" });

    expect(result).toMatchObject({ status: "on", consentWritten: true });
    expect([hook, delegate, join(repo, ".aidd", "config.json")].map(read)).toEqual(before);
    expect(existsSync(join(repo, "aidd_docs", "runs", "a.jsonl"))).toBe(true);
    expect(commit("after")).toContain(`AIDD-Session-Id: ${SESSION}`);
  });

  const consentOf = () =>
    git(repo, box.gitEnv, "config", "--local", "--get", "aidd.telemetry").trim();
  const TOKEN_KEY = /^2:[0-9a-f-]{36}$/u;
  const intervalLines = () =>
    read(join(box.telemetry, "ledger", "consents.jsonl"))
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));

  it("sets the consent in the repository's git config, not in .aidd/config.json", async () => {
    await configure(JSON.stringify({ keep: { me: 1 } }));
    await deps.enableTelemetry.execute({ cwd: repo, choice: "keep" });
    expect(consentOf()).toMatch(TOKEN_KEY);
    expect(read(join(repo, ".aidd", "config.json"))).toBe('{"keep":{"me":1}}');
    const [opened, ...rest] = intervalLines();
    expect(rest).toEqual([]);
    expect(`2:${opened.token}`).toBe(consentOf());
    expect(opened.clone.path).toBe(realpathSync(join(repo, ".git")));
  });

  it("mints a fresh token for each interval and ends the last one at off", async () => {
    await deps.enableTelemetry.execute({ cwd: repo, choice: "keep" });
    const first = consentOf();
    await deps.disableTelemetry.execute({ cwd: repo });
    await deps.enableTelemetry.execute({ cwd: repo, choice: "keep" });
    expect(consentOf()).toMatch(TOKEN_KEY);
    expect(consentOf()).not.toBe(first);
    expect(intervalLines().map((line) => Object.keys(line).join(","))).toEqual([
      "token,clone,open",
      "token,close",
      "token,clone,open",
    ]);
  });

  it("is not opted in by a committed .aidd/config.json that says version 2", async () => {
    await configure('{"telemetry":{"enabled":true,"version":2}}');
    git(repo, box.gitEnv, "add", ".aidd/config.json");
    git(repo, box.gitEnv, "commit", "-q", "-m", "config");
    writeTranscript(repo, ["a"]);
    // No clone has opted in, so no transcript is even read.
    expect(await deps.ingestUsage.execute()).toMatchObject({ added: 0, filesRead: 0 });
    expect(() => consentOf()).toThrow();
  });

  it("turns off with the git config value off, and leaves .aidd/config.json alone", async () => {
    await configure('{"keep":1}');
    await deps.enableTelemetry.execute({ cwd: repo, choice: "keep" });
    expect(await deps.disableTelemetry.execute({ cwd: repo })).toEqual({
      status: "off",
      changed: true,
    });
    expect(consentOf()).toBe("off");
    expect(read(join(repo, ".aidd", "config.json"))).toBe('{"keep":1}');
  });

  it("stores nothing from a linked worktree until the main clone opts in, then shares it", async () => {
    const linked = join(box.root, "widgets-linked");
    git(repo, box.gitEnv, "worktree", "add", "-q", "-b", "feat/y", linked);
    writeTranscript(linked, ["a"], "s-1", soon());
    expect(await deps.ingestUsage.execute()).toMatchObject({ added: 0 });
    await deps.enableTelemetry.execute({ cwd: repo, choice: "keep" });
    writeTranscript(linked, ["b"], "s-2", soon());
    expect(await deps.ingestUsage.execute()).toMatchObject({ added: 1 });
  });

  it("refuses outside a repository", async () => {
    const outside = join(box.root, "not-a-repo");
    mkdirSync(outside);
    expect(await deps.enableTelemetry.execute({ cwd: outside, choice: "keep" })).toEqual({
      status: "refused",
      reason: "outside-repository",
    });
  });
});

/** A moment just after the test's own `on`, which opens its interval at the real clock. */
const soon = (): string => new Date(Date.now() + 60_000).toISOString();

function transcript(cwd: string, ids: readonly string[], at?: string): string {
  return `${ids
    .map((id, index) =>
      JSON.stringify({
        type: "assistant",
        sessionId: "s-1",
        requestId: `req_${id}`,
        timestamp: at ?? `2026-10-07T10:0${index}:00.000Z`,
        version: "2.1.0",
        cwd,
        gitBranch: "main",
        message: {
          id: `msg_${id}`,
          model: "m",
          usage: {
            input_tokens: 1,
            output_tokens: 10,
            cache_read_input_tokens: 0,
            cache_creation_input_tokens: 0,
          },
        },
      })
    )
    .join("\n")}\n`;
}

function writeTranscript(cwd: string, ids: readonly string[], name = "s-1", at?: string): void {
  const file = join(box.claude, "projects", "-p", `${name}.jsonl`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, transcript(cwd, ids, at));
  // Written when its last call was made, as Claude writes its transcripts.
  const written = new Date(at ?? `2026-10-07T10:0${ids.length - 1}:00.000Z`);
  utimesSync(file, written, written);
}

/** How many calls the ledger's days hold. */
const stored = () => {
  const dir = join(box.telemetry, "ledger");
  if (!existsSync(dir)) return 0;
  return readdirSync(dir)
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.jsonl$/u.test(name))
    .flatMap((name) => read(join(dir, name)).split("\n").filter(Boolean)).length;
};

describe("the identifier offered at on", () => {
  it("is not read from git under AIDD_TELEMETRY=0", async () => {
    git(repo, box.gitEnv, "config", "--local", "user.name", "Ada Example");
    vi.stubEnv("AIDD_TELEMETRY", "0");
    deps = wireTelemetry(() => box.home);
    expect(await deps.proposeIdentity.execute({ cwd: repo })).toBeNull();
  });
});

describe("the wiring of a declaration", () => {
  const declare = {
    cwd: "",
    request: { kind: "task", task: "t1", ticket: null },
    by: "command",
  } as const;

  it("refuses a declaration, a status and a report under AIDD_TELEMETRY=0", async () => {
    vi.stubEnv("AIDD_TELEMETRY", "0");
    deps = wireTelemetry(() => box.home);
    const refused = { status: "refused", reason: "environment" };

    expect(await deps.declareTask.execute({ ...declare, cwd: repo })).toEqual(refused);
    expect(await deps.readTelemetryStatus.execute({ cwd: repo })).toEqual(refused);
    expect(
      await deps.requestReport.execute({ axis: "day", period: { from: null, to: null } })
    ).toEqual({ status: "refused" });
  });

  it("binds the session it was declared in, from the moment it is declared", async () => {
    vi.stubEnv("CLAUDE_CODE_SESSION_ID", SESSION);
    deps = wireTelemetry(() => box.home);
    await deps.enableTelemetry.execute({ cwd: repo, choice: "keep" });
    await deps.declareTask.execute({ ...declare, cwd: repo });

    expect(await deps.readTelemetryStatus.execute({ cwd: repo })).toMatchObject({
      binding: { state: "bound", source: "session-declared", task: "t1" },
    });
  });
});

describe("measurement starts at on", () => {
  it("does not read back what was said before opting in, though ingest had not read past it", async () => {
    await configure(BARE);
    writeTranscript(repo, ["a", "b"]);
    await deps.enableTelemetry.execute({ cwd: repo, choice: "keep" });

    // Written days before `on`: not even read.
    expect(await deps.ingestUsage.execute()).toMatchObject({ added: 0, filesRead: 0 });
    expect(stored()).toBe(0);
  });

  it("does not store the history again once opting in, though ingest had read past it", async () => {
    await configure(BARE);
    writeTranscript(repo, ["a", "b"]);
    expect(await deps.ingestUsage.execute()).toMatchObject({ added: 0 });

    await deps.enableTelemetry.execute({ cwd: repo, choice: "keep" });
    writeTranscript(repo, ["c"], "s-2", soon());

    expect(await deps.ingestUsage.execute()).toMatchObject({
      added: 1,
      notStored: { "no-consent": 0 },
    });
    expect(stored()).toBe(1);
    expect(await deps.ingestUsage.execute()).toMatchObject({ added: 0, updated: 0 });
  });

  it("does not store a directory that is gone, seen alive before the clone opted in", async () => {
    await configure(BARE);
    // Another clone measured, so this one's transcripts are read before it opts in.
    await deps.enableTelemetry.execute({ cwd: box.repository("gadgets"), choice: "keep" });
    const sub = join(repo, "sub");
    mkdirSync(sub);
    writeTranscript(sub, ["a"], "s-1", soon());
    await deps.ingestUsage.execute();
    const remembered = JSON.parse(read(join(box.telemetry, "ledger", "roots.json")));
    expect(remembered.directories.some((d: { dir: string }) => d.dir.endsWith("sub"))).toBe(true);
    rmSync(sub, { recursive: true });

    await deps.enableTelemetry.execute({ cwd: repo, choice: "keep" });
    writeTranscript(sub, ["b"], "s-2", soon());

    expect(await deps.ingestUsage.execute()).toMatchObject({ added: 1 });
    expect(stored()).toBe(1);
  });
});

describe("how long Claude Code keeps what is measured", () => {
  const claudeFiles = () =>
    readdirSync(box.claude, { recursive: true })
      .map((name) => String(name))
      .sort();

  it("advises the setting when it is unset, and writes nothing in any Claude profile", async () => {
    await configure(BARE);
    mkdirSync(join(repo, ".claude"));
    const settings = join(box.claude, "settings.json");
    writeFileSync(settings, '{"theme":"dark"}');
    const project = join(repo, ".claude", "settings.json");
    writeFileSync(project, "{}");
    const stat = [statSync(settings).mtimeMs, statSync(project).mtimeMs];
    const names = claudeFiles();

    await deps.enableTelemetry.execute({ cwd: repo, choice: "keep" });

    expect(await retentionOf(repo)).toEqual({ days: 30, short: true });
    expect(read(settings)).toBe('{"theme":"dark"}');
    expect(read(project)).toBe("{}");
    expect([statSync(settings).mtimeMs, statSync(project).mtimeMs]).toEqual(stat);
    expect(claudeFiles()).toEqual(names);
  });

  it("is satisfied by 3650 in the user's settings, and overridden by a project's shorter one", async () => {
    await configure(BARE);
    writeFileSync(join(box.claude, "settings.json"), '{"cleanupPeriodDays":3650}');
    expect(await retentionOf(repo)).toEqual({ days: 3650, short: false });
    mkdirSync(join(repo, ".claude"));
    writeFileSync(join(repo, ".claude", "settings.local.json"), '{"cleanupPeriodDays":7}');
    expect(await retentionOf(repo)).toEqual({ days: 7, short: true });
  });
});

function declare(branch: string, task: string): void {
  git(repo, box.gitEnv, "config", "--local", `branch.${branch}.aiddTask`, task);
  git(
    repo,
    box.gitEnv,
    "config",
    "--local",
    `branch.${branch}.aiddDeclaredAt`,
    "2026-10-07T10:00:00Z"
  );
}

/** Every file under the sandbox with its bytes and mtime, and every directory with its mtime. */
function snapshot(): Record<string, string> {
  const found: Record<string, string> = {};
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (path.includes(`${join(".git")}`)) continue;
      if (entry.isDirectory()) {
        found[path] = `dir ${statSync(path).mtimeMs}`;
        walk(path);
        continue;
      }
      const fd = openSync(path, "r");
      try {
        found[path] = `${fstatSync(fd).mtimeMs} ${readFileSync(fd).toString("base64")}`;
      } finally {
        closeSync(fd);
      }
    }
  };
  walk(box.root);
  return found;
}

describe("forgetting", () => {
  async function measured(): Promise<void> {
    await deps.enableTelemetry.execute({ cwd: repo, choice: "keep" });
    declare("main", "checkout");
    writeTranscript(repo, ["a"], "s-1", soon());
    await deps.ingestUsage.execute();
    writeFileSync(join(box.telemetry, "identity.json"), '{"person_id":"p-1"}\n');
    mkdirSync(join(box.telemetry, "bindings"), { recursive: true });
    writeFileSync(join(box.telemetry, "bindings", "carries.jsonl"), "{}\n");
    writeFileSync(join(box.telemetry, "bindings", "processes.jsonl"), "{}\n");
    const aidd = join(box.home, ".config", "aidd");
    mkdirSync(join(aidd, "telemetry"), { recursive: true });
    writeFileSync(join(aidd, "telemetry", "2026-10-06.jsonl"), "{}\n");
    writeFileSync(join(aidd, "identity.json"), "{}\n");
    writeFileSync(join(box.telemetry, "2026-10-05.jsonl"), "{}\n");
  }

  it("previews and changes nothing on disk, not a byte nor an mtime", async () => {
    await measured();
    const before = snapshot();
    const config = git(repo, box.gitEnv, "config", "--local", "--list");

    const result = await deps.forgetTelemetry.execute({ confirmed: false });

    expect(result.status).toBe("preview");
    expect(result.plan.entries.map((e) => e.kind).sort()).toEqual([
      "bindings",
      "identity",
      "ledger",
      "previous-day-file",
      "previous-day-file",
      "previous-identity",
    ]);
    expect(result.plan.repositories).toEqual([
      { clone: join(repo, ".git"), taskKeys: 2, consent: true },
    ]);
    expect(snapshot()).toEqual(before);
    expect(git(repo, box.gitEnv, "config", "--local", "--list")).toBe(config);
  });

  it("leaves nothing of either version, and the declarations out of git config", async () => {
    await measured();
    const aidd = join(box.home, ".config", "aidd");

    const result = await deps.forgetTelemetry.execute({ confirmed: true });

    expect(result.status).toBe("forgotten");
    expect(readdirSync(box.telemetry)).toEqual([]);
    expect(readdirSync(join(aidd, "telemetry"))).toEqual([]);
    expect(existsSync(join(aidd, "identity.json"))).toBe(false);
    expect(git(repo, box.gitEnv, "config", "--local", "--list")).not.toMatch(/aidd/i);
  });

  it("unsets the consent of a clone where `on` ran and no session ever did, and of one that ran off", async () => {
    await deps.enableTelemetry.execute({ cwd: repo, choice: "keep" });
    const other = box.repository("gadgets");
    await deps.enableTelemetry.execute({ cwd: other, choice: "keep" });
    await deps.disableTelemetry.execute({ cwd: other });
    expect(git(other, box.gitEnv, "config", "--local", "--get", "aidd.telemetry").trim()).toBe(
      "off"
    );

    const result = await deps.forgetTelemetry.execute({ confirmed: true });

    expect(result.plan.repositories.map((r) => r.consent)).toEqual([true, true]);
    for (const clone of [repo, other]) {
      expect(git(clone, box.gitEnv, "config", "--local", "--list")).not.toMatch(/aidd/i);
    }
  });

  it("keeps what is not measurement, in the telemetry directory and beside the identity", async () => {
    await measured();
    writeFileSync(join(box.telemetry, "notes.txt"), "mine");
    writeFileSync(join(box.home, ".config", "aidd", "auth.json"), "{}");
    writeFileSync(join(box.home, ".config", "aidd", "telemetry", "keep.jsonl"), "{}");
    await deps.forgetTelemetry.execute({ confirmed: true });
    expect(readdirSync(box.telemetry)).toEqual(["notes.txt"]);
    expect(existsSync(join(box.home, ".config", "aidd", "auth.json"))).toBe(true);
    expect(existsSync(join(box.home, ".config", "aidd", "telemetry", "keep.jsonl"))).toBe(true);
  });

  it("skips a repository that is gone and says so", async () => {
    await measured();
    const other = box.repository("gadgets");
    git(other, box.gitEnv, "config", "--local", "branch.main.aiddTask", "x");
    await deps.enableTelemetry.execute({ cwd: other, choice: "keep" });
    writeTranscript(other, ["z"], "s-2");
    await deps.ingestUsage.execute();
    rmSync(other, { recursive: true });

    const result = await deps.forgetTelemetry.execute({ confirmed: true });

    expect(result.plan.missing).toEqual([join(other, ".git")]);
    expect(git(repo, box.gitEnv, "config", "--local", "--list")).not.toMatch(/aidd/i);
  });

  it("does not name a gone clone that never opted in", async () => {
    await measured();
    const other = box.repository("gadgets");
    writeTranscript(other, ["z"], "s-2");
    await deps.ingestUsage.execute();
    rmSync(other, { recursive: true });

    const result = await deps.forgetTelemetry.execute({ confirmed: true });

    expect(result.plan.missing).toEqual([]);
  });

  it("creates nothing where nothing was measured", async () => {
    const result = await deps.forgetTelemetry.execute({ confirmed: true });
    expect(result.plan.entries).toEqual([]);
    expect(existsSync(box.telemetry)).toBe(false);
  });

  it("never runs against a path outside the temporary directory", () => {
    assertUnderTemporaryDirectory([box.telemetry, box.home, repo]);
    expect(() => assertUnderTemporaryDirectory(["/Users/someone/.config/aidd"])).toThrow(
      /refusing to run a command that deletes/
    );
    expect(() => execFileSync("true")).not.toThrow();
  });
});
