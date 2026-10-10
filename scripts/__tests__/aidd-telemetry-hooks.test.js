const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

// The hooks are scripts, not modules: the CLI copies them into a user's project. Each one is
// driven as a subprocess with a payload and a sandbox environment, which is what ships. The
// pure rules (directory, consent, branch role, binding) are also asserted against the shared
// fixture the CLI reads, so the two languages cannot drift apart.
const HOOKS = path.resolve(__dirname, "../../plugins/aidd-telemetry/hooks");
const GATE = path.join(HOOKS, "prompt-gate.cjs");
const START = path.join(HOOKS, "session-start.cjs");
const CATCH_UP = path.join(HOOKS, "catch-up.cjs");
const FIXTURE = path.join(__dirname, "fixtures", "telemetry-bindings");
const cases = JSON.parse(fs.readFileSync(path.join(FIXTURE, "cases.json"), "utf8"));
const expected = JSON.parse(fs.readFileSync(path.join(FIXTURE, "expected.json"), "utf8"));

const { telemetryDir } = require(path.join(HOOKS, "lib/telemetry-dir.cjs"));
const { consentOf } = require(path.join(HOOKS, "lib/consent.cjs"));
const { branchRoleOf, parseBranchConfig } = require(path.join(HOOKS, "lib/git.cjs"));
const { readCarries, readDeclarations } = require(path.join(HOOKS, "lib/binding.cjs"));
const { lookup } = require(path.join(HOOKS, "lib/lookup.cjs"));
const { parseDeclaration } = require(path.join(HOOKS, "lib/declaration.cjs"));
const { cmdLine } = require(path.join(HOOKS, "lib/aidd.cjs"));

const WINDOWS = process.platform === "win32";
const SESSION_ONE_FOR_GATE = {
  session_id: "00000000-0000-4000-8000-0000000000aa",
  task: "t",
  ticket: null,
  none: false,
  declared_at: "2026-01-01T00:00:00.000Z",
  by: "command",
};
const SESSION = "00000000-0000-4000-8000-0000000000aa";
const OTHER = "00000000-0000-4000-8000-0000000000bb";
const THIRD = "00000000-0000-4000-8000-0000000000cc";

// ---------------------------------------------------------------- sandbox

function gitDirectory() {
  const found = spawnSync(WINDOWS ? "where" : "which", ["git"], { encoding: "utf8" });
  return path.dirname(found.stdout.split(/\r?\n/u)[0]);
}
const GIT_DIR_ON_PATH = gitDirectory();

/** git as a test sets a repository up: never through a variable a commit hook exported. */
function git(cwd, ...args) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));
  const run = spawnSync(
    "git",
    ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args],
    { cwd, env, encoding: "utf8" }
  );
  assert.equal(run.status, 0, `git ${args.join(" ")}: ${run.stderr}`);
  return run.stdout;
}

