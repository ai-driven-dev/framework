const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

// The hooks are scripts, not modules: the CLI copies them into a user's project. Each one is
// driven as a subprocess with a payload and a sandbox environment, which is what ships. The
// pure rules (directory, consent, branch role, declaration) are also asserted against the shared
// fixture the CLI reads, so the two languages cannot drift apart.
const HOOKS = path.resolve(__dirname, "../../plugins/aidd-telemetry/hooks");
const TASK = path.join(HOOKS, "task.cjs");
const LEDGER = path.join(HOOKS, "ledger.cjs");
const CODEX_HOST = path.resolve(__dirname, "../../cli/assets/hooks-runtime/host-codex.cjs");
const FIXTURE = path.join(__dirname, "fixtures", "telemetry-bindings");
const cases = JSON.parse(fs.readFileSync(path.join(FIXTURE, "cases.json"), "utf8"));
const expected = JSON.parse(fs.readFileSync(path.join(FIXTURE, "expected.json"), "utf8"));

const { telemetryDir } = require(path.join(HOOKS, "lib/telemetry-dir.cjs"));
const { decideConsent, identityFromStat, parseConsentLog, tokenOfKey } = require(path.join(HOOKS, "lib/consent.cjs"));
const { branchDeclaration, branchRoleOf, parseBranchConfig } = require(path.join(HOOKS, "lib/git.cjs"));
const { cmdLine } = require(path.join(HOOKS, "lib/aidd.cjs"));
const { isClaudePayload } = require(path.join(HOOKS, "lib/claude-only.cjs"));
const { hookTool } = require(path.join(HOOKS, "lib/tool.cjs"));

const WINDOWS = process.platform === "win32";
const SESSION = "00000000-0000-4000-8000-0000000000aa";
const OTHER = "00000000-0000-4000-8000-0000000000bb";

// ---------------------------------------------------------------- sandbox

function gitDirectory() {
  const found = spawnSync(WINDOWS ? "where" : "which", ["git"], { encoding: "utf8" });
  return path.dirname(found.stdout.split(/\r?\n/u)[0]);
}
const GIT_DIR_ON_PATH = gitDirectory();

/** git as a test sets a repository up: never through a variable a commit hook exported.
 * No auto maintenance: a commit detaches it, and its lock in `.git/objects` can vanish under a copy. */
function git(cwd, ...args) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));
  const config = ["user.name=t", "user.email=t@t", "commit.gpgsign=false", "maintenance.auto=false"];
  const run = spawnSync(
    "git",
    [...config.flatMap((c) => ["-c", c]), ...args],
    { cwd, env, encoding: "utf8" }
  );
  assert.equal(run.status, 0, `git ${args.join(" ")}: ${run.stderr}`);
  return run.stdout;
}

const FAKE_AIDD = `
const fs = require("node:fs");
const argv = process.argv.slice(2);
if (process.env.FAKE_AIDD_LOG) {
  fs.appendFileSync(process.env.FAKE_AIDD_LOG, JSON.stringify({ argv, cwd: process.cwd() }) + "\\n");
}
if (process.env.FAKE_AIDD_NOISE) { process.stdout.write("noise\\n"); process.stderr.write("noise\\n"); }
if (process.env.FAKE_AIDD_HOLD_MS) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Number(process.env.FAKE_AIDD_HOLD_MS));
`;

/** A throwaway world: a home, a telemetry dir, a repository on feat/x that opted in, and a
 * `bin` holding a fake `aidd` that records how it was called. */
