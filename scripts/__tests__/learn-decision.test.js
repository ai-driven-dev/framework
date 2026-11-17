const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");

const skill = path.resolve(__dirname, "../../plugins/aidd-context/skills/10-learn");
const DEFAULT_DIR = "aidd_docs/memory/internal/decisions";
const decision = {
  title: "Use pnpm for every package",
  date: "2030-01-02",
  context: "Two package managers produced two lockfiles.",
  decision: "Every package installs with pnpm.",
  alternatives: "npm: slower installs, no workspace protocol.",
  consequences: "Contributors need pnpm on their machine.",
};

function fixture(t) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "aidd-learn-")));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const project = path.join(dir, "project");
  const installed = path.join(dir, "installed");
  fs.mkdirSync(project);
  fs.cpSync(skill, installed, { recursive: true });
  const script = path.join(installed, "scripts/write-decision.cjs");
  assert.ok(fs.existsSync(script), "installed skill must contain its standalone script");
  const exec = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8", cwd: dir, env: { PATH: "" } });
  function run(request = decision, extra = []) {
    const input = path.join(dir, "input.json");
    fs.writeFileSync(input, JSON.stringify(request));
    return exec("--project", project, "--input", input, ...extra);
  }
  const file = (rel) => path.join(project, rel);
  const read = (rel) => fs.readFileSync(file(rel), "utf8");
  const write = (rel, text) => {
    fs.mkdirSync(path.dirname(file(rel)), { recursive: true });
    fs.writeFileSync(file(rel), text);
  };
  return { project, exec, run, read, write, file };
}

const json = (r) => JSON.parse(r.stdout);
const created = `${DEFAULT_DIR}/use-pnpm-for-every-package.md`;

test("writes a new decision record in the default folder, named after its title", (t) => {
  const { run, read } = fixture(t);
  const r = run();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(json(r).operations, [{ path: created, op: "create" }]);
  const adr = read(created);
  assert.match(adr, /^# Use pnpm for every package\n/);
  assert.match(adr, /^- Date: 2030-01-02$/m);
  assert.match(adr, /^- Status: Accepted$/m);
  assert.match(adr, /## Context\n\nTwo package managers produced two lockfiles\.\n/);
  assert.match(adr, /## Decision\n\nEvery package installs with pnpm\.\n/);
  assert.match(adr, /## Alternatives\n\nnpm: slower installs, no workspace protocol\.\n/);
  assert.match(adr, /## Consequences\n\nContributors need pnpm on their machine\.\n/);
  assert.doesNotMatch(adr, /Supersede|[<>]/);
});

test("writes into the decision folder the project already has", (t) => {
  const { run, write, file } = fixture(t);
  write("docs/adr/old-choice.md", "# Old choice\n");
  const r = run();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(fs.existsSync(file("docs/adr/use-pnpm-for-every-package.md")));
  assert.ok(!fs.existsSync(file(created)));
});

test("refuses a name already taken and leaves that record untouched", (t) => {
  const { run, write, read } = fixture(t);
  write(created, "# Someone else's record\n");
  const r = run();
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.equal(read(created), "# Someone else's record\n");
});

test("plan names each operation and writes nothing", (t) => {
  const { run, write, file, read } = fixture(t);
  const old = `${DEFAULT_DIR}/use-npm.md`;
  write(old, "# Use npm\n\n- Date: 2029-01-01\n- Status: Accepted\n\n## Decision\n\nnpm.\n");
  const r = run(decision, ["--plan", "--supersedes", old]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(json(r).operations, [
    { path: created, op: "create" },
    { path: old, op: "update" },
  ]);
  assert.ok(!fs.existsSync(file(created)));
  assert.match(read(old), /- Status: Accepted/);
});

test("a superseding record and the one it replaces point at each other", (t) => {
  const { run, write, read } = fixture(t);
  const old = `${DEFAULT_DIR}/use-npm.md`;
  write(old, "# Use npm\n\n- Date: 2029-01-01\n- Status: Accepted\n\n## Decision\n\nnpm.\n");
  const r = run(decision, ["--supersedes", old]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(read(created), /^- Supersedes: use-npm\.md$/m);
  const replaced = read(old);
  assert.match(replaced, /^- Status: Superseded$/m);
  assert.match(replaced, /^- Superseded by: use-pnpm-for-every-package\.md$/m);
  assert.match(replaced, /## Decision\n\nnpm\.\n/);
});

test("refuses to supersede a record that does not exist, writing nothing", (t) => {
  const { run, file } = fixture(t);
  const r = run(decision, ["--supersedes", `${DEFAULT_DIR}/missing.md`]);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(json(r).error.message, /does not exist/);
  assert.ok(!fs.existsSync(file(created)));
});

test("refuses a record missing a section, writing nothing", (t) => {
  const { run, file } = fixture(t);
  const { consequences, ...partial } = decision;
  const r = run(partial);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.ok(!fs.existsSync(file(created)));
});

test("rejects bad usage with exit 2", (t) => {
  const { exec, run } = fixture(t);
  assert.equal(exec("--input", "x.json").status, 2);
  assert.equal(exec("--project", "relative", "--input", "x.json").status, 2);
  assert.equal(run(decision, ["--unknown"]).status, 2);
});
