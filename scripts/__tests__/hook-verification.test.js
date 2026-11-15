const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");

const skill = path.resolve(__dirname, "../../plugins/aidd-context/skills/08-hook-generate");
const NAME = "guard-shell";
const FOLDERS = { claude: ".claude", codex: ".codex", cursor: ".cursor", copilot: ".github", antigravity: ".agents", opencode: ".opencode", kilo: ".kilo" };
const TOOL_EVENTS = {
  claude: "PreToolUse",
  codex: "PreToolUse",
  cursor: "beforeShellExecution",
  copilot: "preToolUse",
  antigravity: "PreToolUse",
  opencode: "tool.execute.before",
  kilo: "tool.execute.before",
};
const hostsOf = (event) => Object.fromEntries(Object.keys(FOLDERS).map((host) => [host, { event: event[host] }]));
const ASK = JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "ask" } });

// Records what the host sent, then answers nothing: a correct script on every host.
const RECORDER = `const fs = require("node:fs");
const stdin = fs.readFileSync(0, "utf8");
const out = process.env.CAPTURE_DIR + "/" + process.argv[2] + ".json";
fs.writeFileSync(out, JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd(), stdin }));
`;
const nodeScript = (body) => `${body}\n`;

function fixture(t) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "aidd-verify-")));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const project = path.join(dir, "project");
  const installed = path.join(dir, "installed");
  const captured = path.join(dir, "captured");
  fs.mkdirSync(project);
  fs.mkdirSync(captured);
  fs.cpSync(skill, installed, { recursive: true });
  const script = path.join(installed, "scripts/verify-hook.cjs");
  assert.ok(fs.existsSync(script), "installed skill must contain its verifier");
  const env = { PATH: `${path.dirname(process.execPath)}:/bin`, CAPTURE_DIR: captured };
  const exec = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8", cwd: dir, env });
  function copy(host, content, extension = "cjs") {
    const file = path.join(project, FOLDERS[host], "hooks", `${NAME}.${extension}`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  function verify(request, hosts = Object.keys(request.hosts)) {
    const input = path.join(dir, "input.json");
    fs.writeFileSync(input, JSON.stringify({ name: NAME, runner: "node", extension: "cjs", script: "", ...request, hosts: Object.fromEntries(hosts.map((host) => [host, request.hosts[host]])) }));
    return exec("--project", project, "--input", input);
  }
  const capture = (host) => JSON.parse(JSON.parse(fs.readFileSync(path.join(captured, `${host}.json`), "utf8")).stdin);
  const capturedRun = (host) => JSON.parse(fs.readFileSync(path.join(captured, `${host}.json`), "utf8"));
  return { project, exec, copy, verify, capture, capturedRun };
}

const json = (r) => JSON.parse(r.stdout);
const byHost = (r) => Object.fromEntries(json(r).results.map((result) => [result.host, result]));

test("a correct script passes on every host and receives that host's native payload", (t) => {
  const { project, copy, verify, capture, capturedRun } = fixture(t);
  for (const host of Object.keys(FOLDERS)) copy(host, nodeScript(RECORDER));
  const r = verify({ hosts: hostsOf(TOOL_EVENTS) });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(json(r).results, Object.keys(FOLDERS).map((host) => ({ host, status: "verified" })));

  assert.deepEqual(Object.keys(capture("claude")).sort(), ["cwd", "hook_event_name", "session_id", "tool_input", "tool_name"]);
  assert.equal(capture("claude").hook_event_name, "PreToolUse");
  assert.deepEqual(Object.keys(capture("codex")).sort(), ["cwd", "hook_event_name", "model", "session_id", "tool_input", "tool_name", "turn_id"]);
  assert.deepEqual(Object.keys(capture("copilot")).sort(), ["cwd", "sessionId", "timestamp", "toolArgs", "toolName"]);
  assert.equal(typeof capture("copilot").toolArgs, "object");
  assert.equal(capture("antigravity").toolCall.name, "run_command");
  assert.equal(typeof capture("antigravity").toolCall.args.CommandLine, "string");
  assert.equal(capture("antigravity").hookEventName, "PreToolUse");
  assert.ok(Array.isArray(capture("antigravity").workspacePaths));
  assert.equal(capture("cursor").hook_event_name, "beforeShellExecution");
  for (const host of ["opencode", "kilo"]) {
    assert.deepEqual(Object.keys(capture(host)).sort(), ["args", "sessionID", "tool"]);
    assert.equal(typeof capture(host).args.command, "string");
  }
  for (const host of Object.keys(FOLDERS)) assert.deepEqual(capturedRun(host).argv, [host]);
  assert.equal(capturedRun("antigravity").cwd, path.join(project, ".agents"));
  for (const host of Object.keys(FOLDERS).filter((tool) => tool !== "antigravity")) assert.equal(capturedRun(host).cwd, project);
});

test("a shell script is verified like a node one", (t) => {
  const { copy, verify } = fixture(t);
  copy("claude", "#!/bin/sh\ncat > /dev/null\nexit 0\n", "sh");
  const r = verify({ runner: "sh", extension: "sh", hosts: { claude: { event: "PreToolUse" } } });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(json(r).results, [{ host: "claude", status: "verified" }]);
});

test("plain text at Stop fails on codex only, from a shell script", (t) => {
  const { copy, verify } = fixture(t);
  for (const host of ["claude", "codex"]) copy(host, "#!/bin/sh\ncat > /dev/null\necho keep going\n", "sh");
  const r = verify({ runner: "sh", extension: "sh", hosts: { claude: { event: "Stop" }, codex: { event: "Stop" } } });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  const results = byHost(r);
  assert.equal(results.claude.status, "verified");
  assert.equal(results.codex.status, "failed");
  assert.match(results.codex.finding, /Stop/);
  assert.match(results.codex.finding, /JSON/);
});

test("ask before a tool runs fails on codex, which cannot ask", (t) => {
  const { copy, verify } = fixture(t);
  for (const host of ["claude", "codex"]) copy(host, nodeScript(`process.stdout.write(${JSON.stringify(ASK)});`));
  const r = verify({ hosts: { claude: { event: "PreToolUse" }, codex: { event: "PreToolUse" } } });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  const results = byHost(r);
  assert.equal(results.claude.status, "verified");
  assert.equal(results.codex.status, "failed");
  assert.match(results.codex.finding, /ask/);
});

test("a missing copy fails and names its path", (t) => {
  const { copy, verify } = fixture(t);
  copy("claude", nodeScript(""));
  const r = verify({ hosts: { claude: { event: "PreToolUse" }, codex: { event: "PreToolUse" } } });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  const results = byHost(r);
  assert.equal(results.claude.status, "verified");
  assert.equal(results.codex.status, "failed");
  assert.ok(results.codex.finding.includes(".codex/hooks/guard-shell.cjs"), results.codex.finding);
});

test("a script that never returns fails after the hook's timeout", (t) => {
  const { copy, verify } = fixture(t);
  copy("claude", nodeScript("setInterval(() => {}, 1000);"));
  const started = Date.now();
  const r = verify({ timeout: 1, hosts: { claude: { event: "PreToolUse" } } });
  assert.ok(Date.now() - started < 10000, "the verifier must not wait past the timeout");
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(byHost(r).claude.finding, /timeout/i);
  assert.match(byHost(r).claude.finding, /1 s/);
});

const FAILURES = [
  ["an exit code other than 0 and 2", "claude", "PreToolUse", "process.exit(1);", /exit 1/],
  ["exit 2 on a Copilot event that cannot block", "copilot", "postToolUse", 'process.stderr.write("no"); process.exit(2);', /postToolUse/],
  ["exit 2 with no reason on opencode", "opencode", "tool.execute.before", "process.exit(2);", /stderr/],
  ["exit 2 with no reason on kilo", "kilo", "tool.execute.before", "process.exit(2);", /stderr/],
  ["a decision Antigravity does not know", "antigravity", "PreToolUse", 'process.stdout.write(JSON.stringify({ decision: "block" }));', /block/],
  ["Antigravity stdout that is not JSON", "antigravity", "PreToolUse", 'process.stdout.write("allowed");', /JSON/],
  ["a Claude permission decision it does not know", "claude", "PreToolUse", 'process.stdout.write(JSON.stringify({ hookSpecificOutput: { permissionDecision: "maybe" } }));', /maybe/],
];
for (const [title, host, event, body, expected] of FAILURES) {
  test(`${title} fails on ${host}`, (t) => {
    const { copy, verify } = fixture(t);
    copy(host, nodeScript(body));
    const r = verify({ hosts: { [host]: { event } } });
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.equal(byHost(r)[host].status, "failed");
    assert.match(byHost(r)[host].finding, expected);
  });
}

const PASSES = [
  ["exit 2 with a reason blocks on claude", "claude", "PreToolUse", 'process.stderr.write("no shell"); process.exit(2);'],
  ["exit 2 with a reason blocks on opencode", "opencode", "tool.execute.before", 'process.stderr.write("no shell"); process.exit(2);'],
  ["exit 2 blocks Copilot before a tool", "copilot", "preToolUse", 'process.stderr.write("no shell"); process.exit(2);'],
  ["Antigravity continues at Stop", "antigravity", "Stop", 'process.stdout.write(JSON.stringify({ decision: "continue", reason: "more" }));'],
  ["Cursor asks before a shell command", "cursor", "beforeShellExecution", 'process.stdout.write(JSON.stringify({ permission: "ask" }));'],
];
for (const [title, host, event, body] of PASSES) {
  test(title, (t) => {
    const { copy, verify } = fixture(t);
    copy(host, nodeScript(body));
    const r = verify({ hosts: { [host]: { event } } });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.deepEqual(json(r).results, [{ host, status: "verified" }]);
  });
}

test("usage errors exit 2", (t) => {
  const { exec } = fixture(t);
  const r = exec("--project");
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.equal(json(r).error.code, "USAGE");
});
