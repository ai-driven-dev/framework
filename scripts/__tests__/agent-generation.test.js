const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");

const skill = path.resolve(__dirname, "../../plugins/aidd-context/skills/06-agent-generate");
const ALL = "claude,cursor,copilot,antigravity,codex,opencode,kilo";
const agent = {
  name: "code-reviewer",
  description: "Reviews a diff for defects. Use to check a change before merge.",
  model: "sonnet",
  effort: "high",
  tools: "Read, Grep",
  color: "blue",
  body: "# Role\n\nReview the diff.\n",
};

function fixture(t) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "aidd-agent-")));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const project = path.join(dir, "project");
  const installed = path.join(dir, "installed");
  fs.mkdirSync(project);
  fs.cpSync(skill, installed, { recursive: true });
  const script = path.join(installed, "scripts/write-agent.cjs");
  assert.ok(fs.existsSync(script), "installed skill must contain its standalone script");
  const exec = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8", cwd: dir, env: { PATH: "" } });
  function run(request = agent, tools = ALL, extra = []) {
    const input = path.join(dir, "input.json");
    fs.writeFileSync(input, JSON.stringify(request));
    return exec("--project", project, "--tools", tools, "--input", input, ...extra);
  }
  const read = (name) => fs.readFileSync(path.join(project, name), "utf8");
  return { dir, project, exec, run, read };
}

const json = (r) => JSON.parse(r.stdout);

test("renders each host's native file from the CLI mapping", (t) => {
  const { run, read } = fixture(t);
  const r = run();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const body = "# Role\n\nReview the diff.\n";
  const desc = "Reviews a diff for defects. Use to check a change before merge.";
  assert.equal(read(".claude/agents/code-reviewer.md"), `---\nname: code-reviewer\ndescription: ${desc}\nmodel: sonnet\neffort: high\ntools: Read, Grep\n---\n\n${body}`);
  assert.equal(read(".cursor/agents/code-reviewer.md"), `---\nname: code-reviewer\ndescription: ${desc}\nmodel: "sonnet[effort=high]"\n---\n\n${body}`);
  assert.equal(read(".opencode/agents/code-reviewer.md"), `---\ndescription: ${desc}\nmodel: "sonnet#high"\nmode: subagent\n---\n\n${body}`);
  assert.equal(read(".kilo/agents/code-reviewer.md"), `---\ndescription: ${desc}\nmodel: sonnet\nvariant: high\nmode: subagent\n---\n\n${body}`);
  assert.equal(read(".github/agents/code-reviewer.agent.md"), `---\nname: code-reviewer\ndescription: ${desc}\nmodel: sonnet\nreasoningEffort: high\ninclude-custom-instructions: true\n---\n\n${body}`);
  assert.equal(read(".agents/agents/code-reviewer/agent.md"), `---\nname: code-reviewer\ndescription: ${desc}\nmodel: inherit\ntools:\n  - Read\n  - Grep\n---\n\n${body}`);
  assert.equal(read(".codex/agents/code-reviewer.toml"), `name = "code-reviewer"\ndescription = "${desc}"\nmodel = "sonnet"\nmodel_reasoning_effort = "high"\ndeveloper_instructions = '''\n${body}'''\n`);
});

test("reports every field a host drops", (t) => {
  const { run } = fixture(t);
  const r = run(agent, "claude,antigravity");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(json(r).dropped, [
    { tool: "claude", field: "color" },
    { tool: "antigravity", field: "model" },
    { tool: "antigravity", field: "effort" },
    { tool: "antigravity", field: "color" },
  ]);
});

test("a minimal agent carries only name and description", (t) => {
  const { run, read } = fixture(t);
  const r = run({ name: "scout", description: "Finds files. Use to locate code.", body: "Find it.\n" }, "claude,copilot");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(read(".claude/agents/scout.md"), "---\nname: scout\ndescription: Finds files. Use to locate code.\n---\n\nFind it.\n");
  assert.equal(read(".github/agents/scout.agent.md"), "---\nname: scout\ndescription: Finds files. Use to locate code.\ninclude-custom-instructions: true\n---\n\nFind it.\n");
  assert.deepEqual(json(r).dropped, []);
});

