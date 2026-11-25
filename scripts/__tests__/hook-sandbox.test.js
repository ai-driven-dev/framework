const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { cleanEnv, createSandbox, nodeCommand, readJsonLines, runHeadless } = require("../lib/hook-sandbox.cjs");

function withTempDir(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hook-sandbox-"));
  try {
    run(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe("readJsonLines", () => {
  it("parses each non-empty line", () => {
    withTempDir((dir) => {
      const file = path.join(dir, "a.jsonl");
      fs.writeFileSync(file, '{"a":1}\n\n{"b":2}\n');
      assert.deepEqual(readJsonLines(file), [{ a: 1 }, { b: 2 }]);
    });
  });

  it("is null for a missing file and for one that is not JSONL", () => {
    withTempDir((dir) => {
      const file = path.join(dir, "bad.jsonl");
      fs.writeFileSync(file, "not json\n");
      assert.equal(readJsonLines(file), null);
      assert.equal(readJsonLines(path.join(dir, "none.jsonl")), null);
    });
  });
});

describe("nodeCommand", () => {
  it("quotes every word so a path with a space survives the shell", () => {
    const command = nodeCommand("/a b/capture.cjs", "out.jsonl");
    assert.equal(command, `${JSON.stringify(process.execPath)} "/a b/capture.cjs" "out.jsonl"`);
  });
});

describe("cleanEnv", () => {
  it("drops GIT_ variables and the named prefixes, and keeps the rest", () => {
    process.env.GIT_DIR = "/x";
    process.env.OPENCODE_PROBE = "1";
    process.env.KEPT_PROBE = "1";
    try {
      const env = cleanEnv(["OPENCODE"]);
      assert.equal(env.GIT_DIR, undefined);
      assert.equal(env.OPENCODE_PROBE, undefined);
      assert.equal(env.KEPT_PROBE, "1");
    } finally {
      delete process.env.GIT_DIR;
      delete process.env.OPENCODE_PROBE;
      delete process.env.KEPT_PROBE;
    }
  });
});

describe("createSandbox", () => {
  it("makes a project that is its own git repository, whatever GIT_DIR the caller holds", () => {
    process.env.GIT_DIR = path.join(os.tmpdir(), "not-a-repo");
    const sandbox = createSandbox("hook-sandbox-", cleanEnv());
    try {
      assert.ok(fs.existsSync(path.join(sandbox.project, ".git")));
      assert.ok(fs.existsSync(sandbox.witness));
    } finally {
      delete process.env.GIT_DIR;
      fs.rmSync(sandbox.root, { recursive: true, force: true });
    }
  });

  it("holds a capture hook that records the event, the payload and the session variable", () => {
    const sandbox = createSandbox("hook-sandbox-", cleanEnv());
    try {
      const out = path.join(sandbox.root, "out.jsonl");
      const run = runHeadless(process.execPath, [sandbox.witness, out, "Stop"], {
        cwd: sandbox.project,
        env: { ...cleanEnv(), CLAUDE_CODE_SESSION_ID: "s1" },
        timeout: 10_000,
      });
      assert.equal(run.error, null);
      // Standard input is closed, so the payload is not JSON and is recorded as null.
      assert.deepEqual(readJsonLines(out), [{ event: "Stop", payload: null, env: { CLAUDE_CODE_SESSION_ID: "s1" } }]);
    } finally {
      fs.rmSync(sandbox.root, { recursive: true, force: true });
    }
  });
});

describe("runHeadless", () => {
  it("names why a binary could not run", () => {
    const run = runHeadless(path.join(os.tmpdir(), "no-such-bin"), [], { cwd: os.tmpdir(), env: {}, timeout: 1000 });
    assert.equal(run.error, "ENOENT");
  });

  it("does not call a run stopped by its timeout a failure", () => {
    const run = runHeadless(process.execPath, ["-e", "setTimeout(() => {}, 5000)"], {
      cwd: os.tmpdir(),
      env: cleanEnv(),
      timeout: 200,
    });
    assert.equal(run.error, null);
  });
});
