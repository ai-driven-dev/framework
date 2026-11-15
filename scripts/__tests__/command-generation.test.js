const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");

const skill = path.resolve(__dirname, "../../plugins/aidd-context/skills/07-command-generate");
const ALL = "claude,cursor,copilot,opencode,kilo";
const command = {
  name: "ship-release",
  description: "Cuts a release from the current branch.",
  "argument-hint": "version",
  model: "sonnet",
  agent: "build",
  body: "# Ship release\n\nTag version $ARGUMENTS.\n",
};

function fixture(t, fault) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "aidd-command-")));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const project = path.join(dir, "project");
  const installed = path.join(dir, "installed");
  fs.mkdirSync(project);
  fs.cpSync(skill, installed, { recursive: true });
  const script = path.join(installed, "scripts/write-command.cjs");
  assert.ok(fs.existsSync(script), "installed skill must contain its standalone script");
  const exec = (...args) => spawnSync(process.execPath, [...(fault ? ["--require", fault] : []), script, ...args], { encoding: "utf8", cwd: dir, env: { PATH: "" } });
  function run(request = command, tools = ALL, extra = []) {
    const input = path.join(dir, "input.json");
    fs.writeFileSync(input, JSON.stringify(request));
    return exec("--project", project, "--tools", tools, "--input", input, ...extra);
  }
  const read = (name) => fs.readFileSync(path.join(project, name), "utf8");
  return { dir, project, exec, run, read };
}

const json = (r) => JSON.parse(r.stdout);

test("renders each host's native command file", (t) => {
  const { run, read } = fixture(t);
  const r = run();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const desc = "Cuts a release from the current branch.";
  assert.equal(read(".claude/commands/ship-release.md"), `---\ndescription: ${desc}\nargument-hint: version\nmodel: sonnet\n---\n\n# Ship release\n\nTag version $ARGUMENTS.\n`);
  assert.equal(read(".cursor/commands/ship-release.md"), "# Ship release\n\nTag version $ARGUMENTS.\n");
  assert.equal(read(".github/prompts/ship-release.prompt.md"), `---\ndescription: ${desc}\nargument-hint: version\nagent: build\nmodel: sonnet\n---\n\n# Ship release\n\nTag version $ARGUMENTS.\n`);
  assert.equal(read(".opencode/commands/ship-release.md"), `---\ndescription: ${desc}\nagent: build\nmodel: sonnet\n---\n\n# Ship release\n\nTag version $ARGUMENTS.\n`);
  assert.equal(read(".kilo/commands/ship-release.md"), `---\ndescription: ${desc}\nagent: build\nmodel: sonnet\n---\n\n# Ship release\n\nTag version $ARGUMENTS.\n`);
});

test("reports every field a host drops", (t) => {
  const { run } = fixture(t);
  const r = run({ ...command, "allowed-tools": "Bash(git tag:*)", "disable-model-invocation": true }, "claude,cursor,opencode");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(json(r).dropped, [
    { tool: "claude", field: "agent" },
    { tool: "cursor", field: "description" },
    { tool: "cursor", field: "argument-hint" },
    { tool: "cursor", field: "model" },
    { tool: "cursor", field: "agent" },
    { tool: "cursor", field: "allowed-tools" },
    { tool: "cursor", field: "disable-model-invocation" },
    { tool: "opencode", field: "argument-hint" },
    { tool: "opencode", field: "allowed-tools" },
    { tool: "opencode", field: "disable-model-invocation" },
  ]);
});

test("keeps the Claude-only keys of an existing command", (t) => {
  const { run, read } = fixture(t);
  const r = run({ name: "status", description: "Shows the repository status.", "allowed-tools": "Bash(git status:*)", "disable-model-invocation": true, body: "!`git status`\n" }, "claude");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(read(".claude/commands/status.md"), "---\ndescription: Shows the repository status.\nallowed-tools: \"Bash(git status:*)\"\ndisable-model-invocation: true\n---\n\n!`git status`\n");
  assert.deepEqual(json(r).dropped, []);
});

test("quotes a value YAML would misread, with double quotes", (t) => {
  const { run, read } = fixture(t);
  const r = run({ name: "scout", description: "Finds files: fast.", body: "x\n" }, "opencode");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(read(".opencode/commands/scout.md"), /^description: "Finds files: fast\."$/m);
});

