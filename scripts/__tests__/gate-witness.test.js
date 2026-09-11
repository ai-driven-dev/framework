const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
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

function gate(r, script, name = "suite") {
  return spawnSync(process.execPath, [WITNESS, name, "--", process.execPath, "-e", script, r.runs], {
    cwd: r.dir,
    env: CLEAN_ENV,
    encoding: "utf8",
  });
}

const COUNT = "require('fs').appendFileSync(process.argv[1], 'x')";
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
  const editsOnItsFirstRun = `${COUNT}; if (require('fs').readFileSync(process.argv[1], 'utf8') === 'x') require('fs').writeFileSync('a.txt', 'edited during the run')`;
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