function sandbox({ aidd = true, branch = "feat/x", consent = true } = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "aidd-hooks-")));
  const box = {
    root,
    home: path.join(root, "home"),
    tel: path.join(root, "tel"),
    bin: path.join(root, "bin"),
    repo: path.join(root, "repo"),
    log: path.join(root, "aidd-calls.jsonl"),
  };
  for (const dir of [box.home, box.bin, box.repo]) fs.mkdirSync(dir, { recursive: true });
  git(box.repo, "init", "-q");
  git(box.repo, "symbolic-ref", "HEAD", `refs/heads/${branch}`);
  if (consent) writeConsent(box);
  if (aidd) {
    const script = path.join(box.bin, "fake-aidd.js");
    fs.writeFileSync(script, FAKE_AIDD);
    if (WINDOWS) {
      fs.writeFileSync(path.join(box.bin, "aidd.cmd"), `@"${process.execPath}" "${script}" %*\r\n`);
    } else {
      const shim = path.join(box.bin, "aidd");
      fs.writeFileSync(shim, `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`, { mode: 0o755 });
    }
  }
  box.env = (extra = {}) => {
    const env = {
      PATH: [aidd ? box.bin : null, GIT_DIR_ON_PATH].filter(Boolean).join(path.delimiter),
      HOME: box.home,
      USERPROFILE: box.home,
      AIDD_TELEMETRY_DIR: box.tel,
      FAKE_AIDD_LOG: box.log,
      CLAUDE_CODE_SESSION_ID: SESSION,
      CLAUDE_CODE_ENTRYPOINT: "cli",
      SystemRoot: process.env.SystemRoot,
      ComSpec: process.env.ComSpec,
      PATHEXT: process.env.PATHEXT,
      TEMP: process.env.TEMP,
      ...extra,
    };
    for (const key of Object.keys(env)) if (env[key] === undefined) delete env[key];
    return env;
  };
  box.payload = (extra = {}) => ({
    session_id: SESSION,
    transcript_path: path.join(box.home, ".claude", "projects", "-repo", `${SESSION}.jsonl`),
    cwd: box.repo,
    hook_event_name: "SessionStart",
    source: "startup",
    ...extra,
  });
  box.calls = () =>
    fs.existsSync(box.log)
      ? fs.readFileSync(box.log, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
      : [];
  box.dispose = () => fs.rmSync(root, { recursive: true, force: true });
  return box;
}

const TOKEN = "11111111-2222-4333-8444-555555555555";

/** The real path of the clone's git common dir, as the CLI records it in an interval. */
function commonDirOf(repo) {
  return fs.realpathSync.native(path.resolve(repo, git(repo, "rev-parse", "--git-common-dir").trim()));
}

function consentsFile(box) {
  return path.join(box.tel, "ledger", "consents.jsonl");
}

function openLine(token, repo, open = "2026-01-01T00:00:00.000Z") {
  const where = commonDirOf(repo);
  const clone = { path: where, ...identityFromStat(fs.statSync(where, { bigint: true })) };
  return `${JSON.stringify({ token, clone, open })}\n`;
}

/** Consent as `aidd telemetry on` writes it: the key in the clone's own git config, and an
 * open interval in the consent log naming the same token for this clone. `key` is what the key
 * is set to (null: not set); `interval` is the token of the interval opened (null: none). */
function writeConsent(box, { key = `2:${TOKEN}`, interval = TOKEN } = {}) {
  if (key !== null) git(box.repo, "config", "--local", "aidd.telemetry", key);
  if (interval !== null) {
    fs.mkdirSync(path.dirname(consentsFile(box)), { recursive: true });
    fs.appendFileSync(consentsFile(box), openLine(interval, box.repo));
  }
}

/** The lines of the consent log, parsed. */
function consentLines(box) {
  return fs.existsSync(consentsFile(box))
    ? fs.readFileSync(consentsFile(box), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
    : [];
}

/** What a team could commit: the previous version's consent, which grants nothing now. */
function writeCommittedConfig(repo, text) {
  fs.mkdirSync(path.join(repo, ".aidd"), { recursive: true });
  fs.writeFileSync(path.join(repo, ".aidd", "config.json"), text);
}

function withBox(options, body) {
  const box = sandbox(options);
  try {
    return body(box);
  } finally {
    box.dispose();
  }
}

function run(hook, box, { payload, env, input, args = [] } = {}) {
  const result = spawnSync(process.execPath, [hook, ...args], {
    cwd: box.repo,
    env: env ?? box.env(),
    input: input ?? JSON.stringify(payload ?? box.payload()),
    encoding: "utf8",
  });
  let json = null;
  try {
    json = JSON.parse(result.stdout);
  } catch {
    // not JSON
  }
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, json };
}

