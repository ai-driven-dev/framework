const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const WITNESS = path.resolve(__dirname, "../gate-witness.js");
const CLEAN_ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));

function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gate-witness-"));
  const git = (...args) => execFileSync("git", args, { cwd: dir, env: CLEAN_ENV, stdio: "pipe" });
  git("init", "-q");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  fs.writeFileSync(path.join(dir, "a.txt"), "a\n");
  fs.writeFileSync(path.join(dir, "b.txt"), "b\n");
  git("add", "-A");
  git("commit", "-q", "-m", "init");
  const runs = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gate-witness-runs-")), "count");
  fs.writeFileSync(runs, "");
  return { dir, git, runs };
}

function witness(r, commandLine, name = "suite") {
  return spawnSync(process.execPath, [WITNESS, name, "--", commandLine], { cwd: r.dir, env: CLEAN_ENV, encoding: "utf8" });
}

function commandLine(r, script) {
  const file = path.join(path.dirname(r.runs), `${createHash("sha256").update(script).digest("hex")}.js`);
  fs.writeFileSync(file, script);
  return [process.execPath, file, r.runs].map((part) => `"${part}"`).join(" ");
}

const gate = (r, script, name) => witness(r, commandLine(r, script), name);

const COUNT = "require('fs').appendFileSync(process.argv[2], 'x')";
const runsOf = (r) => fs.readFileSync(r.runs, "utf8").length;

test("skips a gate on a tree that already passed it, and says so", () => {
  const r = repo();
  assert.equal(gate(r, COUNT).status, 0);
  const second = gate(r, COUNT);
  assert.equal(second.status, 0);
  assert.equal(runsOf(r), 1);
  assert.match(second.stdout + second.stderr, /already passed/);
});

test("runs again after a tracked file changes, staged or not", () => {
  const r = repo();
  gate(r, COUNT);
  fs.writeFileSync(path.join(r.dir, "a.txt"), "a changed\n");
  gate(r, COUNT);
  r.git("add", "a.txt");
  fs.writeFileSync(path.join(r.dir, "a.txt"), "a changed\n");
  gate(r, COUNT);
  assert.equal(runsOf(r), 3);
});

test("runs again after a file is added, left untracked, or removed", () => {
  const r = repo();
  gate(r, COUNT);
  fs.writeFileSync(path.join(r.dir, "new.txt"), "new\n");
  gate(r, COUNT);
  r.git("add", "new.txt");
  gate(r, COUNT);
  r.git("rm", "-q", "b.txt");
  gate(r, COUNT);
  assert.equal(runsOf(r), 4);
});

test("stamps nothing when the tree changed while the gate ran, even once it changes back", () => {
  const r = repo();
  const editsOnItsFirstRun = `${COUNT}; if (require('fs').readFileSync(process.argv[2], 'utf8') === 'x') require('fs').writeFileSync('a.txt', 'edited during the run')`;
  assert.equal(gate(r, editsOnItsFirstRun).status, 0);
  fs.writeFileSync(path.join(r.dir, "a.txt"), "a\n");
  gate(r, editsOnItsFirstRun);
  assert.equal(runsOf(r), 2);
});

test("passes a failure through and stamps nothing", () => {
  const r = repo();
  assert.equal(gate(r, `${COUNT}; process.exit(3)`).status, 3);
  gate(r, COUNT);
  assert.equal(runsOf(r), 2);
});

test("keeps one stamp per gate, so another gate still runs", () => {
  const r = repo();
  gate(r, COUNT, "knip");
  gate(r, COUNT, "suite");
  assert.equal(runsOf(r), 2);
});

test("runs what follows -- as one shell command line, on every platform", () => {
  const r = repo();
  const count = commandLine(r, COUNT);
  assert.equal(witness(r, `${count} && ${count}`).status, 0);
  assert.equal(runsOf(r), 2);
});

test("does not pass a hook's Git environment to the gate", () => {
  const r = repo();
  const script = `const { execFileSync } = require('node:child_process');
    const path = require('node:path');
    const target = path.join(path.dirname(process.argv[2]), 'isolated.git');
    execFileSync('git', ['init', '--bare', '--quiet', target]);
    if (process.env.GIT_DIR || process.env.GIT_INDEX_FILE || process.env.GIT_SSH_COMMAND !== 'preserved') process.exit(3);`;
  const result = spawnSync(process.execPath, [WITNESS, "suite", "--", commandLine(r, script)], {
    cwd: r.dir,
    env: { ...CLEAN_ENV, GIT_DIR: path.join(r.dir, ".git"), GIT_INDEX_FILE: path.join(r.dir, ".git", "index"), GIT_SSH_COMMAND: "preserved" },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(r.git("config", "--bool", "core.bare").toString().trim(), "false");
});
