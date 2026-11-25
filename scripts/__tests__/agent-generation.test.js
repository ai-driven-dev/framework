const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");

const skill = path.resolve(__dirname, "../../plugins/aidd-context/skills/06-agent-generate");
const ALL = "claude,cursor,copilot,antigravity,codex,opencode,kilo,kiro,kimi";
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
  assert.equal(read(".claude/agents/code-reviewer.md"), `---\nname: code-reviewer\ndescription: ${desc}\nmodel: sonnet\neffort: high\ntools: Read, Grep\ncolor: blue\n---\n\n${body}`);
  assert.equal(read(".cursor/agents/code-reviewer.md"), `---\nname: code-reviewer\ndescription: ${desc}\nmodel: "sonnet[effort=high]"\n---\n\n${body}`);
  assert.equal(read(".opencode/agents/code-reviewer.md"), `---\ndescription: ${desc}\nmodel: "sonnet#high"\nmode: subagent\n---\n\n${body}`);
  assert.equal(read(".kilo/agents/code-reviewer.md"), `---\ndescription: ${desc}\nmodel: sonnet\nvariant: high\nmode: subagent\n---\n\n${body}`);
  assert.equal(read(".kiro/agents/code-reviewer.md"), `---\nname: code-reviewer\ndescription: ${desc}\ntools:\n  - "*"\n---\n\n${body}`);
  assert.equal(read(".kimi-code/agents/code-reviewer.md"), `---\nname: code-reviewer\ndescription: ${desc}\ntools:\n  - Read\n  - Grep\n---\n\n${body}`);
  assert.equal(read(".github/agents/code-reviewer.agent.md"), `---\nname: code-reviewer\ndescription: ${desc}\nmodel: sonnet\nreasoningEffort: high\ninclude-custom-instructions: true\n---\n\n${body}`);
  assert.equal(read(".agents/agents/code-reviewer/agent.md"), `---\nname: code-reviewer\ndescription: ${desc}\nmodel: inherit\ntools:\n  - view_file\n  - grep_search\n---\n\n${body}`);
  assert.equal(read(".codex/agents/code-reviewer.toml"), `name = "code-reviewer"\ndescription = "${desc}"\nmodel = "sonnet"\nmodel_reasoning_effort = "high"\ndeveloper_instructions = '''\n${body}'''\n`);
});

test("reports every field a host drops", (t) => {
  const { run } = fixture(t);
  const r = run(agent, "claude,antigravity");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(json(r).dropped, [
    { tool: "antigravity", field: "model" },
    { tool: "antigravity", field: "effort" },
    { tool: "antigravity", field: "color" },
  ]);
});

test("reports what Kiro and Kimi cannot carry", (t) => {
  const { run } = fixture(t);
  const r = run(agent, "kiro,kimi");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(json(r).dropped, [
    { tool: "kiro", field: "model" },
    { tool: "kiro", field: "effort" },
    { tool: "kiro", field: "tools" },
    { tool: "kiro", field: "color" },
    { tool: "kimi", field: "model" },
    { tool: "kimi", field: "effort" },
    { tool: "kimi", field: "color" },
  ]);
});

test("a Kimi agent declaring no tools writes none, and Kiro grants every tool", (t) => {
  const { run, read } = fixture(t);
  const r = run({ name: "scout", description: "Finds files. Use to locate code.", body: "x\n" }, "kiro,kimi");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(read(".kimi-code/agents/scout.md"), "---\nname: scout\ndescription: Finds files. Use to locate code.\n---\n\nx\n");
  assert.equal(read(".kiro/agents/scout.md"), '---\nname: scout\ndescription: Finds files. Use to locate code.\ntools:\n  - "*"\n---\n\nx\n');
});

test("a Kimi agent lists Kimi's own tool names and loses a tool Kimi has no name for", (t) => {
  const { run, read } = fixture(t);
  const r = run({ name: "scout", description: "Finds files. Use to locate code.", tools: "Read, WebFetch, Task, NotebookEdit", body: "x\n" }, "kimi");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(read(".kimi-code/agents/scout.md"), "---\nname: scout\ndescription: Finds files. Use to locate code.\ntools:\n  - Read\n  - FetchURL\n  - Agent\n---\n\nx\n");
});