const remind = (box, opts) => run(TASK, box, { ...opts, args: ["remind"] });
const ingest = (box, opts) => run(LEDGER, box, { ...opts, args: ["ingest"] });
/** The ingest runs `aidd` detached: its calls land after the hook has returned. */
async function callsOf(box, count = 1) {
  const deadline = Date.now() + 10_000;
  while (box.calls().length < count && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50));
  await new Promise((resolve) => setTimeout(resolve, 300));
  return box.calls();
}
const reminds = (result) => result.json !== null && typeof result.json.systemMessage === "string";
function assertPasses(result) {
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "", `expected a silent pass, got: ${result.stdout}`);
}

// ---------------------------------------------------------------- the contract

test("every fixture case has an answer and every answer a case", () => {
  for (const section of Object.keys(expected)) {
    assert.deepEqual(Object.keys(cases[section] ?? {}).sort(), Object.keys(expected[section]).sort(), section);
  }
});

test("the telemetry directory follows the fixture, on both platforms", () => {
  for (const [name, c] of Object.entries(cases.telemetryDir)) {
    const platform = c.platform === "win32" ? "win32" : "linux";
    assert.equal(telemetryDir({ env: c.env, platform, home: c.home }), expected.telemetryDir[name], name);
  }
});

function logText(lines, tail = "") {
  return lines.map((line) => `${typeof line === "string" ? line : JSON.stringify(line)}\n`).join("") + tail;
}

test("the consent log follows the fixture", () => {
  for (const [name, c] of Object.entries(cases.consentLog)) {
    const log = parseConsentLog(logText(c.lines, c.tail));
    const iso = (ms) => (ms === null ? null : new Date(ms).toISOString());
    assert.deepEqual(
      { damaged: log.damaged, intervals: log.intervals.map((i) => ({ token: i.token, path: i.path, from: iso(i.from), to: iso(i.to) })) },
      expected.consentLog[name],
      name
    );
  }
});

test("a clone consents, and what the hook closes, follow the fixture", () => {
  for (const [name, c] of Object.entries(cases.hookConsent)) {
    const log = parseConsentLog(logText(c.lines));
    assert.deepEqual(
      decideConsent({ key: c.key, log, realpath: c.realpath, identity: c.identity }),
      expected.hookConsent[name],
      name
    );
  }
});

test("a directory's identity follows the fixture, the same as the CLI reads it", () => {
  for (const [name, c] of Object.entries(cases.cloneIdentity)) {
    const stats = { dev: BigInt(c.dev), ino: BigInt(c.ino), birthtimeMs: BigInt(c.birthtimeMs), birthtimeNs: BigInt(c.birthtimeNs), ctimeNs: BigInt(c.ctimeNs) };
    assert.deepEqual(identityFromStat(stats), expected.cloneIdentity[name], name);
  }
});

test("consent value follows the fixture", () => {
  for (const [name, c] of Object.entries(cases.consent)) {
    if (c.linkedWorktree) continue;
    assert.equal(tokenOfKey(c.value) === null ? "absent" : "granted", expected.consent[name], name);
  }
});

test("the branch role follows the fixture", () => {
  for (const [name, c] of Object.entries(cases.branchRole)) {
    assert.equal(branchRoleOf(c.head, c.originHead), expected.branchRole[name], name);
  }
});

/** A case's keys: an object, or pairs in order when a key is listed twice. */
const entriesOf = (keys) => (Array.isArray(keys) ? keys : Object.entries(keys));

