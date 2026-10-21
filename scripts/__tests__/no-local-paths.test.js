const assert = require("node:assert/strict");
const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { describe, it } = require("node:test");

const { findLocalPaths } = require("../check-no-local-paths.js");

const script = path.resolve(__dirname, "../check-no-local-paths.js");

/** Inside a git hook GIT_DIR and GIT_INDEX_FILE point at this repository: a scratch repo must not
 * inherit them, or its `git add` stages into the real index. */
const CLEAN_ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));

// Every sample is assembled at run time: written out whole, it would trip the guard on this file.
const slash = (...parts) => parts.join("/");
const back = (sep, ...parts) => parts.join(sep);
const LEAKER = "zq-leaker";
/** Random-looking, as a real one is: a placeholder id repeats a digit and is let through. */
const SESSION = ["0d2c1f3e", "9a7b", "4c5d", "8e6f", "1a2b3c4d5e6f"].join("-");
/** Thirteen distinct hex digits: as varied as a real id gets, yet short of all sixteen. */
const SESSION_13 = ["9c1a7b30", "52c8", "4a16", "b073", "c18a59b26c40"].join("-");
/** The made-up-id boundary: seven distinct digits pass, eight are a real id. */
const SEVEN_DIGITS = ["01234801", "2340", "4801", "8a01", "234801234801"].join("-");
const EIGHT_DIGITS = ["01234801", "2340", "4801", "8a01", "23480123480b"].join("-");
const sessionKey = (id) => `{"session_id":"${id}"}`;

/** The shapes the repository actually leaked, under a made-up account. */
const LEAKS = {
  home: `cd ${slash("", "Users", LEAKER, "orca", "workspaces", "framework", "wt")}`,
  linuxHome: `"cwd": "${slash("", "home", LEAKER, "repo")}"`,
  scratch: `in \`${slash("", "private", "tmp", "claude-501", "-Users-user-y", "0d2c1f3e-0000-4000-8000-0000000000aa", "scratchpad")}\``,
  macTemp: `"root": "${slash("", "private", "var", "folders", "xr", "abc123", "T", "aidd-x")}"`,
  windows: `"home": "${back("\\\\", "C:", "Users", LEAKER, "AppData")}"`,
  windowsRaw: `at ${back("\\", "D:", "Users", LEAKER, "repo")}`,
  bareHome: `"home": "${slash("", "Users", LEAKER)}"`,
  bareLinuxHome: `HOME=${slash("", "home", LEAKER)}`,
  bareWindows: `cd ${back("\\", "C:", "Users", LEAKER)}`,
  slug: `${slash("~", ".claude", "projects", `-Users-${LEAKER}-orca-x`, "abc.jsonl")}`,
  windowsSlug: `projects ${["C", "", "Users", LEAKER, "repo"].join("-")}`,
  sessionKey: `{"session_id":"${SESSION}"}`,
  sessionState: `${slash("~", ".copilot", "session-state", SESSION, "events.jsonl")}`,
  sessionVaried: sessionKey(SESSION_13),
  sessionBoundary: sessionKey(EIGHT_DIGITS),
  sessionEscaped: `"user_id": "{\\"session_id\\":\\"${SESSION}\\"}"`,
  rollout: slash("~", ".codex", "sessions", "2026", "07", "16", `rollout-2026-07-16T09-25-07-${SESSION}.jsonl`),
  transcript: `"transcript_path": "${slash("~", ".claude", "projects", "repo", `${SESSION_13}.jsonl`)}"`,
  windowsTranscript: `at ${back("\\", "D:", "work", `${SESSION}.jsonl`)}`,
  threadKey: `{"thread_id":"${SESSION}"}`,
  threadIdKey: `{"threadId":"${SESSION}"}`,
};