test("a Kimi agent whose tools none map writes an empty list, never none, and keeps an MCP tool", (t) => {
  const { run, read } = fixture(t);
  const head = "---\nname: nb\ndescription: Edits notebooks. Use to change one.\n";
  const base = { name: "nb", description: "Edits notebooks. Use to change one.", body: "x\n" };
  assert.equal(run({ ...base, tools: "NotebookEdit" }, "kimi").status, 0);
  assert.equal(read(".kimi-code/agents/nb.md"), `${head}tools: []\n---\n\nx\n`);
  assert.equal(run({ ...base, tools: "NotebookEdit, mcp__github__get_issue" }, "kimi", ["--force"]).status, 0);
  assert.equal(read(".kimi-code/agents/nb.md"), `${head}tools:\n  - mcp__github__get_issue\n---\n\nx\n`);
});

test("the Kimi tool table equals the one the CLI's Kimi profile holds", () => {
  const profile = fs.readFileSync(path.resolve(__dirname, "../../cli/src/composition/tool-profiles/kimi.ts"), "utf8");
  const blockMatch = profile.match(/const AGENT_TOOLS[^=]*= new Map\(\[([\s\S]*?)\]\);/);
  assert.ok(blockMatch, "kimi profile AGENT_TOOLS map not found");
  const block = blockMatch[1];
  const pairs = [...block.matchAll(/\["([^"]+)", "([^"]+)"\]/g)].map(([, claude, kimi]) => [claude, kimi]);
  assert.ok(pairs.length > 0);
  assert.deepEqual([...require(path.join(skill, "scripts/write-agent.cjs")).KIMI_TOOLS], pairs);
});

test("the Antigravity tool table equals the one the CLI's Antigravity profile holds", () => {
  const profile = fs.readFileSync(path.resolve(__dirname, "../../cli/src/composition/tool-profiles/antigravity.ts"), "utf8");
  const blockMatch = profile.match(/const AGENT_TOOLS[^=]*= new Map\(\[([\s\S]*?)\]\);/);
  assert.ok(blockMatch, "antigravity profile AGENT_TOOLS map not found");
  const pairs = [...blockMatch[1].matchAll(/\["([^"]+)", "([^"]+)"\]/g)].map(([, claude, agy]) => [claude, agy]);
  assert.ok(pairs.length > 0);
  assert.deepEqual([...require(path.join(skill, "scripts/write-agent.cjs")).ANTIGRAVITY_TOOLS], pairs);
});

test("an Antigravity agent lists agy names, drops a tool with none, and lists every mapped tool when it declares none", (t) => {
  const { run, read } = fixture(t);
  const listed = () => read(".agents/agents/scout/agent.md").match(/tools:\n((?:  - .+\n)+)/)[1].trimEnd().split("\n").map((line) => line.slice(4));
  assert.equal(run({ name: "scout", description: "Finds files. Use to locate code.", tools: "Read, Glob, Bash, mcp__x__y, Read", body: "x\n" }, "antigravity").status, 0);
  assert.deepEqual(listed(), ["view_file", "run_command"]);
  assert.equal(run({ name: "scout", description: "Finds files. Use to locate code.", body: "x\n" }, "antigravity", ["--force"]).status, 0);
  assert.deepEqual(listed(), ["view_file", "grep_search", "replace_file_content", "write_file", "run_command"]);
});

test("a Kimi agent lists the tools the CLI's Kimi build lists for the same declaration", (t) => {
  const built = fs.readFileSync(path.resolve(__dirname, "../../cli/tests/contexts/translate/application/sinks/kimi-flat-build.integration.test.ts"), "utf8");
  const declaredMatch = built.match(/\\ntools: ([^\\]+)\\n---/);
  const expectedMatch = built.match(/frontmatter\.tools\)\.toBe\('(\[.*\])'\)/);
  assert.ok(declaredMatch && expectedMatch, "kimi flat-build fixture shape changed");
  const declared = declaredMatch[1];
  const expected = JSON.parse(expectedMatch[1]);
  const { run, read } = fixture(t);
  assert.equal(run({ name: "tooled", description: "Declares Claude tools.", tools: declared, body: "x\n" }, "kimi").status, 0);
  const written = read(".kimi-code/agents/tooled.md").match(/tools:\n((?:  - .+\n)+)/)[1];
  const items = written.trimEnd().split("\n").map((line) => line.replace(/^ {2}- /, "").replace(/^"(.*)"$/, "$1"));
  assert.deepEqual(items, expected);
});

test("a Kimi agent names a tool once when two Claude tools map to it", (t) => {
  const { run, read } = fixture(t);
  assert.equal(run({ name: "scout", description: "Finds files. Use to locate code.", tools: "Task, Agent", body: "x\n" }, "kimi").status, 0);
  assert.equal(read(".kimi-code/agents/scout.md"), "---\nname: scout\ndescription: Finds files. Use to locate code.\ntools:\n  - Agent\n---\n\nx\n");
});

