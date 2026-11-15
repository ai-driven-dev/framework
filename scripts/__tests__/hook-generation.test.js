const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");

const skill = path.resolve(__dirname, "../../plugins/aidd-context/skills/08-hook-generate");
const SCRIPT = "#!/usr/bin/env node\nprocess.exit(0);\n";
const hook = {
  name: "guard-shell",
  runner: "node",
  extension: "cjs",
  script: SCRIPT,
  timeout: 30,
  hosts: {
    claude: { event: "PreToolUse", matcher: "Bash" },
    codex: { event: "PreToolUse", matcher: "Bash" },
    cursor: { event: "beforeShellExecution" },
    copilot: { event: "preToolUse" },
    antigravity: { event: "PreToolUse", matcher: "run_command" },
  },
};
const only = (...tools) => ({ ...hook, hosts: Object.fromEntries(tools.map((tool) => [tool, hook.hosts[tool]])) });
const asFile = (value) => `${JSON.stringify(value, null, 2)}\n`;

const CLAUDE = ".claude/settings.json";
const CODEX = ".codex/hooks.json";
const CURSOR = ".cursor/hooks.json";
const COPILOT = ".github/hooks/guard-shell.json";
const ANTIGRAVITY = ".agents/hooks.json";
const COPIES = [".claude/hooks/guard-shell.cjs", ".codex/hooks/guard-shell.cjs", ".cursor/hooks/guard-shell.cjs", ".github/hooks/guard-shell.cjs", ".agents/hooks/guard-shell.cjs"];

function fixture(t) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "aidd-hook-")));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const project = path.join(dir, "project");
  const installed = path.join(dir, "installed");
  fs.mkdirSync(project);
  fs.cpSync(skill, installed, { recursive: true });
  const script = path.join(installed, "scripts/write-hook.cjs");
  assert.ok(fs.existsSync(script), "installed skill must contain its standalone script");
  const exec = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8", cwd: dir, env: { PATH: "" } });
  function run(request = hook, extra = []) {
    const input = path.join(dir, "input.json");
    fs.writeFileSync(input, JSON.stringify(request));
    return exec("--project", project, "--input", input, ...extra);
  }
  const remove = (name, extra = []) => exec("--project", project, "--remove", name, ...extra);
  const read = (name) => fs.readFileSync(path.join(project, name), "utf8");
  const exists = (name) => fs.existsSync(path.join(project, name));
  function write(name, content) {
    fs.mkdirSync(path.dirname(path.join(project, name)), { recursive: true });
    fs.writeFileSync(path.join(project, name), content);
  }
  return { dir, project, exec, run, remove, read, exists, write };
}

const json = (r) => JSON.parse(r.stdout);
const operations = (r) => json(r).changes.map((change) => `${change.operation} ${change.path}`);

test("writes each host's native entry and its own copy of the script", (t) => {
  const { run, read } = fixture(t);
  const r = run();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const grouped = (command) => ({ hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command, timeout: 30 }] }] } });
  assert.equal(read(CLAUDE), asFile(grouped('node "$CLAUDE_PROJECT_DIR"/.claude/hooks/guard-shell.cjs claude')));
  assert.equal(read(CODEX), asFile(grouped('node "$(git rev-parse --show-toplevel)/.codex/hooks/guard-shell.cjs" codex')));
  assert.equal(read(CURSOR), asFile({ version: 1, hooks: { beforeShellExecution: [{ command: 'node "$CURSOR_PROJECT_DIR"/.cursor/hooks/guard-shell.cjs cursor', timeout: 30 }] } }));
  assert.equal(read(COPILOT), asFile({ version: 1, hooks: { preToolUse: [{ type: "command", bash: "node .github/hooks/guard-shell.cjs copilot", cwd: ".", timeoutSec: 30 }] } }));
  assert.equal(read(ANTIGRAVITY), asFile({ "guard-shell": { PreToolUse: [{ matcher: "run_command", hooks: [{ type: "command", command: "node hooks/guard-shell.cjs antigravity", timeout: 30 }] }] } }));
  for (const copy of COPIES) assert.equal(read(copy), SCRIPT);
  assert.deepEqual(operations(r), [CLAUDE, ".claude/hooks/guard-shell.cjs", CODEX, ".codex/hooks/guard-shell.cjs", CURSOR, ".cursor/hooks/guard-shell.cjs", COPILOT, ".github/hooks/guard-shell.cjs", ANTIGRAVITY, ".agents/hooks/guard-shell.cjs"].map((file) => `create ${file}`));
});

test("an event without a matcher takes its handlers directly on Antigravity", (t) => {
  const { run, read } = fixture(t);
  const r = run({ ...hook, hosts: { antigravity: { event: "Stop" } } });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(JSON.parse(read(ANTIGRAVITY)), { "guard-shell": { Stop: [{ type: "command", command: "node hooks/guard-shell.cjs antigravity", timeout: 30 }] } });
});