test("a branch declaration read back from real git follows the fixture", () => {
  for (const [name, c] of Object.entries(cases.gitConfig)) {
    withBox({ aidd: false, branch: c.branch }, (box) => {
      for (const [key, value] of entriesOf(c.keys)) {
        git(box.repo, "config", "--local", "--add", `branch.${c.branch}.${key}`, value);
      }
      const declared = branchDeclaration(box.repo, c.branch, process.env) !== null;
      assert.equal(declared, expected.gitConfig[name] === "declared", name);
    });
  }
});

test("parseBranchConfig cuts the known suffix off a dotted branch name", () => {
  const out = "branch.release/1.2.aidd.aiddtask\nx\0branch.release/1.2.aidd.aidddeclaredat\nt\0";
  assert.deepEqual(parseBranchConfig(out, "release/1.2.aidd"), {
    task: "x",
    ticket: null,
    declared_for: null,
    declared_at: "t",
    listed_twice: false,
  });
});

// ---------------------------------------------------------------- the guards, end to end

test("hook tool: every fixture case is Claude Code's, Codex's or neither, as expected", () => {
  for (const [name, c] of Object.entries(cases.hookTool)) {
    const env = c.env_session_id === null ? {} : { CLAUDE_CODE_SESSION_ID: c.env_session_id };
    const payload = { session_id: c.payload_session_id, transcript_path: c.transcript_path };
    for (const key of Object.keys(payload)) if (payload[key] === null) delete payload[key];
    assert.equal(hookTool(payload, env), expected.hookTool[name], name);
    // Claude Code's own guard is unchanged, and refuses every case that is not Claude Code's.
    assert.equal(isClaudePayload(payload, env), expected.hookTool[name] === "claude", name);
  }
});

// ---------------------------------------------------------------- Codex

const CODEX_SESSION = "00000000-0000-4000-8000-0000000000dd";
const TUI = { source: "cli", originator: "codex-tui" };

/** The first line Codex writes in a session file, before it hands a hook its path. */
function sessionMeta(fields = TUI, pad = 0) {
  const payload = { id: CODEX_SESSION, cwd: "/work", cli_version: "0.163.0", ...fields };
  if (pad > 0) payload.base_instructions = { text: "x".repeat(pad) };
  return JSON.stringify({ timestamp: "2026-10-19T10:00:00.000Z", type: "session_meta", payload });
}