test("keeps the Claude-only keys of an existing agent", (t) => {
  const { run, read } = fixture(t);
  const r = run({ name: "scout", description: "Finds files. Use to locate code.", permissionMode: "plan", disallowedTools: "Write", body: "x\n" }, "claude");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(read(".claude/agents/scout.md"), "---\nname: scout\ndescription: Finds files. Use to locate code.\npermissionMode: plan\ndisallowedTools: Write\n---\n\nx\n");
  assert.deepEqual(json(r).dropped, []);
});

test("reports an effort a host cannot carry without a model", (t) => {
  const { run } = fixture(t);
  const r = run({ name: "scout", description: "Finds files. Use to locate code.", effort: "high", body: "x\n" }, "cursor,opencode,kilo");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(json(r).dropped, [{ tool: "cursor", field: "effort" }, { tool: "opencode", field: "effort" }]);
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
  assert.equal(run(agent, "claude", ["--check"]).status, 2);
  assert.equal(run(agent, "claude", ["--bogus"]).status, 2);
  const unknown = run(agent, "claude,vim");
  assert.equal(unknown.status, 1);
  assert.equal(json(unknown).error.code, "REFUSED");
});

test("accepts a project path with a trailing slash", (t) => {
  const { exec, run, project, read } = fixture(t);
  run(agent, "claude", ["--plan"]);
  const r = exec("--project", `${project}/`, "--tools", "claude", "--input", "input.json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(read(".claude/agents/code-reviewer.md"), /^name: code-reviewer$/m);
});

test("refuses a relative project and a symlink on the way to a target", (t) => {
  const { exec, run, dir, project } = fixture(t);
  run(agent, "claude", ["--plan"]);
  const relative = exec("--project", "project", "--tools", "claude", "--input", "input.json");
  assert.equal(relative.status, 1);
  assert.match(json(relative).error.message, /absolute/);
  const outside = path.join(dir, "outside");
  fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(project, ".claude"));
  const r = run(agent, "claude");
  assert.equal(r.status, 1);
  assert.deepEqual(fs.readdirSync(outside), []);
});

test("refuses a target file that is a symlink", (t) => {
  const { run, dir, project } = fixture(t);
  const outside = path.join(dir, "outside.md");
  fs.writeFileSync(outside, "keep\n");
  fs.mkdirSync(path.join(project, ".claude/agents"), { recursive: true });
  fs.symlinkSync(outside, path.join(project, ".claude/agents/code-reviewer.md"));
  const r = run(agent, "claude");
  assert.equal(r.status, 1);
  assert.equal(fs.readFileSync(outside, "utf8"), "keep\n");
});

test("exits 3 before writing anything when one target cannot be written", (t) => {
  const { run, project } = fixture(t);
  fs.writeFileSync(path.join(project, ".codex"), "not a directory");
  const r = run(agent, "claude,codex");
  assert.equal(r.status, 3);
  assert.ok(json(r).error.code);
  assert.equal(fs.existsSync(path.join(project, ".claude/agents/code-reviewer.md")), false);
});

test("refuses to overwrite a differing file without --force", (t) => {
  const { run, read, project } = fixture(t);
  fs.mkdirSync(path.join(project, ".claude/agents"), { recursive: true });
  fs.writeFileSync(path.join(project, ".claude/agents/code-reviewer.md"), "mine\n");
  const r = run(agent, "claude");
  assert.equal(r.status, 1);
  assert.equal(json(r).error.code, "REFUSED");
  assert.match(json(r).error.message, /\.claude\/agents\/code-reviewer\.md/);
  assert.equal(read(".claude/agents/code-reviewer.md"), "mine\n");
  assert.equal(run(agent, "claude", ["--force"]).status, 0);
  assert.match(read(".claude/agents/code-reviewer.md"), /^name: code-reviewer$/m);
});

test("a project checked out with CRLF line endings reads as its own output", (t) => {
  const { run, read, project } = fixture(t);
  const written = json(run()).files.map((file) => file.path);
  assert.equal(written.length, ALL.split(",").length);
  for (const name of written) fs.writeFileSync(path.join(project, name), read(name).replace(/\n/g, "\r\n"));
  const again = run(agent, ALL, ["--plan"]);
  assert.equal(again.status, 0, again.stdout);
  assert.ok(json(again).files.every((file) => file.operation === "unchanged"), again.stdout);
  assert.equal(run().status, 0);
});
