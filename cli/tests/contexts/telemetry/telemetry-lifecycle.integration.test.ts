import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type TelemetryDeps, wireTelemetry } from "../../../src/runtime/wiring/telemetry.js";
import { git } from "../../helpers/git-sandbox.js";
import {
  assertUnderTemporaryDirectory,
  createTelemetrySandbox,
  type TelemetrySandbox,
} from "../../helpers/telemetry-sandbox.js";

const SESSION = "00000000-0000-4000-8000-0000000000bb";
const BARE = '{"telemetry":{"enabled":true},"keep":{"me":1}}';
const DELEGATE_FILE = "aidd-session-trailer.sh";
/** What the previous version installed, as it wrote it. */
const DELEGATE = `#!/bin/sh
# Installed by \`aidd telemetry on\`, removed by \`aidd telemetry off\`.
set -u
message_file="\${1:-}"
[ -n "$message_file" ] || exit 0
session_id="\${CODEX_THREAD_ID:-\${CLAUDE_CODE_SESSION_ID:-}}"
[ -n "$session_id" ] || exit 0
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

describe("opting in to a repository the previous version measured", () => {
  it("leaves a repository that still commits, with no trailer, and no line without its script", async () => {
    install("#!/bin/sh\n<CALL>\n");
    await configure(BARE);
    expect(commit("before")).toContain(`AIDD-Session-Id: ${SESSION}`);

    const result = await deps.telemetryOnUseCase.execute(repo);

    expect(result).toMatchObject({
      status: "on",
      hook: { lineRemoved: true, delegateRemoved: true, stillCalledBy: [] },
    });
    expect(existsSync(join(hooksDir(), DELEGATE_FILE))).toBe(false);
    expect(existsSync(join(hooksDir(), "prepare-commit-msg"))).toBe(false);
    expect(commit("after")).not.toContain("AIDD-Session-Id");
  });

  it("keeps a hook's other content byte for byte, and its mode", async () => {
    const foreign = '#!/bin/sh\n# mine\r\n  echo "a"  \n<CALL>\necho end';
    install(foreign);
    await configure(BARE);

    await deps.telemetryOnUseCase.execute(repo);

    const hook = join(hooksDir(), "prepare-commit-msg");
    expect(read(hook)).toBe('#!/bin/sh\n# mine\r\n  echo "a"  \necho end');
    expect(statSync(hook).mode & 0o111).not.toBe(0);
    expect(existsSync(join(hooksDir(), DELEGATE_FILE))).toBe(false);
    expect(commit("after")).not.toContain("AIDD-Session-Id");
  });

  it("keeps the script while a lefthook job still calls it, says so, and edits no manager file", async () => {
    install("#!/bin/sh\n<CALL>\n");
    const lefthook = [
      "prepare-commit-msg:",
      "  commands:",
      "    aidd-session-trailer:",
      "      run: |",
      '        delegate="$(git rev-parse --git-common-dir)/hooks/aidd-session-trailer.sh"',
      '        if [ -f "$delegate" ]; then sh "$delegate" {1} {2}; fi',
      "",
    ].join("\n");
    writeFileSync(join(repo, "lefthook.yml"), lefthook);
    await configure(BARE);

    const result = await deps.telemetryOnUseCase.execute(repo);

    expect(result).toMatchObject({
      hook: { lineRemoved: true, delegateRemoved: false, stillCalledBy: ["lefthook.yml"] },
    });
    expect(existsSync(join(hooksDir(), DELEGATE_FILE))).toBe(true);
    expect(read(join(repo, "lefthook.yml"))).toBe(lefthook);
  });

  it("keeps the script while a husky hook still calls it", async () => {
    install(null);
    const husky =
      'delegate="$(git rev-parse --git-common-dir)/hooks/aidd-session-trailer.sh"\n[ -f "$delegate" ] && sh "$delegate" "$@"\n';
    mkdirSync(join(repo, ".husky"));
    writeFileSync(join(repo, ".husky", "prepare-commit-msg"), husky);
    await configure(BARE);

    const result = await deps.telemetryOnUseCase.execute(repo);

    expect(result).toMatchObject({
      hook: { delegateRemoved: false, stillCalledBy: [".husky/prepare-commit-msg"] },
    });
    expect(existsSync(join(hooksDir(), DELEGATE_FILE))).toBe(true);
    expect(read(join(repo, ".husky", "prepare-commit-msg"))).toBe(husky);
  });

  it("leaves a script of somebody else's under that name alone", async () => {
    mkdirSync(hooksDir(), { recursive: true });
    writeFileSync(join(hooksDir(), DELEGATE_FILE), "#!/bin/sh\necho mine\n");
    await configure(BARE);
    await deps.telemetryOnUseCase.execute(repo);
    expect(existsSync(join(hooksDir(), DELEGATE_FILE))).toBe(true);
  });

  it("removes the run journal and its ignore entry, and nothing else of the ignore file", async () => {
    mkdirSync(join(repo, "aidd_docs", "runs"), { recursive: true });
    writeFileSync(join(repo, "aidd_docs", "runs", "a.jsonl"), "{}\n");
    writeFileSync(join(repo, ".gitignore"), "dist/\naidd_docs/runs/\nnode_modules/\n");
    await configure(BARE);

    const result = await deps.telemetryOnUseCase.execute(repo);

    expect(result).toMatchObject({ journal: { journalRemoved: true, ignoreEntryRemoved: true } });
    expect(existsSync(join(repo, "aidd_docs", "runs"))).toBe(false);
    expect(read(join(repo, ".gitignore"))).toBe("dist/\nnode_modules/\n");
  });

  it("leaves a journal git tracks where it is", async () => {
    mkdirSync(join(repo, "aidd_docs", "runs"), { recursive: true });
    writeFileSync(join(repo, "aidd_docs", "runs", "a.jsonl"), "{}\n");
    git(repo, box.gitEnv, "add", "-f", "aidd_docs/runs/a.jsonl");
    await configure(BARE);

    const result = await deps.telemetryOnUseCase.execute(repo);

    expect(result).toMatchObject({ journal: { journalRemoved: false, trackedKept: true } });
    expect(existsSync(join(repo, "aidd_docs", "runs", "a.jsonl"))).toBe(true);
  });

  const consentOf = () =>
    git(repo, box.gitEnv, "config", "--local", "--get", "aidd.telemetry").trim();

  it("sets the consent in the repository's git config, not in .aidd/config.json", async () => {
    await configure(JSON.stringify({ keep: { me: 1 } }));
    await deps.telemetryOnUseCase.execute(repo);
    expect(consentOf()).toBe("2");
    expect(read(join(repo, ".aidd", "config.json"))).toBe('{"keep":{"me":1}}');
  });

  it("removes the previous version's block, every V1 key with it, and keeps every other byte", async () => {
    await configure(
      '{\n  "keep": { "me": 1 },\n  "telemetry": { "enabled": true, "endpoint": "x" }\n}\n'
    );
    const result = await deps.telemetryOnUseCase.execute(repo);
    expect(result).toMatchObject({ legacyConfig: "block-removed" });
    expect(read(join(repo, ".aidd", "config.json"))).toBe('{\n  "keep": { "me": 1 }\n}\n');
  });

  it("deletes .aidd/config.json when the block was all it held", async () => {
    await configure('{"telemetry":{"enabled":true,"endpoint":"x"}}');
    expect(await deps.telemetryOnUseCase.execute(repo)).toMatchObject({
      legacyConfig: "file-deleted",
    });
    expect(existsSync(join(repo, ".aidd", "config.json"))).toBe(false);
  });

  it("is not opted in by a committed .aidd/config.json that says version 2", async () => {
    await configure('{"telemetry":{"enabled":true,"version":2}}');
    git(repo, box.gitEnv, "add", ".aidd/config.json");
    git(repo, box.gitEnv, "commit", "-q", "-m", "config");
    writeTranscript(repo, ["a"]);
    expect(await deps.ingestUsageUseCase.execute()).toMatchObject({
      added: 0,
      notStored: { "no-consent": 1 },
    });
    expect(() => consentOf()).toThrow();
  });

  it("turns off with the git config value off, and leaves .aidd/config.json alone", async () => {
    git(repo, box.gitEnv, "config", "--local", "aidd.telemetry", "2");
    await configure('{"keep":1}');
    expect(await deps.telemetryOffUseCase.execute(repo)).toEqual({ status: "off", changed: true });
    expect(consentOf()).toBe("off");
    expect(read(join(repo, ".aidd", "config.json"))).toBe('{"keep":1}');
  });

  it("stores nothing from a linked worktree until the main clone opts in, then shares it", async () => {
    const linked = join(box.root, "widgets-linked");
    git(repo, box.gitEnv, "worktree", "add", "-q", "-b", "feat/y", linked);
    writeTranscript(linked, ["a"]);
    expect(await deps.ingestUsageUseCase.execute()).toMatchObject({ added: 0 });
    await deps.telemetryOnUseCase.execute(repo);
    expect(await deps.ingestUsageUseCase.execute()).toMatchObject({ added: 1 });
  });

  it("leaves a config that does not parse as it is, and still turns measurement on", async () => {
    await configure("{nope");
    install("#!/bin/sh\n<CALL>\n");
    expect(await deps.telemetryOnUseCase.execute(repo)).toMatchObject({
      status: "on",
      legacyConfig: "unparseable",
    });
    expect(read(join(repo, ".aidd", "config.json"))).toBe("{nope");
    expect(consentOf()).toBe("2");
    expect(existsSync(join(hooksDir(), DELEGATE_FILE))).toBe(false);
  });

  it("refuses outside a repository", async () => {
    const outside = join(box.root, "not-a-repo");
    mkdirSync(outside);
    expect(await deps.telemetryOnUseCase.execute(outside)).toEqual({
      status: "refused",
      reason: "outside-repository",
    });
  });
});

function transcript(cwd: string, ids: readonly string[]): string {
  return `${ids
    .map((id, index) =>
      JSON.stringify({
        type: "assistant",
        sessionId: "s-1",
        requestId: `req_${id}`,
        timestamp: `2026-10-07T10:0${index}:00.000Z`,
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

function writeTranscript(cwd: string, ids: readonly string[], name = "s-1"): void {
  const file = join(box.claude, "projects", "-p", `${name}.jsonl`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, transcript(cwd, ids));
}

const stored = () => {
  const file = join(box.telemetry, "ledger", "2026-10.jsonl");
  return existsSync(file) ? read(file).split("\n").filter(Boolean).length : 0;
};

describe("the history from before opting in", () => {
  it("is stored once opting in, though ingest had read past it", async () => {
    await configure(BARE);
    writeTranscript(repo, ["a", "b"]);
    const before = await deps.ingestUsageUseCase.execute();
    expect(before).toMatchObject({ added: 0, notStored: { "no-consent": 2 } });
    expect(stored()).toBe(0);

    await deps.telemetryOnUseCase.execute(repo);

    expect(await deps.ingestUsageUseCase.execute()).toMatchObject({ added: 2 });
    expect(stored()).toBe(2);
    expect(await deps.ingestUsageUseCase.execute()).toMatchObject({ added: 0, updated: 0 });
    expect(stored()).toBe(2);
  });

  it("is stored for a directory that is gone, whose refusal was remembered", async () => {
    await configure(BARE);
    const sub = join(repo, "sub");
    mkdirSync(sub);
    writeTranscript(sub, ["a"]);
    await deps.ingestUsageUseCase.execute();
    const remembered = Object.values(JSON.parse(read(join(box.telemetry, "ledger", "roots.json"))));
    expect(remembered).toEqual([expect.objectContaining({ consented: false })]);
    rmSync(sub, { recursive: true });

    await deps.telemetryOnUseCase.execute(repo);

    expect(await deps.ingestUsageUseCase.execute()).toMatchObject({ added: 1 });
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

    const result = await deps.telemetryOnUseCase.execute(repo);

    expect(result).toMatchObject({ retention: { days: 30, short: true } });
    expect(read(settings)).toBe('{"theme":"dark"}');
    expect(read(project)).toBe("{}");
    expect([statSync(settings).mtimeMs, statSync(project).mtimeMs]).toEqual(stat);
    expect(claudeFiles()).toEqual(names);
  });

  it("is satisfied by 3650 in the user's settings, and overridden by a project's shorter one", async () => {
    await configure(BARE);
    writeFileSync(join(box.claude, "settings.json"), '{"cleanupPeriodDays":3650}');
    expect(await deps.telemetryOnUseCase.execute(repo)).toMatchObject({
      retention: { days: 3650, short: false },
    });
    mkdirSync(join(repo, ".claude"));
    writeFileSync(join(repo, ".claude", "settings.local.json"), '{"cleanupPeriodDays":7}');
    expect(await deps.telemetryOnUseCase.execute(repo)).toMatchObject({
      retention: { days: 7, short: true },
    });
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
      const mtime = statSync(path).mtimeMs;
      if (entry.isDirectory()) {
        found[path] = `dir ${mtime}`;
        walk(path);
      } else found[path] = `${mtime} ${readFileSync(path).toString("base64")}`;
    }
  };
  walk(box.root);
  return found;
}

describe("forgetting", () => {
  async function measured(): Promise<void> {
    git(repo, box.gitEnv, "config", "--local", "aidd.telemetry", "2");
    declare("main", "checkout");
    writeTranscript(repo, ["a"]);
    await deps.ingestUsageUseCase.execute();
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

    const result = await deps.forgetTelemetryUseCase.execute(false);

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

    const result = await deps.forgetTelemetryUseCase.execute(true);

    expect(result.status).toBe("forgotten");
    expect(readdirSync(box.telemetry)).toEqual([]);
    expect(readdirSync(join(aidd, "telemetry"))).toEqual([]);
    expect(existsSync(join(aidd, "identity.json"))).toBe(false);
    expect(git(repo, box.gitEnv, "config", "--local", "--list")).not.toMatch(/aidd/i);
  });

  it("keeps what is not measurement, in the telemetry directory and beside the identity", async () => {
    await measured();
    writeFileSync(join(box.telemetry, "notes.txt"), "mine");
    writeFileSync(join(box.home, ".config", "aidd", "auth.json"), "{}");
    writeFileSync(join(box.home, ".config", "aidd", "telemetry", "keep.jsonl"), "{}");
    await deps.forgetTelemetryUseCase.execute(true);
    expect(readdirSync(box.telemetry)).toEqual(["notes.txt"]);
    expect(existsSync(join(box.home, ".config", "aidd", "auth.json"))).toBe(true);
    expect(existsSync(join(box.home, ".config", "aidd", "telemetry", "keep.jsonl"))).toBe(true);
  });

  it("skips a repository that is gone and says so", async () => {
    await measured();
    const other = box.repository("gadgets");
    git(other, box.gitEnv, "config", "--local", "branch.main.aiddTask", "x");
    git(other, box.gitEnv, "config", "--local", "aidd.telemetry", "2");
    writeTranscript(other, ["z"], "s-2");
    await deps.ingestUsageUseCase.execute();
    rmSync(other, { recursive: true });

    const result = await deps.forgetTelemetryUseCase.execute(true);

    expect(result.plan.missing).toEqual([join(other, ".git")]);
    expect(git(repo, box.gitEnv, "config", "--local", "--list")).not.toMatch(/aidd/i);
  });

  it("creates nothing where nothing was measured", async () => {
    const result = await deps.forgetTelemetryUseCase.execute(true);
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