test("rewriting the same hook changes nothing", (t) => {
  const { run } = fixture(t);
  assert.equal(run().status, 0);
  const again = run();
  assert.equal(again.status, 0, again.stdout);
  assert.ok(json(again).changes.every((change) => change.operation === "unchanged"), again.stdout);
});

test("keeps every neighbour entry, on write and on removal", (t) => {
  const { run, remove, read, write } = fixture(t);
  const foreign = { type: "command", command: "echo mine", timeout: 5 };
  const claude = { permissions: { allow: ["Bash(ls)"] }, hooks: { PreToolUse: [{ matcher: "Bash", hooks: [foreign] }], Stop: [{ hooks: [foreign] }] } };
  const cursor = { version: 1, hooks: { stop: [{ command: "echo mine" }] } };
  const antigravity = { "other-hook": { Stop: [foreign] } };
  write(CLAUDE, asFile(claude));
  write(CURSOR, asFile(cursor));
  write(ANTIGRAVITY, asFile(antigravity));
  const r = run();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const written = JSON.parse(read(CLAUDE));
  assert.deepEqual(written.permissions, claude.permissions);
  assert.deepEqual(written.hooks.Stop, claude.hooks.Stop);
  assert.deepEqual(written.hooks.PreToolUse[0], claude.hooks.PreToolUse[0]);
  assert.equal(written.hooks.PreToolUse.length, 2);
  assert.deepEqual(JSON.parse(read(CURSOR)).hooks.stop, cursor.hooks.stop);
  assert.deepEqual(JSON.parse(read(ANTIGRAVITY))["other-hook"], antigravity["other-hook"]);
  assert.equal(remove("guard-shell").status, 0);
  assert.equal(read(CLAUDE), asFile(claude));
  assert.equal(read(CURSOR), asFile(cursor));
  assert.equal(read(ANTIGRAVITY), asFile(antigravity));
});

test("keeps a neighbour handler merged by hand into its group", (t) => {
  const { run, remove, read, write } = fixture(t);
  assert.equal(run(only("claude")).status, 0);
  const settings = JSON.parse(read(CLAUDE));
  const foreign = { type: "command", command: "echo mine" };
  settings.hooks.PreToolUse[0].hooks.push(foreign);
  write(CLAUDE, asFile(settings));
  assert.equal(remove("guard-shell").status, 0);
  assert.deepEqual(JSON.parse(read(CLAUDE)), { hooks: { PreToolUse: [{ matcher: "Bash", hooks: [foreign] }] } });
});