test("plan writes nothing and names each operation", (t) => {
  const { run, project } = fixture(t);
  const r = run(command, "claude", ["--plan"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(json(r).files, [{ path: ".claude/commands/ship-release.md", operation: "create" }]);
  assert.deepEqual(fs.readdirSync(project), []);
  run(command, "claude");
  assert.deepEqual(json(run(command, "claude", ["--plan"])).files, [{ path: ".claude/commands/ship-release.md", operation: "unchanged" }]);
  assert.deepEqual(json(run({ ...command, model: "opus" }, "claude", ["--plan"])).files, [{ path: ".claude/commands/ship-release.md", operation: "update" }]);
});

test("check fails on drift and passes once written", (t) => {
  const { run, project } = fixture(t);
  run();
  assert.equal(run(command, ALL, ["--check"]).status, 0);
  fs.appendFileSync(path.join(project, ".kilo/commands/ship-release.md"), "edited\n");
  const r = run(command, ALL, ["--check"]);
  assert.equal(r.status, 1);
  assert.deepEqual(json(r).drift, [".kilo/commands/ship-release.md"]);
});

test("refuses an invalid command and writes nothing", (t) => {
  const { run, project } = fixture(t);
  for (const bad of [
    { ...command, name: "Ship Release" },
    { ...command, description: "" },
    { ...command, description: "two\nlines" },
    { ...command, body: " " },
    { ...command, model: 3 },
  ]) {
    const r = run(bad);
    assert.equal(r.status, 1, JSON.stringify(bad));
    assert.equal(json(r).error.code, "REFUSED");
  }
  assert.deepEqual(fs.readdirSync(project), []);
});

test("rejects bad usage with exit 2 and an unknown host with exit 1", (t) => {
  const { exec, run, project } = fixture(t);
  assert.equal(exec("--tools", "claude").status, 2);
  assert.equal(exec("--project", project, "--input", "x.json").status, 2);
  assert.equal(run(command, "claude", ["--plan", "--check"]).status, 2);
  assert.equal(run(command, "claude", ["--bogus"]).status, 2);
  for (const host of ["codex", "antigravity"]) {
    const unknown = run(command, `claude,${host}`);
    assert.equal(unknown.status, 1);
    assert.equal(json(unknown).error.code, "REFUSED");
  }
  assert.deepEqual(fs.readdirSync(project), []);
});

test("refuses a relative project and a symlink on the way to a target", (t) => {
  const { exec, run, dir, project } = fixture(t);
  run(command, "claude", ["--plan"]);
  const relative = exec("--project", "project", "--tools", "claude", "--input", "input.json");
  assert.equal(relative.status, 1);
  assert.match(json(relative).error.message, /absolute/);
  const outside = path.join(dir, "outside");
  fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(project, ".claude"));
  assert.equal(run(command, "claude").status, 1);
  assert.deepEqual(fs.readdirSync(outside), []);
});

test("exits 3 before writing anything when one target cannot be written", (t) => {
  const { run, project } = fixture(t);
  fs.writeFileSync(path.join(project, ".kilo"), "not a directory");
  const r = run(command, "claude,kilo");
  assert.equal(r.status, 3);
  assert.ok(json(r).error.code);
  assert.equal(fs.existsSync(path.join(project, ".claude/commands/ship-release.md")), false);
});

test("refuses to overwrite a differing file without --force", (t) => {
  const { run, read, project } = fixture(t);
  fs.mkdirSync(path.join(project, ".claude/commands"), { recursive: true });
  fs.writeFileSync(path.join(project, ".claude/commands/ship-release.md"), "mine\n");
  const r = run(command, "claude");
  assert.equal(r.status, 1);
  assert.match(json(r).error.message, /\.claude\/commands\/ship-release\.md/);
  assert.equal(read(".claude/commands/ship-release.md"), "mine\n");
  assert.equal(run(command, "claude", ["--force"]).status, 0);
  assert.match(read(".claude/commands/ship-release.md"), /^model: sonnet$/m);
});

test("a write failing midway leaves the existing file whole and no temporary file behind", (t) => {
  const faultDir = fs.mkdtempSync(path.join(os.tmpdir(), "aidd-command-fault-"));
  t.after(() => fs.rmSync(faultDir, { recursive: true, force: true }));
  const fault = path.join(faultDir, "fault.cjs");
  fs.writeFileSync(fault, `const fs = require("node:fs"); const write = fs.writeFileSync;
fs.writeFileSync = (file, ...rest) => { if (String(file).includes("ship-release.md")) { write(file, "-"); throw Object.assign(new Error("injected"), { code: "ENOSPC" }); } return write(file, ...rest); };`);
  const { run, read, project } = fixture(t, fault);
  const dir = path.join(project, ".claude/commands");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "ship-release.md"), "old\n");
  assert.equal(run(command, "claude", ["--force"]).status, 3);
  assert.equal(read(".claude/commands/ship-release.md"), "old\n");
  assert.deepEqual(fs.readdirSync(dir), ["ship-release.md"]);
});