const FAKE_AIDD = `
const fs = require("node:fs");
const path = require("node:path");
const argv = process.argv.slice(2);
if (process.env.FAKE_AIDD_LOG) {
  fs.appendFileSync(process.env.FAKE_AIDD_LOG, JSON.stringify({ argv, cwd: process.cwd() }) + "\\n");
}
if (process.env.FAKE_AIDD_NOISE) { process.stdout.write("noise\\n"); process.stderr.write("noise\\n"); }
if (argv.includes("--help")) process.exit(process.env.FAKE_AIDD_NO_TASK ? 1 : 0);
if (argv[0] === "telemetry" && argv[1] === "task") {
  if (process.env.FAKE_AIDD_FAIL) { process.stderr.write("boom\\n"); process.exit(1); }
  const name = argv[2] && !argv[2].startsWith("--") ? argv[2] : null;
  const dir = path.join(process.env.AIDD_TELEMETRY_DIR, "bindings");
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, "sessions.jsonl"), JSON.stringify({
    session_id: process.env.CLAUDE_CODE_SESSION_ID, task: name, ticket: null, none: name === null,
    declared_at: new Date().toISOString(), by: "hook-intercept",
  }) + "\\n");
  process.stdout.write("Declared " + (name ?? "none") + "\\n");
}
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
  if (consent) writeConsent(box.repo);
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
      CLAUDE_CODE_SESSION_ATTENDED: "1",
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
    hook_event_name: "UserPromptSubmit",
    prompt: "do the thing",
    ...extra,
  });
  box.calls = () =>
    fs.existsSync(box.log)
      ? fs.readFileSync(box.log, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
      : [];
  box.bindings = (name) => {
    const file = path.join(box.tel, "bindings", name);
    return fs.existsSync(file) ? fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  };
  box.write = (name, records) => {
    fs.mkdirSync(path.join(box.tel, "bindings"), { recursive: true });
    fs.writeFileSync(path.join(box.tel, "bindings", name), records.map((r) => `${JSON.stringify(r)}\n`).join(""));
  };
  box.dispose = () => fs.rmSync(root, { recursive: true, force: true });
  return box;
}

/** Consent is the clone's own git config, as `aidd telemetry on` writes it. */
function writeConsent(repo, value = "2") {
  git(repo, "config", "--local", "aidd.telemetry", value);
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

function run(hook, box, { payload, env, input } = {}) {
  const result = spawnSync(process.execPath, [hook], {
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

const gate = (box, opts) => run(GATE, box, opts);
const asks = (result) => result.json !== null && result.json.decision === "block";
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

test("consent value follows the fixture", () => {
  for (const [name, c] of Object.entries(cases.consent)) {
    if (c.linkedWorktree) continue;
    assert.equal(consentOf(c.value), expected.consent[name], name);
  }
});

test("the branch role follows the fixture", () => {
  for (const [name, c] of Object.entries(cases.branchRole)) {
    assert.equal(branchRoleOf(c.head, c.originHead), expected.branchRole[name], name);
  }
});

test("a branch declaration read back from real git follows the fixture", () => {
  for (const [name, c] of Object.entries(cases.gitConfig)) {
    withBox({ aidd: false, branch: c.branch }, (box) => {
      for (const [key, value] of Object.entries(c.keys)) {
        git(box.repo, "config", "--local", `branch.${c.branch}.${key}`, value);
      }
      const found = lookup({ cwd: box.repo, sessionId: null, at: new Date(), dir: box.tel, env: process.env });
      const want = c.keys.aiddTask || c.keys.aiddDeclaredAt ? "bound" : "unbound";
      assert.equal(found.binding.state, want, name);
    });
  }
});

test("binding follows the fixture, through real git and the shared files", () => {
  for (const [name, c] of Object.entries(cases.binding)) {
    withBox({ aidd: false }, (box) => {
      const head = c.head ?? "refs/heads/feat/x";
      git(box.repo, "symbolic-ref", "HEAD", head);
      if (c.head === null) {
        git(box.repo, "commit", "--allow-empty", "-q", "-m", "x");
        git(box.repo, "checkout", "-q", "--detach");
      }
      if (c.originHead) git(box.repo, "symbolic-ref", "refs/remotes/origin/HEAD", c.originHead);
      if (c.gitConfig) {
        const set = cases.gitConfig[c.gitConfig];
        for (const [key, value] of Object.entries(set.keys)) {
          // the declaration belongs to the branch HEAD is on
          const branch = head.replace(/^refs\/heads\//u, "");
          git(box.repo, "config", "--local", `branch.${c.head === null ? set.branch : branch}.${key}`, value);
        }
      }
      fs.mkdirSync(path.join(box.tel, "bindings"), { recursive: true });
      for (const file of ["sessions.jsonl", "carries.jsonl"]) {
        fs.copyFileSync(path.join(FIXTURE, file), path.join(box.tel, "bindings", file));
      }
      const found = lookup({
        cwd: box.repo,
        sessionId: c.session_id,
        at: new Date(c.at),
        dir: box.tel,
        env: process.env,
      });
      const want = expected.binding[name];
      assert.equal(found.binding.state, want.state, name);
      if (want.state === "bound") {
        assert.deepEqual(
          { source: found.binding.source, task: found.binding.task, ticket: found.binding.ticket, none: found.binding.none },
          { source: want.source, task: want.task, ticket: want.ticket, none: want.none },
          name
        );
      }
    });
  }
});

test("the shared files are read in full by the hook's own readers", () => {
  withBox({ aidd: false }, (box) => {
    fs.mkdirSync(path.join(box.tel, "bindings"), { recursive: true });
    for (const file of ["sessions.jsonl", "carries.jsonl"]) {
      fs.copyFileSync(path.join(FIXTURE, file), path.join(box.tel, "bindings", file));
    }
    assert.ok(readDeclarations(box.tel).length >= 5);
    assert.ok(readCarries(box.tel).length >= 5);
  });
});

test("parseBranchConfig cuts the known suffix off a dotted branch name", () => {
  const out = "branch.release/1.2.aidd.aiddtask\nx\0branch.release/1.2.aidd.aidddeclaredat\nt\0";
  assert.deepEqual(parseBranchConfig(out, "release/1.2.aidd"), { task: "x", ticket: null, declared_at: "t" });
});

// ---------------------------------------------------------------- the guards, end to end

test("the gate asks on an unbound working branch with a person present", () => {
  withBox({}, (box) => {
    const result = gate(box);
    assert.equal(result.status, 0);
    assert.equal(result.json.decision, "block");
    const reason = result.json.reason;
    assert.ok(reason.includes("! aidd telemetry task <name> [--ticket <ref>]"), reason);
    assert.ok(reason.includes("typed as a prompt"), reason);
    assert.ok(reason.includes("--none"), reason);
    assert.equal(result.json.hookSpecificOutput, undefined, "the person's real prompt stays visible");
  });
});

test("claude-only: every fixture case passes or asks as expected", () => {
  for (const [name, c] of Object.entries(cases.claudeOnly)) {
    withBox({}, (box) => {
      const env = box.env();
      if (c.env_session_id === null) delete env.CLAUDE_CODE_SESSION_ID;
      else env.CLAUDE_CODE_SESSION_ID = c.env_session_id;
      const payload = box.payload({ session_id: c.payload_session_id, transcript_path: c.transcript_path });
      if (c.payload_session_id === null) delete payload.session_id;
      if (c.transcript_path === null) delete payload.transcript_path;
      const result = gate(box, { payload, env });
      assert.equal(asks(result), expected.claudeOnly[name], name);
      if (!expected.claudeOnly[name]) assertPasses(result);
    });
  }
});

test("claude-only: a Codex or Copilot shaped payload passes and writes nothing", () => {
  withBox({}, (box) => {
    const codex = box.payload({
      transcript_path: path.join(box.home, ".codex", "sessions", "2026", "10", "09", `rollout-x-${SESSION}.jsonl`),
    });
    assertPasses(gate(box, { payload: codex }));
    // a Codex home that happens to sit under a `projects` directory is still Codex
    const nested = box.payload({
      transcript_path: path.join(box.root, "projects", ".codex", "sessions", "2026", "10", "09", `rollout-x-${SESSION}.jsonl`),
    });
    assertPasses(gate(box, { payload: nested }));
    assertPasses(run(START, box, { payload: { ...codex, hook_event_name: "SessionStart", source: "startup" } }));
    const copilot = { sessionId: SESSION, timestamp: 1, prompt: "x", cwd: box.repo };
    assertPasses(gate(box, { payload: copilot }));
    assert.equal(fs.existsSync(box.tel), false);
    assert.deepEqual(box.calls(), []);
  });
});

test("presence: only ATTENDED=1 with a non-sdk entrypoint asks", () => {
  const absent = (name) => (env) => delete env[name];
  const rows = [
    ["attended and cli", (env) => env, true],
    ["attended and a desktop entrypoint", (env) => Object.assign(env, { CLAUDE_CODE_ENTRYPOINT: "claude-desktop" }), true],
    ["unattended", (env) => Object.assign(env, { CLAUDE_CODE_SESSION_ATTENDED: "0" }), false],
    ["sdk-cli", (env) => Object.assign(env, { CLAUDE_CODE_ENTRYPOINT: "sdk-cli" }), false],
    ["sdk-ts", (env) => Object.assign(env, { CLAUDE_CODE_ENTRYPOINT: "sdk-ts" }), false],
    ["attended variable absent", absent("CLAUDE_CODE_SESSION_ATTENDED"), false],
    ["entrypoint absent", absent("CLAUDE_CODE_ENTRYPOINT"), false],
    ["entrypoint empty", (env) => Object.assign(env, { CLAUDE_CODE_ENTRYPOINT: "" }), false],
    ["attended is true, not 1", (env) => Object.assign(env, { CLAUDE_CODE_SESSION_ATTENDED: "true" }), false],
  ];
  for (const [name, change, want] of rows) {
    withBox({}, (box) => {
      const env = box.env();
      change(env);
      const result = gate(box, { env });
      assert.equal(asks(result), want, name);
      if (!want) assertPasses(result);
    });
  }
});

test("presence: a typed declaration is not run for nobody", () => {
  withBox({}, (box) => {
    const env = box.env({ CLAUDE_CODE_SESSION_ATTENDED: "0" });
    assertPasses(gate(box, { payload: box.payload({ prompt: "aidd telemetry task x" }), env }));
    assert.deepEqual(box.calls(), []);
  });
});

test("consent: every fixture case grants or refuses as expected", () => {
  for (const [name, c] of Object.entries(cases.consent)) {
    withBox({ consent: false }, (box) => {
      if (c.value !== null) writeConsent(box.repo, c.value);
      assert.equal(asks(gate(box)), expected.consent[name] === "granted", name);
    });
  }
});

test("consent: a linked worktree sees the main clone's consent, and a clone without it asks nothing", () => {
  withBox({ consent: false }, (box) => {
    git(box.repo, "commit", "--allow-empty", "-q", "-m", "x");
    const linked = path.join(box.root, "linked");
    git(box.repo, "worktree", "add", "-q", "-b", "feat/y", linked);
    assertPasses(gate(box, { payload: box.payload({ cwd: linked }) }));
    writeConsent(box.repo);
    assert.equal(asks(gate(box, { payload: box.payload({ cwd: linked }) })), true);
  });
});

test("consent: a committed .aidd/config.json is not consent, so nothing is asked of a teammate", () => {
  withBox({ consent: false }, (box) => {
    writeCommittedConfig(box.repo, '{"telemetry":{"enabled":true,"version":2}}');
    assertPasses(gate(box));
    assertPasses(gate(box, { payload: box.payload({ prompt: "aidd telemetry task x" }) }));
    assert.deepEqual(box.calls(), []);
    writeConsent(box.repo);
    assert.equal(asks(gate(box)), true);
  });
});

test("consent: AIDD_TELEMETRY=0 refuses before git is asked", () => {
  withBox({}, (box) => {
    // no git on PATH at all: a refusal by the environment must not need it
    assertPasses(gate(box, { env: { ...box.env({ AIDD_TELEMETRY: "0" }), PATH: "" } }));
  });
});

test("consent: found from a subdirectory of the repository", () => {
  withBox({}, (box) => {
    const sub = path.join(box.repo, "a", "b");
    fs.mkdirSync(sub, { recursive: true });
    assert.equal(asks(gate(box, { payload: box.payload({ cwd: sub }) })), true);
  });
});

test("consent: AIDD_TELEMETRY refuses on exactly 0", () => {
  for (const [name, env] of Object.entries(cases.environmentRefusal)) {
    withBox({}, (box) => {
      const result = gate(box, { env: box.env(env) });
      assert.equal(asks(result), !expected.environmentRefusal[name], name);
    });
  }
});

test("branch role: every fixture case asks only on a working branch", () => {
  for (const [name, c] of Object.entries(cases.branchRole)) {
    withBox({}, (box) => {
      git(box.repo, "symbolic-ref", "HEAD", c.head ?? "refs/heads/feat/x");
      if (c.head === null) {
        git(box.repo, "commit", "--allow-empty", "-q", "-m", "x");
        git(box.repo, "checkout", "-q", "--detach");
      }
      if (c.originHead) git(box.repo, "symbolic-ref", "refs/remotes/origin/HEAD", c.originHead);
      const result = gate(box);
      assert.equal(asks(result), expected.branchRole[name] === "working", name);
    });
  }
});

test("the default branch and a detached head are never asked, and git is not needed to say so for a bound session", () => {
  withBox({ branch: "main" }, (box) => assertPasses(gate(box)));
  withBox({}, (box) => {
    git(box.repo, "commit", "--allow-empty", "-q", "-m", "x");
    git(box.repo, "checkout", "-q", "--detach");
    assertPasses(gate(box));
  });
});

test("a bound branch, session or carried session passes", () => {
  withBox({}, (box) => {
    git(box.repo, "config", "--local", "branch.feat/x.aiddTask", "t");
    assertPasses(gate(box));
  });
  withBox({}, (box) => {
    git(box.repo, "config", "--local", "branch.feat/x.aiddDeclaredAt", "2026-10-09T09:00:00.000Z");
    assertPasses(gate(box));
  });
  withBox({}, (box) => {
    box.write("sessions.jsonl", [
      { session_id: SESSION, task: "t", ticket: null, none: false, declared_at: "2026-01-01T00:00:00.000Z", by: "command" },
    ]);
    assertPasses(gate(box));
  });
  withBox({}, (box) => {
    box.write("sessions.jsonl", [
      { session_id: OTHER, task: "t", ticket: null, none: false, declared_at: "2026-01-01T00:00:00.000Z", by: "command" },
    ]);
    box.write("carries.jsonl", [{ session_id: SESSION, from: OTHER, at: "2026-01-02T00:00:00.000Z" }]);
    assertPasses(gate(box));
  });
});

test("answer path: with aidd absent, or without telemetry task, an unbound branch is never blocked", () => {
  withBox({ aidd: false }, (box) => {
    assert.ok(!fs.existsSync(path.join(GIT_DIR_ON_PATH, WINDOWS ? "aidd.cmd" : "aidd")), "a real aidd is on the test PATH");
    assertPasses(gate(box));
  });
  withBox({}, (box) => {
    assertPasses(gate(box, { env: box.env({ FAKE_AIDD_NO_TASK: "1" }) }));
    assert.deepEqual(box.calls().map((c) => c.argv), [["telemetry", "task", "--help"]]);
  });
});

test("answer path: checked only when the gate would otherwise ask", () => {
  withBox({ branch: "main" }, (box) => {
    gate(box);
    assert.deepEqual(box.calls(), []);
  });
});

test("a hook given malformed or empty stdin passes", () => {
  withBox({}, (box) => {
    for (const hook of [GATE, START, CATCH_UP]) {
      assertPasses(run(hook, box, { input: "{not json" }));
      assertPasses(run(hook, box, { input: "" }));
      assertPasses(run(hook, box, { input: "[1]" }));
    }
    // odd field types never crash the hook
    assert.equal(gate(box, { payload: box.payload({ prompt: 42, cwd: 7 }) }).status, 0);
  });
});

// ---------------------------------------------------------------- intercepting a declaration

test("a typed declaration reaches no model: the CLI stores it, the hook blocks with its output", () => {
  withBox({}, (box) => {
    const result = gate(box, { payload: box.payload({ prompt: "aidd telemetry task fix-cart --ticket PROJ-1" }) });
    assert.equal(result.json.decision, "block");
    assert.equal(result.json.reason, "Declared fix-cart");
    assert.equal(result.json.hookSpecificOutput.suppressOriginalPrompt, true);
    assert.equal(result.json.hookSpecificOutput.hookEventName, "UserPromptSubmit");
    const calls = box.calls();
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].argv, ["telemetry", "task", "fix-cart", "--ticket", "PROJ-1", "--by", "hook-intercept"]);
    assert.equal(fs.realpathSync(calls[0].cwd), box.repo);
    assert.equal(box.bindings("sessions.jsonl").length, 1);
    // the next prompt passes
    assertPasses(gate(box));
  });
});

test("an intercepted declaration runs --none, a bare name, a quoted name and a ! prefix", () => {
  const rows = [
    ["aidd telemetry task --none", ["telemetry", "task", "--none", "--by", "hook-intercept"]],
    ["! aidd telemetry task fix", ["telemetry", "task", "fix", "--by", "hook-intercept"]],
    ["  !aidd   telemetry task   fix  ", ["telemetry", "task", "fix", "--by", "hook-intercept"]],
    ['aidd telemetry task "cart fix" --ticket \'PROJ 1\'', WINDOWS ? "refused" : ["telemetry", "task", "cart fix", "--ticket", "PROJ 1", "--by", "hook-intercept"]],
    ["aidd telemetry task", ["telemetry", "task", "--by", "hook-intercept"]],
  ];
  for (const [prompt, argv] of rows) {
    withBox({}, (box) => {
      const result = gate(box, { payload: box.payload({ prompt }) });
      assert.equal(result.json.decision, "block", prompt);
      if (argv === "refused") assert.equal(box.calls().length, 0);
      else assert.deepEqual(box.calls().map((c) => c.argv), [argv], prompt);
    });
  }
});

test("injection: shell syntax in a typed declaration runs no second command", () => {
  const poisons = [
    "aidd telemetry task x; touch PWNED",
    "aidd telemetry task x && touch PWNED",
    "aidd telemetry task x | touch PWNED",
    "aidd telemetry task x `touch PWNED`",
    "aidd telemetry task x $(touch PWNED)",
    "aidd telemetry task x\ntouch PWNED",
    "aidd telemetry task x\r\ntouch PWNED",
    "aidd telemetry task x > PWNED",
    "aidd telemetry task x < PWNED",
    "aidd telemetry task x & touch PWNED",
    "aidd telemetry task x\\ y",
    "aidd telemetry task x%PATH%",
  ];
  for (const prompt of poisons) {
    // Not a declaration the hook can run, so it falls through to the ordinary gate: on the
    // default branch that is a silent pass, and nothing at all is spawned.
    withBox({ branch: "main" }, (box) => {
      assertPasses(gate(box, { payload: box.payload({ prompt }) }));
      assert.ok(!fs.existsSync(path.join(box.repo, "PWNED")), prompt);
      assert.deepEqual(box.calls(), [], `${JSON.stringify(prompt)} spawned something`);
    });
    // On an unbound working branch it is the usual ask, which probes `aidd` and nothing else.
    withBox({}, (box) => {
      const result = gate(box, { payload: box.payload({ prompt }) });
      assert.equal(result.json.decision, "block", prompt);
      assert.match(result.json.reason, /No task is declared/u, prompt);
      assert.ok(!fs.existsSync(path.join(box.repo, "PWNED")), prompt);
      assert.deepEqual(box.calls().map((c) => c.argv), [["telemetry", "task", "--help"]], prompt);
    });
  }
});

test("a declaration mistyped is blocked with the grammar and the quoting hint, and runs nothing", () => {
  const attempts = [
    "aidd telemetry task fix cart",
    "! aidd telemetry task fix cart",
    "aidd telemetry task x --by command",
    "aidd telemetry task x --help",
    "aidd telemetry task --help",
    "aidd telemetry task --ticket=PROJ-1 x",
    "aidd telemetry task x --ticket",
    "aidd telemetry task --none x",
    "aidd telemetry task -x",
    "aidd telemetry task-x",
    'aidd telemetry task "x; touch PWNED"',
    "aidd telemetry task 'x$(touch PWNED)'",
  ];
  for (const prompt of attempts) {
    for (const branch of ["main", "feat/x"]) {
      withBox({ branch }, (box) => {
        const result = gate(box, { payload: box.payload({ prompt }) });
        assert.equal(result.json.decision, "block", prompt);
        assert.match(result.json.reason, /not understood/iu, prompt);
        assert.match(result.json.reason, /aidd telemetry task <name> \[--ticket <ref>\]/u, prompt);
        assert.match(result.json.reason, /aidd telemetry task "fix cart"/u, prompt);
        assert.match(result.json.reason, /fix-cart/u, prompt);
        // not run, so the person's words stay visible to retype
        assert.equal(result.json.hookSpecificOutput, undefined, prompt);
        assert.ok(!fs.existsSync(path.join(box.repo, "PWNED")), prompt);
        assert.deepEqual(box.calls(), [], `${JSON.stringify(prompt)} spawned something`);
      });
    }
  }
  withBox({}, (box) => {
    box.write("sessions.jsonl", [{ ...SESSION_ONE_FOR_GATE }]);
    const result = gate(box, { payload: box.payload({ prompt: "aidd telemetry task fix cart" }) });
    assert.equal(result.json.decision, "block");
    assert.deepEqual(box.calls(), []);
  });
});

test("a prompt that only starts like a declaration is an ordinary prompt, never refused as not understood", () => {
  const talk = [
    "aidd telemetry task is broken, can you debug why?",
    "aidd telemetry task why is it broken?",
    "aidd telemetry task fix it!",
    "aidd telemetry task fix the cart.",
    "aidd telemetry task x\nand a second line",
  ];
  for (const prompt of talk) {
    withBox({ branch: "main" }, (box) => {
      assertPasses(gate(box, { payload: box.payload({ prompt }) }));
      assert.deepEqual(box.calls(), [], prompt);
    });
    withBox({}, (box) => {
      box.write("sessions.jsonl", [{ ...SESSION_ONE_FOR_GATE }]);
      assertPasses(gate(box, { payload: box.payload({ prompt }) }));
    });
    withBox({}, (box) => {
      const result = gate(box, { payload: box.payload({ prompt }) });
      assert.equal(result.json.decision, "block", prompt);
      assert.match(result.json.reason, /No task is declared/u, prompt);
      // the person's real words stay visible to retype: this prompt was not run
      assert.equal(result.json.hookSpecificOutput, undefined, prompt);
    });
  }
});

test("a declaration that fails shows why, and one with no aidd says aidd is needed", () => {
  withBox({}, (box) => {
    const result = gate(box, {
      payload: box.payload({ prompt: "aidd telemetry task x" }),
      env: box.env({ FAKE_AIDD_FAIL: "1" }),
    });
    assert.equal(result.json.decision, "block");
    assert.match(result.json.reason, /Declaration failed\. boom/u);
  });
  withBox({ aidd: false }, (box) => {
    const result = gate(box, { payload: box.payload({ prompt: "aidd telemetry task x" }) });
    assert.equal(result.json.decision, "block");
    assert.match(result.json.reason, /aidd is needed/u);
  });
});

test("parseDeclaration accepts only words, quoted strings, --ticket and --none", () => {
  assert.deepEqual(parseDeclaration("aidd telemetry task a --ticket B-1"), [
    "telemetry", "task", "a", "--ticket", "B-1", "--by", "hook-intercept",
  ]);
  assert.equal(parseDeclaration("aidd telemetry task a --none"), null);
  assert.equal(parseDeclaration("aidd telemetry task --ticket B-1"), null);
  assert.equal(parseDeclaration("aidd telemetry task a --ticket b --ticket c"), null);
  assert.equal(parseDeclaration('aidd telemetry task "a"b'), null);
  assert.equal(parseDeclaration('aidd telemetry task "-a"'), null);
  assert.equal(parseDeclaration("do something else"), null);
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

// ---------------------------------------------------------------- session facts and the clear carry

const SESSION_ONE = { session_id: SESSION, task: "checkout-fix", ticket: "PROJ-12", none: false, declared_at: "2026-01-01T00:00:00.000Z", by: "command" };

function start(box, sessionId, source, env = {}) {
  return run(START, box, {
    payload: box.payload({ session_id: sessionId, hook_event_name: "SessionStart", source, transcript_path: path.join(box.home, ".claude", "projects", "-repo", `${sessionId}.jsonl`) }),
    env: box.env({ CLAUDE_CODE_SESSION_ID: sessionId, CLAUDE_PID: "4242", ...env }),
  });
}

test("every session start records its pid, session, source and time", () => {
  withBox({}, (box) => {
    assertPasses(start(box, SESSION, "startup"));
    const [fact] = box.bindings("processes.jsonl");
    assert.deepEqual(Object.keys(fact), ["pid", "session_id", "source", "at"]);
    assert.equal(fact.pid, 4242);
    assert.equal(fact.session_id, SESSION);
    assert.equal(fact.source, "startup");
    assert.ok(!Number.isNaN(Date.parse(fact.at)));
  });
});

test("without CLAUDE_PID the hook's parent is the process", () => {
  withBox({}, (box) => {
    const env = box.env();
    const result = run(START, box, {
      payload: box.payload({ hook_event_name: "SessionStart", source: "startup" }),
      env,
    });
    assertPasses(result);
    assert.equal(box.bindings("processes.jsonl")[0].pid, process.pid);
  });
});

test("a clear in the same process carries the previous session's task, and says so", () => {
  withBox({}, (box) => {
    box.write("sessions.jsonl", [SESSION_ONE]);
    assertPasses(start(box, SESSION, "startup"));
    const cleared = start(box, OTHER, "clear");
    assert.equal(cleared.status, 0);
    assert.deepEqual(Object.keys(cleared.json), ["systemMessage"]);
    assert.match(cleared.json.systemMessage, /Task checkout-fix \(ticket PROJ-12\) kept after \/clear\. Different work: aidd telemetry task <name>/u);
    const [carry] = box.bindings("carries.jsonl");
    assert.deepEqual(Object.keys(carry), ["session_id", "from", "at"]);
    assert.equal(carry.session_id, OTHER);
    assert.equal(carry.from, SESSION);
    // the next prompt of the new session reads as bound: carried, so not asked
    assertPasses(gate(box, { payload: box.payload({ session_id: OTHER, transcript_path: path.join(box.home, ".claude", "projects", "-repo", `${OTHER}.jsonl`) }), env: box.env({ CLAUDE_CODE_SESSION_ID: OTHER }) }));
  });
});

test("a clear chains: the carried session carries on", () => {
  withBox({}, (box) => {
    box.write("sessions.jsonl", [SESSION_ONE]);
    start(box, SESSION, "startup");
    start(box, OTHER, "clear");
    const third = start(box, THIRD, "clear");
    assert.match(third.json.systemMessage, /Task checkout-fix/u);
    assert.deepEqual(box.bindings("carries.jsonl").map((c) => c.from), [SESSION, OTHER]);
  });
});

test("a clear of a session declared as none says so", () => {
  withBox({}, (box) => {
    box.write("sessions.jsonl", [{ ...SESSION_ONE, task: null, ticket: null, none: true }]);
    start(box, SESSION, "startup");
    assert.match(start(box, OTHER, "clear").json.systemMessage, /No task kept after \/clear/u);
  });
});

test("a clear carries nothing from another process, from an unbound session, or twice", () => {
  withBox({}, (box) => {
    box.write("sessions.jsonl", [SESSION_ONE]);
    start(box, SESSION, "startup", { CLAUDE_PID: "1111" });
    assertPasses(start(box, OTHER, "clear", { CLAUDE_PID: "2222" }));
    assert.deepEqual(box.bindings("carries.jsonl"), []);
  });
  withBox({}, (box) => {
    start(box, SESSION, "startup");
    assertPasses(start(box, OTHER, "clear"));
    assert.deepEqual(box.bindings("carries.jsonl"), []);
  });
  withBox({}, (box) => {
    box.write("sessions.jsonl", [SESSION_ONE]);
    start(box, SESSION, "startup");
    start(box, OTHER, "clear");
    assertPasses(start(box, OTHER, "clear"));
    assert.equal(box.bindings("carries.jsonl").length, 1);
  });
});

test("a pid recorded before this boot is not a predecessor", () => {
  withBox({}, (box) => {
    box.write("sessions.jsonl", [SESSION_ONE]);
    box.write("processes.jsonl", [{ pid: 4242, session_id: SESSION, source: "startup", at: "2001-01-01T00:00:00.000Z" }]);
    assertPasses(start(box, OTHER, "clear"));
    assert.deepEqual(box.bindings("carries.jsonl"), []);
  });
});

test("startup, resume and compact carry nothing, but a branch (fork) does", () => {
  for (const source of ["startup", "resume", "compact"]) {
    withBox({}, (box) => {
      box.write("sessions.jsonl", [SESSION_ONE]);
      start(box, SESSION, "startup");
      assertPasses(start(box, OTHER, source));
      assert.deepEqual(box.bindings("carries.jsonl"), [], source);
      assert.equal(box.bindings("processes.jsonl").length, 2, source);
    });
  }
  withBox({}, (box) => {
    box.write("sessions.jsonl", [SESSION_ONE]);
    start(box, SESSION, "startup");
    const forked = start(box, OTHER, "fork");
    assert.match(forked.json.systemMessage, /Task checkout-fix .* kept on the branched session/u);
    assert.equal(box.bindings("carries.jsonl")[0].from, SESSION);
  });
});

test("session start does nothing outside an opted-in project or when refused", () => {
  withBox({ consent: false }, (box) => {
    assertPasses(start(box, SESSION, "startup"));
    assert.equal(fs.existsSync(box.tel), false);
  });
  withBox({}, (box) => {
    assertPasses(start(box, SESSION, "startup", { AIDD_TELEMETRY: "0" }));
    assert.equal(fs.existsSync(box.tel), false);
  });
});

test("session start records facts even when nobody is present", () => {
  withBox({}, (box) => {
    assertPasses(start(box, SESSION, "startup", { CLAUDE_CODE_SESSION_ATTENDED: "0", CLAUDE_CODE_ENTRYPOINT: "sdk-cli" }));
    assert.equal(box.bindings("processes.jsonl").length, 1);
  });
});

// ---------------------------------------------------------------- the async catch-up

function catchUp(box, env = {}) {
  return run(CATCH_UP, box, {
    payload: box.payload({ hook_event_name: "SessionStart", source: "startup" }),
    env: box.env(env),
  });
}

test("the catch-up ingests, silently, once", () => {
  withBox({}, (box) => {
    assertPasses(catchUp(box, { FAKE_AIDD_NOISE: "1" }));
    assert.deepEqual(box.calls().map((c) => c.argv), [["telemetry", "ingest", "--quiet"]]);
  });
});

test("the catch-up is silent and succeeds with no aidd, with no consent, outside Claude", () => {
  withBox({ aidd: false }, (box) => assertPasses(catchUp(box)));
  withBox({ consent: false }, (box) => {
    assertPasses(catchUp(box));
    assert.deepEqual(box.calls(), []);
  });
  withBox({}, (box) => {
    assertPasses(run(CATCH_UP, box, { payload: box.payload({ session_id: OTHER }) }));
    assert.deepEqual(box.calls(), []);
  });
});

// ---------------------------------------------------------------- what is registered

test("hooks.json registers the three hooks, the catch-up async, every script present", () => {
  const registered = JSON.parse(fs.readFileSync(path.join(HOOKS, "hooks.json"), "utf8")).hooks;
  const start = registered.SessionStart.flatMap((group) => group.hooks);
  assert.equal(start.length, 2);
  assert.ok(start[0].command.endsWith("/hooks/session-start.cjs"));
  assert.notEqual(start[0].async, true, "the session facts must be written before the next hook");
  assert.ok(start[1].command.endsWith("/hooks/catch-up.cjs"));
  assert.equal(start[1].async, true);
  const prompt = registered.UserPromptSubmit.flatMap((group) => group.hooks);
  assert.equal(prompt.length, 1);
  assert.ok(prompt[0].command.endsWith("/hooks/prompt-gate.cjs"));
  assert.notEqual(prompt[0].async, true, "an async hook cannot block");
  for (const entry of [...start, ...prompt]) {
    assert.match(entry.command, /^node \$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/[a-z-]+\.cjs$/u);
    assert.ok(fs.existsSync(path.join(HOOKS, path.basename(entry.command))), entry.command);
  }
});