test("plan writes nothing and names each operation", (t) => {
  const { run, project } = fixture(t);
  const r = run(only("claude"), ["--plan"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(operations(r), [`create ${CLAUDE}`, "create .claude/hooks/guard-shell.cjs"]);
  assert.deepEqual(fs.readdirSync(project), []);
  run(only("claude"));
  assert.deepEqual(operations(run(only("claude"), ["--plan"])), [`unchanged ${CLAUDE}`, "unchanged .claude/hooks/guard-shell.cjs"]);
  const moved = { ...only("claude"), hosts: { claude: { event: "PostToolUse", matcher: "Edit" } } };
  assert.deepEqual(operations(run(moved, ["--plan"])), [`update ${CLAUDE}`, "unchanged .claude/hooks/guard-shell.cjs"]);
});

test("refuses to change its own entry or a hand-edited copy without --force", (t) => {
  const { run, read, write } = fixture(t);
  assert.equal(run(only("claude", "copilot")).status, 0);
  const before = read(CLAUDE);
  const moved = { ...only("claude"), hosts: { claude: { event: "PostToolUse", matcher: "Edit" } } };
  const entry = run(moved);
  assert.equal(entry.status, 1);
  assert.match(json(entry).error.message, /\.claude\/settings\.json/);
  assert.equal(read(CLAUDE), before);
  write(".github/hooks/guard-shell.cjs", "edited by hand\n");
  const copy = run(only("claude", "copilot"));
  assert.equal(copy.status, 1);
  assert.match(json(copy).error.message, /\.github\/hooks\/guard-shell\.cjs/);
  assert.equal(read(".github/hooks/guard-shell.cjs"), "edited by hand\n");
  assert.equal(run(only("claude", "copilot"), ["--force"]).status, 0);
  assert.equal(read(".github/hooks/guard-shell.cjs"), SCRIPT);
});

test("refuses a Copilot file or an Antigravity key it did not write, unless forced", (t) => {
  const { run, read, write } = fixture(t);
  write(COPILOT, asFile({ version: 1, hooks: { sessionStart: [{ type: "command", bash: "echo theirs" }] } }));
  write(ANTIGRAVITY, asFile({ "guard-shell": { Stop: [{ type: "command", command: "echo theirs" }] } }));
  for (const tool of ["copilot", "antigravity"]) {
    const r = run(only(tool));
    assert.equal(r.status, 1, r.stdout);
    assert.equal(json(r).error.code, "REFUSED");
  }
  assert.match(read(COPILOT), /echo theirs/);
  assert.match(read(ANTIGRAVITY), /echo theirs/);
});

test("refuses an invalid hook and writes nothing", (t) => {
  const { run, project } = fixture(t);
  for (const bad of [
    { ...hook, name: "Guard Shell" },
    { ...hook, runner: "node --inspect" },
    { ...hook, extension: "json" },
    { ...hook, extension: "c.js" },
    { ...hook, script: " " },
    { ...hook, timeout: 0 },
    { ...hook, timeout: 1.5 },
    { ...hook, hosts: {} },
    { ...hook, hosts: { kiro: { event: "PreToolUse" } } },
    { ...hook, hosts: { claude: { event: "preToolUse" } } },
    { ...hook, hosts: { copilot: { event: "preToolUse", matcher: "bash" } } },
    { ...hook, hosts: { claude: { event: "Stop", matcher: "Bash" } } },
    { ...hook, hosts: { claude: { event: "PreToolUse", matcher: "" } } },
  ]) {
    const r = run(bad);
    assert.equal(r.status, 1, JSON.stringify(bad));
    assert.equal(json(r).error.code, "REFUSED");
  }
  assert.deepEqual(fs.readdirSync(project), []);
});

test("names the host whose event is unknown", (t) => {
  const { run } = fixture(t);
  const r = run({ ...hook, hosts: { codex: { event: "beforeShellExecution" } } });
  assert.equal(r.status, 1);
  assert.match(json(r).error.message, /codex/);
});

test("rejects bad usage with exit 2", (t) => {
  const { exec, run, project } = fixture(t);
  assert.equal(exec("--input", "x.json").status, 2);
  assert.equal(exec("--project", project).status, 2);
  assert.equal(exec("--project", project, "--input", "x.json", "--remove", "guard-shell").status, 2);
  assert.equal(run(hook, ["--bogus"]).status, 2);
  assert.equal(run(hook, ["--plan", "--plan"]).status, 2);
  assert.deepEqual(fs.readdirSync(project), []);
});

test("refuses a relative project, a symlink on the way and an unreadable config", (t) => {
  const { exec, run, dir, project, write, read } = fixture(t);
  run(hook, ["--plan"]);
  const relative = exec("--project", "project", "--input", "input.json");
  assert.equal(relative.status, 1);
  assert.match(json(relative).error.message, /absolute/);
  const outside = path.join(dir, "outside");
  fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(project, ".claude"));
  assert.equal(run(only("claude")).status, 1);
  assert.deepEqual(fs.readdirSync(outside), []);
  write(CURSOR, "{ not json");
  const broken = run(only("cursor"));
  assert.equal(broken.status, 1);
  assert.match(json(broken).error.message, /\.cursor\/hooks\.json/);
  assert.equal(read(CURSOR), "{ not json");
});

test("exits 3 before writing anything when one target cannot be written", (t) => {
  const { run, write, exists } = fixture(t);
  write(".codex", "not a directory");
  const r = run(only("claude", "codex"));
  assert.equal(r.status, 3, r.stdout);
  assert.ok(json(r).error.code);
  assert.equal(exists(CLAUDE), false);
});

test("a project checked out with CRLF line endings reads as its own output", (t) => {
  const { run, read, write } = fixture(t);
  assert.equal(run().status, 0);
  for (const name of json(run(hook, ["--plan"])).changes.map((change) => change.path)) write(name, read(name).replace(/\n/g, "\r\n"));
  const again = run(hook, ["--plan"]);
  assert.equal(again.status, 0, again.stdout);
  assert.ok(json(again).changes.every((change) => change.operation === "unchanged"), again.stdout);
});

test("remove deletes every entry, the Copilot file, the copies and a config left empty", (t) => {
  const { run, remove, project, exists } = fixture(t);
  assert.equal(run().status, 0);
  const planned = remove("guard-shell", ["--plan"]);
  assert.equal(planned.status, 0, planned.stdout);
  assert.deepEqual(operations(planned), [CLAUDE, ".claude/hooks/guard-shell.cjs", CODEX, ".codex/hooks/guard-shell.cjs", CURSOR, ".cursor/hooks/guard-shell.cjs", COPILOT, ".github/hooks/guard-shell.cjs", ANTIGRAVITY, ".agents/hooks/guard-shell.cjs"].map((file) => `delete ${file}`));
  assert.ok(exists(CLAUDE));
  const r = remove("guard-shell");
  assert.equal(r.status, 0, r.stdout);
  for (const file of [CLAUDE, CODEX, CURSOR, COPILOT, ANTIGRAVITY, ...COPIES]) assert.equal(exists(file), false, file);
  assert.deepEqual(json(remove("guard-shell")).changes, []);
  assert.equal(remove("Guard Shell").status, 1);
  assert.ok(fs.readdirSync(project).every((entry) => fs.statSync(path.join(project, entry)).isDirectory()));
});