/** A Codex session file whose content is `text` (null: none written). */
function codexFile(box, text = `${sessionMeta()}\n`) {
  const file = path.join(box.home, ".codex", "sessions", "2026", "10", "19", `rollout-2026-10-19T10-00-00-${CODEX_SESSION}.jsonl`);
  if (text !== null) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${text}${JSON.stringify({ type: "turn_context", payload: { cwd: "/work" } })}\n`);
  }
  return file;
}

/** Codex's hook environment: none of Claude Code's variables, unless a test adds them. */
function codexEnv(box, extra = {}) {
  return box.env({
    CLAUDE_CODE_SESSION_ID: undefined,
    CODEX_HOME: path.join(box.home, ".codex"),
    ...extra,
  });
}

function codexPayload(box, transcript, extra = {}) {
  return {
    session_id: CODEX_SESSION,
    transcript_path: transcript,
    cwd: box.repo,
    hook_event_name: "SessionStart",
    source: "startup",
    model: "m",
    ...extra,
  };
}

/** The hooks folder with Codex's adapter as `lib/host.cjs`, as the CLI builds it for Codex. */
function codexHooks(box) {
  const dir = path.join(box.root, "codex-hooks");
  fs.cpSync(HOOKS, dir, { recursive: true });
  fs.copyFileSync(CODEX_HOST, path.join(dir, "lib", "host.cjs"));
  return dir;
}

/** The reminder holds only a person message, naming the branch and the command. */
function assertReminder(result, branch) {
  assert.deepEqual(Object.keys(result.json), ["systemMessage"]);
  assert.ok(result.json.systemMessage.includes(branch), result.json.systemMessage);
  assert.ok(result.json.systemMessage.includes("aidd telemetry task"), result.json.systemMessage);
}

test("remind: an undeclared working branch gets one person message, nothing for the model", () => {
  withBox({}, (box) => {
    const result = remind(box);
    assert.equal(result.status, 0);
    assertReminder(result, "feat/x");
    assert.deepEqual(box.calls(), []);
  });
});

test("remind: through the Codex adapter, the same person message", () => {
  withBox({}, (box) => {
    const task = path.join(codexHooks(box), "task.cjs");
    const payload = codexPayload(box, codexFile(box));
    const result = run(task, box, { payload, env: codexEnv(box), args: ["remind"] });
    assertReminder(result, "feat/x");
  });
});

test("remind: startup, resume and clear remind, a compaction does not", () => {
  for (const source of ["startup", "resume", "clear"]) {
    withBox({}, (box) => assert.equal(reminds(remind(box, { payload: box.payload({ source }) })), true, source));
  }
  withBox({}, (box) => assertPasses(remind(box, { payload: box.payload({ source: "compact" }) })));
});

test("remind: every fixture case that is Claude Code's or Codex's reminds, the others print nothing", () => {
  for (const name of Object.keys(cases.hookTool)) {
    const c = cases.hookTool[name];
    withBox({}, (box) => {
      const env = box.env(c.env_session_id === null ? { CLAUDE_CODE_SESSION_ID: undefined } : { CLAUDE_CODE_SESSION_ID: c.env_session_id });
      const payload = box.payload({ session_id: c.payload_session_id ?? undefined, transcript_path: c.transcript_path ?? undefined });
      assert.equal(reminds(remind(box, { payload, env })), expected.hookTool[name] !== null, name);
    });
  }
});

test("remind: a Copilot shaped payload prints nothing and runs nothing", () => {
  withBox({}, (box) => {
    const copilot = { sessionId: SESSION, timestamp: 1, cwd: box.repo, hook_event_name: "SessionStart", source: "startup" };
    assertPasses(remind(box, { payload: copilot }));
    assertPasses(ingest(box, { payload: copilot }));
    assert.deepEqual(box.calls(), []);
  });
});

test("remind: an unknown event prints nothing", () => {
  withBox({}, (box) => {
    assertPasses(remind(box, { payload: box.payload({ hook_event_name: "UserPromptSubmit", prompt: "go" }) }));
  });
});

test("remind: a declared branch, the default branch and a detached head print nothing", () => {
  withBox({}, (box) => {
    git(box.repo, "config", "--local", "branch.feat/x.aiddTask", "t");
    git(box.repo, "config", "--local", "branch.feat/x.aiddDeclaredFor", "feat/x");
    git(box.repo, "config", "--local", "branch.feat/x.aiddDeclaredAt", "2026-10-09T09:00:00.000Z");
    assertPasses(remind(box));
  });
  withBox({ branch: "main" }, (box) => assertPasses(remind(box)));
  withBox({}, (box) => {
    git(box.repo, "commit", "--allow-empty", "-q", "-m", "x");
    git(box.repo, "checkout", "-q", "--detach");
    assertPasses(remind(box));
  });
});

test("remind: a key set by hand does not declare a branch", () => {
  withBox({}, (box) => {
    git(box.repo, "config", "--local", "branch.feat/x.aiddTask", "by-hand");
    assert.equal(reminds(remind(box)), true);
  });
});

test("consent: every fixture key grants or refuses as expected, an interval open for the clone behind it", () => {
  for (const [name, c] of Object.entries(cases.consent)) {
    withBox({ consent: false }, (box) => {
      const named = c.value === null ? null : (/^2:(\S+)$/u.exec(c.value)?.[1] ?? null);
      writeConsent(box, { key: c.value, interval: named ?? "another-token" });
      assert.equal(reminds(remind(box)), expected.consent[name] === "granted", name);
    });
  }
});

test("consent: a key with no interval open for the clone grants nothing and reminds nothing", () => {
  const kept = [
    ["a token of an interval already closed", { key: `2:${TOKEN}`, interval: null, closed: true }],
  ];
  for (const [name, options] of kept) {
    withBox({ consent: false }, (box) => {
      writeConsent(box, options);
      if (options.closed) {
        fs.mkdirSync(path.dirname(consentsFile(box)), { recursive: true });
        fs.appendFileSync(consentsFile(box), openLine(TOKEN, box.repo) + `${JSON.stringify({ token: TOKEN, close: "2026-01-02T00:00:00.000Z" })}\n`);
      }
      assertPasses(remind(box));
      assert.deepEqual(box.calls(), [], name);
    });
  }
});

test("consent: a cp -R copy carries the key and not the clone, so it reminds nothing and closes nothing", () => {
  withBox({}, (box) => {
    git(box.repo, "commit", "--allow-empty", "-q", "-m", "x");
    const copy = path.join(box.root, "copy");
    fs.cpSync(box.repo, copy, { recursive: true });
    assert.equal(reminds(remind(box)), true);
    assertPasses(remind(box, { payload: box.payload({ cwd: copy }) }));
    assert.equal(consentLines(box).length, 1);
  });
});

test("consent: a cp -R copy moved onto the deleted original's path reminds nothing and closes nothing", () => {
  withBox({}, (box) => {
    git(box.repo, "commit", "--allow-empty", "-q", "-m", "x");
    assert.equal(reminds(remind(box)), true);
    const copy = path.join(box.root, "copy");
    fs.cpSync(box.repo, copy, { recursive: true });
    fs.renameSync(box.repo, path.join(box.root, "original.removed"));
    fs.renameSync(copy, box.repo);
    assertPasses(remind(box));
    assert.equal(consentLines(box).length, 1);
  });
});

test("consent: a clone moved away and back is the same clone, still reminded", () => {
  withBox({}, (box) => {
    git(box.repo, "commit", "--allow-empty", "-q", "-m", "x");
    const away = path.join(box.root, "away");
    fs.renameSync(box.repo, away);
    fs.renameSync(away, box.repo);
    assert.equal(reminds(remind(box)), true);
  });
});

test("consent: a clone whose key was turned off by hand has its interval closed, now", () => {
  for (const turnOff of [(box) => git(box.repo, "config", "--local", "aidd.telemetry", "off"), (box) => git(box.repo, "config", "--local", "--unset", "aidd.telemetry")]) {
    withBox({}, (box) => {
      turnOff(box);
      const before = Date.now();
      assertPasses(remind(box));
      const lines = consentLines(box);
      assert.equal(lines.length, 2);
      assert.deepEqual(Object.keys(lines[1]), ["token", "close"]);
      assert.equal(lines[1].token, TOKEN);
      assert.ok(Date.parse(lines[1].close) >= before - 1000);
      // already closed: another session start, or another hook, writes nothing more
      assertPasses(remind(box));
      assert.equal(consentLines(box).length, 2);
    });
  }
});

test("consent: a torn last line leaves the clone measured, and a hook's close drops it instead of terminating it into damage", () => {
  withBox({}, (box) => {
    fs.appendFileSync(consentsFile(box), '{"token":"abc","clo');
    assert.equal(reminds(remind(box)), true);
    git(box.repo, "config", "--local", "aidd.telemetry", "off");
    assertPasses(remind(box));
    const text = fs.readFileSync(consentsFile(box), "utf8");
    assert.ok(text.endsWith("\n"));
    assert.deepEqual(consentLines(box).map((line) => Object.keys(line).pop()), ["open", "close"]);
    assert.equal(parseConsentLog(text).damaged, false);
  });
});

test("consent: the ingest closes it too", () => {
  withBox({}, (box) => {
    git(box.repo, "config", "--local", "aidd.telemetry", "off");
    assertPasses(ingest(box));
    assert.equal(consentLines(box).length, 2);
  });
});

test("consent: outside Claude, or refused by the environment, nothing is closed", () => {
  withBox({}, (box) => {
    git(box.repo, "config", "--local", "aidd.telemetry", "off");
    assertPasses(remind(box, { payload: box.payload({ session_id: OTHER }) }));
    assertPasses(remind(box, { env: box.env({ AIDD_TELEMETRY: "0" }) }));
    assert.equal(consentLines(box).length, 1);
  });
});

test("consent: a damaged log grants nothing and is left as it is", () => {
  withBox({}, (box) => {
    fs.appendFileSync(consentsFile(box), "{not json\n");
    const before = fs.readFileSync(consentsFile(box), "utf8");
    assertPasses(remind(box));
    git(box.repo, "config", "--local", "aidd.telemetry", "off");
    assertPasses(remind(box));
    assert.equal(fs.readFileSync(consentsFile(box), "utf8"), before);
  });
});

test("consent: with no open interval anywhere, git is not even asked", () => {
  withBox({ consent: false }, (box) => {
    assertPasses(remind(box, { env: { ...box.env(), PATH: "" } }));
  });
});

test("consent: the clone is told by the real path git records, whatever case the cwd is spelled in", () => {
  withBox({}, (box) => {
    const upper = box.repo.toUpperCase();
    if (!fs.existsSync(upper)) return; // a case-sensitive file system: nothing to spell differently
    assert.equal(reminds(remind(box, { payload: box.payload({ cwd: upper }) })), true);
  });
});

test("consent: a linked worktree sees the main clone's consent, and a clone without it reminds nothing", () => {
  withBox({ consent: false }, (box) => {
    git(box.repo, "commit", "--allow-empty", "-q", "-m", "x");
    const linked = path.join(box.root, "linked");
    git(box.repo, "worktree", "add", "-q", "-b", "feat/y", linked);
    assertPasses(remind(box, { payload: box.payload({ cwd: linked }) }));
    writeConsent(box);
    assert.equal(reminds(remind(box, { payload: box.payload({ cwd: linked }) })), true);
  });
});

test("consent: a committed .aidd/config.json is not consent, so a teammate is reminded of nothing", () => {
  withBox({ consent: false }, (box) => {
    writeCommittedConfig(box.repo, '{"telemetry":{"enabled":true,"version":2}}');
    assertPasses(remind(box));
    assert.deepEqual(box.calls(), []);
    writeConsent(box);
    assert.equal(reminds(remind(box)), true);
  });
});

test("consent: found from a subdirectory of the repository", () => {
  withBox({}, (box) => {
    const sub = path.join(box.repo, "a", "b");
    fs.mkdirSync(sub, { recursive: true });
    assert.equal(reminds(remind(box, { payload: box.payload({ cwd: sub }) })), true);
  });
});

test("consent: AIDD_TELEMETRY=0 refuses before git is asked, and only exactly 0 refuses", () => {
  withBox({}, (box) => {
    // no git on PATH at all: a refusal by the environment must not need it
    assertPasses(remind(box, { env: { ...box.env(cases.environmentRefusal["zero-refuses"]), PATH: "" } }));
  });
  withBox({}, (box) => {
    assert.equal(reminds(remind(box, { env: box.env(cases.environmentRefusal["one-does-not"]) })), true);
  });
});

test("a hook given malformed or empty stdin passes", () => {
  withBox({}, (box) => {
    for (const [hook, args] of [[TASK, ["remind"]], [LEDGER, ["ingest"]]]) {
      assertPasses(run(hook, box, { input: "{not json", args }));
      assertPasses(run(hook, box, { input: "", args }));
      assertPasses(run(hook, box, { input: "[1]", args }));
    }
    // odd field types never crash the hook
    assert.equal(remind(box, { payload: box.payload({ cwd: 7 }) }).status, 0);
  });
});

test("the telemetry directory's home is the operating system's, as the CLI's, never the HOME variable", () => {
  // The CLI asks os.homedir(), which Windows never takes from HOME (Git Bash and sandboxes set it).
  for (const platform of ["linux", "win32"]) {
    const flavour = platform === "win32" ? path.win32 : path.posix;
    assert.equal(
      telemetryDir({ env: { HOME: "/somewhere/else" }, platform }),
      flavour.join(os.homedir(), ".config", "aidd", "telemetry"),
      platform
    );
  }
});

test("cmd.exe /s command line: the whole line is wrapped in one more pair of quotes", () => {
  // `/s` strips the first and last quote of the line, so the shim's own pair must survive it.
  assert.equal(
    cmdLine("C:\\Users\\First Last\\bin\\aidd.cmd", ["telemetry", "task", "fix", "--ticket", "P-1"]),
    '""C:\\Users\\First Last\\bin\\aidd.cmd" telemetry task fix --ticket P-1"'
  );
  assert.equal(cmdLine("C:\\bin\\aidd.cmd", []), '""C:\\bin\\aidd.cmd" "');
});

// ---------------------------------------------------------------- the async ingest

test("the ingest runs aidd once, silently, in the clone", async () => {
  const box = sandbox();
  try {
    assertPasses(ingest(box, { env: box.env({ FAKE_AIDD_NOISE: "1" }) }));
    assert.deepEqual(await callsOf(box), [{ argv: ["telemetry", "ingest", "--quiet"], cwd: box.repo }]);
  } finally {
    box.dispose();
  }
});

test("the ingest returns before aidd ends, on every host", async () => {
  const box = sandbox();
  try {
    const started = Date.now();
    assertPasses(ingest(box, { env: box.env({ FAKE_AIDD_HOLD_MS: "4000" }) }));
    assert.ok(Date.now() - started < 3000, `the hook waited ${Date.now() - started} ms`);
    assert.equal((await callsOf(box)).length, 1);
  } finally {
    box.dispose();
  }
});

test("codex: the ingest runs aidd once, silently", async () => {
  const box = sandbox();
  try {
    const ledger = path.join(codexHooks(box), "ledger.cjs");
    const payload = codexPayload(box, codexFile(box, null));
    assertPasses(run(ledger, box, { payload, env: codexEnv(box, { FAKE_AIDD_NOISE: "1" }), args: ["ingest"] }));
    assert.deepEqual((await callsOf(box)).map((c) => c.argv), [["telemetry", "ingest", "--quiet"]]);
  } finally {
    box.dispose();
  }
});

test("the ingest is silent and succeeds with no aidd, with no consent, outside Claude", async () => {
  withBox({ aidd: false }, (box) => assertPasses(ingest(box)));
  for (const [options, extra] of [[{ consent: false }, {}], [{}, { payload: { session_id: OTHER } }]]) {
    const box = sandbox(options);
    try {
      assertPasses(ingest(box, extra.payload ? { payload: box.payload(extra.payload) } : {}));
      assert.deepEqual(await callsOf(box), []);
    } finally {
      box.dispose();
    }
  }
});

// ---------------------------------------------------------------- what is registered

test("hooks.json: a reminder and an ingest at SessionStart, both bounded to 5 s, no prompt hook", () => {
  const registered = JSON.parse(fs.readFileSync(path.join(HOOKS, "hooks.json"), "utf8")).hooks;
  assert.deepEqual(Object.keys(registered), ["SessionStart"]);
  const entries = registered.SessionStart.flatMap((group) => group.hooks);
  assert.equal(entries.length, 2);
  const [reminder, ledger] = entries;
  assert.equal(reminder.command, "node ${CLAUDE_PLUGIN_ROOT}/hooks/task.cjs remind");
  assert.equal(ledger.command, "node ${CLAUDE_PLUGIN_ROOT}/hooks/ledger.cjs ingest");
  for (const entry of [reminder, ledger]) {
    assert.equal(entry.timeout, 5);
    assert.notEqual(entry.async, true);
    assert.equal(typeof entry.statusMessage, "string");
    assert.ok(fs.existsSync(path.join(HOOKS, entry.command.split(" ")[1].split("/").pop())), entry.command);
  }
});