describe("findLocalPaths", () => {
  it("names each leaked shape by its pattern, never by the name it matched", () => {
    const found = Object.values(LEAKS).flatMap((line) => findLocalPaths(line));

    assert.deepEqual(
      found.map(({ label }) => label),
      [
        "/Users/<name>",
        "/home/<name>",
        "/private/tmp/claude-<uid>/",
        slash("", "var", "folders", ""),
        "C:\\Users\\<name>",
        "C:\\Users\\<name>",
        "/Users/<name>",
        "/home/<name>",
        "C:\\Users\\<name>",
        "-Users-<name>-",
        "-Users-<name>-",
        "session id",
        "session id",
        "session id",
        "session id",
        "session id",
        "session file",
        "session file",
        "session file",
        "session id",
        "session id",
      ]
    );
    for (const { label } of found) {
      assert.doesNotMatch(label, new RegExp(`${LEAKER}|zq|${SESSION}`, "u"));
    }
  });

  it("reports the line each leak sits on", () => {
    const text = ["clean", LEAKS.home, "clean", LEAKS.macTemp].join("\n");

    assert.deepEqual(
      findLocalPaths(text).map(({ line }) => line),
      [2, 4]
    );
  });

  it("lets a placeholder account through, whatever its case or 8.3 suffix", () => {
    const placeholders = [
      slash("", "home", "user", "x"),
      slash("", "Users", "someone", ".config"),
      slash("", "home", "U", "x"),
      back("\\\\", "C:", "Users", "runner", "x"),
      back("\\\\", "C:", "Users", "RUNNER~1", "x"),
      `ends a sentence at ${slash("", "home", "user")}.`,
      `${slash("~", ".claude", "projects", "-Users-user-repo", "a.jsonl")}`,
      sessionKey(["00000000", "0000", "4000", "8000", "00000000000a"].join("-")),
      sessionKey(SEVEN_DIGITS),
      slash("", "fake-project", `${SEVEN_DIGITS}.jsonl`),
    ];

    for (const sample of placeholders) assert.deepEqual(findLocalPaths(sample), [], sample);
  });

  it("ignores a path that only looks like a home: no account, or not at the root", () => {
    const lookalikes = [
      slash("", "home", ".claude", "settings.json"),
      slash("", "proj", "home", LEAKER, "x"),
      slash("", "Users", ""),
      `{"turn_id":"${SESSION}"}`,
      slash("", "dir", `${SESSION}.json`),
    ];

    for (const sample of lookalikes) assert.deepEqual(findLocalPaths(sample), [], sample);
  });
});

describe("the command line", () => {
  /** An argument array, never a shell string: a Windows shell splits a quoted path. */
  function runIn(cwd, args) {
    return cp.spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8", env: CLEAN_ENV });
  }

  function repoWith(files) {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "aidd-no-local-paths-"));
    cp.execFileSync("git", ["init", "-q"], { cwd, env: CLEAN_ENV });
    for (const [file, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
      fs.writeFileSync(path.join(cwd, file), text);
    }
    cp.execFileSync("git", ["add", "-A"], { cwd, env: CLEAN_ENV });
    return cwd;
  }

  it("fails --all on a tracked leak with file:line and the redacted pattern", () => {
    const cwd = repoWith({ "docs/plan.md": `# Plan\n\n${LEAKS.scratch}\n`, "ok.md": "clean\n" });

    try {
      const run = runIn(cwd, ["--all"]);
      const out = run.stdout + run.stderr;

      assert.equal(run.status, 1, out);
      assert.match(out, /docs\/plan\.md:3: \/private\/tmp\/claude-<uid>\//u);
      assert.doesNotMatch(out, /0d2c1f3e/u);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("passes --all once the leak is a placeholder", () => {
    const cwd = repoWith({ "docs/plan.md": "# Plan\n\nin `<scratch>/bench/`\n" });

    try {
      const run = runIn(cwd, ["--all"]);
      assert.equal(run.status, 0, run.stdout + run.stderr);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("checks only the files it is handed, skipping a binary, a deleted file and a folder", () => {
    const cwd = repoWith({
      "staged.md": `${LEAKS.home}\n`,
      "untouched.md": `${LEAKS.linuxHome}\n`,
      "blob.bin": Buffer.concat([Buffer.from([0]), Buffer.from(LEAKS.home)]),
      "docs/inner.md": "clean\n",
    });

    try {
      const run = runIn(cwd, ["staged.md", "blob.bin", "deleted.md", "docs"]);
      const out = run.stdout + run.stderr;

      assert.equal(run.status, 1, out);
      assert.match(out, /staged\.md:1:/u);
      assert.doesNotMatch(out, /untouched\.md|blob\.bin/u);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
});
