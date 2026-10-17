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

/** The shapes the repository actually leaked, under a made-up account. */
const LEAKS = {
  home: `cd ${slash("", "Users", LEAKER, "orca", "workspaces", "framework", "wt")}`,
  linuxHome: `"cwd": "${slash("", "home", LEAKER, "repo")}"`,
  scratch: `in \`${slash("", "private", "tmp", "claude-501", "-Users-x-y", "0d2c1f3e-0000-4000-8000-0000000000aa", "scratchpad")}\``,
  macTemp: `"root": "${slash("", "private", "var", "folders", "xr", "abc123", "T", "aidd-x")}"`,
  windows: `"home": "${back("\\\\", "C:", "Users", LEAKER, "AppData")}"`,
  windowsRaw: `at ${back("\\", "D:", "Users", LEAKER, "repo")}`,
};

describe("findLocalPaths", () => {
  it("names each leaked shape by its pattern, never by the name it matched", () => {
    const found = Object.values(LEAKS).flatMap((line) => findLocalPaths(line));

    assert.deepEqual(
      found.map(({ label }) => label),
      [
        "/Users/<name>/",
        "/home/<name>/",
        "/private/tmp/claude-<uid>/",
        slash("", "var", "folders", ""),
        "C:\\Users\\<name>\\",
        "C:\\Users\\<name>\\",
      ]
    );
    for (const { label } of found) assert.doesNotMatch(label, new RegExp(LEAKER, "u"));
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
    ];

    for (const sample of placeholders) assert.deepEqual(findLocalPaths(sample), [], sample);
  });

  it("ignores a path that only looks like a home: no account, or not at the root", () => {
    const lookalikes = [
      slash("", "home", ".claude", "settings.json"),
      slash("", "proj", "home", LEAKER, "x"),
      slash("", "Users", ""),
      `${slash("", "home", LEAKER)} with no trailing separator`,
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

  it("checks only the files it is handed, and skips a binary one", () => {
    const cwd = repoWith({
      "staged.md": `${LEAKS.home}\n`,
      "untouched.md": `${LEAKS.linuxHome}\n`,
      "blob.bin": Buffer.concat([Buffer.from([0]), Buffer.from(LEAKS.home)]),
    });

    try {
      const run = runIn(cwd, ["staged.md", "blob.bin"]);
      const out = run.stdout + run.stderr;

      assert.equal(run.status, 1, out);
      assert.match(out, /staged\.md:1:/u);
      assert.doesNotMatch(out, /untouched\.md|blob\.bin/u);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
});