test("quotes a value YAML would misread, with double quotes", (t) => {
  const { run, read } = fixture(t);
  const r = run({ name: "scout", description: "Finds files: fast. Use to locate code.", body: "x\n" }, "cursor");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(read(".cursor/agents/scout.md"), /^description: "Finds files: fast\. Use to locate code\."$/m);
});

test("escapes a TOML string and keeps a body without a trailing newline", (t) => {
  const { run, read } = fixture(t);
  const r = run({ name: "scout", description: 'Says "hi" \\ there. Use to greet.', body: "Line" }, "codex");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(read(".codex/agents/scout.toml"), `name = "scout"\ndescription = "Says \\"hi\\" \\\\ there. Use to greet."\ndeveloper_instructions = '''\nLine'''\n`);
});

test("plan writes nothing and names each operation", (t) => {
  const { run, project } = fixture(t);
  const r = run(agent, "claude", ["--plan"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(json(r).files, [{ path: ".claude/agents/code-reviewer.md", operation: "create" }]);
  assert.deepEqual(fs.readdirSync(project), []);
  run(agent, "claude");
  assert.deepEqual(json(run(agent, "claude", ["--plan"])).files, [{ path: ".claude/agents/code-reviewer.md", operation: "unchanged" }]);
  assert.deepEqual(json(run({ ...agent, model: "opus" }, "claude", ["--plan"])).files, [{ path: ".claude/agents/code-reviewer.md", operation: "update" }]);
});

test("check fails on drift and passes once written", (t) => {
  const { run, project } = fixture(t);
  run();
  assert.equal(run(agent, ALL, ["--check"]).status, 0);
  fs.appendFileSync(path.join(project, ".kilo/agents/code-reviewer.md"), "edited\n");
  const r = run(agent, ALL, ["--check"]);
  assert.equal(r.status, 1);
  assert.deepEqual(json(r).drift, [".kilo/agents/code-reviewer.md"]);
});

test("refuses an invalid agent and writes nothing", (t) => {
  const { run, project } = fixture(t);
  for (const bad of [
    { ...agent, name: "Code Reviewer" },
    { ...agent, description: "" },
    { ...agent, description: "two\nlines" },
    { ...agent, body: " " },
    { ...agent, body: "has ''' inside" },
    { ...agent, model: 3 },
  ]) {
    const r = run(bad);
    assert.equal(r.status, 1, JSON.stringify(bad));
    assert.equal(json(r).error.code, "REFUSED");
  }
  assert.deepEqual(fs.readdirSync(project), []);
});

test("rejects bad usage with exit 2", (t) => {
  const { exec, run, project } = fixture(t);
  assert.equal(exec("--tools", "claude").status, 2);
  assert.equal(exec("--project", project, "--input", "x.json").status, 2);
  assert.equal(run(agent, "claude", ["--plan", "--check"]).status, 2);
  assert.equal(run(agent, "claude", ["--bogus"]).status, 2);
  const unknown = run(agent, "claude,vim");
  assert.equal(unknown.status, 1);
  assert.equal(json(unknown).error.code, "REFUSED");
});

test("refuses a relative project and a symlink on the way to a target", (t) => {
  const { exec, run, dir, project } = fixture(t);
  assert.equal(exec("--project", "project", "--tools", "claude", "--input", "input.json").status, 1);
  const outside = path.join(dir, "outside");
  fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(project, ".claude"));
  const r = run(agent, "claude");
  assert.equal(r.status, 1);
  assert.deepEqual(fs.readdirSync(outside), []);
});

test("exits 3 when a target cannot be written", (t) => {
  const { run, project } = fixture(t);
  fs.writeFileSync(path.join(project, ".codex"), "not a directory");
  const r = run(agent, "codex");
  assert.equal(r.status, 3);
  assert.ok(json(r).error.code);
});
