const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const REPO = path.resolve(__dirname, "../..");
const HOOKS = path.join(REPO, "plugins/aidd-context/hooks");
const ENTRY = "memory.cjs";
const RUNTIME = path.join(REPO, "cli/assets/hooks-runtime");
const PAYLOADS = path.join(__dirname, "fixtures/hook-payloads");
const HOSTS = ["claude", "codex", "copilot", "cursor", "opencode", "kilo"];
const MEMORY = "aidd_docs/memory";
const SCRUBBED_PROJECT = "/Users/user/project";
const ALWAYS = ["project-brief.md", "architecture.md", "coding-assertions.md", "testing.md", "vcs.md", "ecosystem.md"];

// The project's own git must never be reached from a temp project, and a session's project dir never redirects one.
const ENV = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_") && key !== "CLAUDE_PROJECT_DIR"));

const made = [];
test.after(() => {
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

/** The variables naming the system temp folder: `TMPDIR` on POSIX, `TEMP` and `TMP` on Windows. */
const tempEnv = (dir) => ({ TMPDIR: dir, TEMP: dir, TMP: dir });

function tempDir(prefix) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  made.push(dir);
  return dir;
}

const BRIDGED = new Set(["opencode", "kilo"]);

/** The plugin's hooks with one host's adapter where the build puts it, as each tool receives them. */
const installed = new Map();
function hookFor(host) {
  if (!installed.has(host)) {
    const dir = path.join(tempDir(`memory-hook-${host}-`), "hooks");
    fs.cpSync(HOOKS, dir, { recursive: true });
    // OpenCode and Kilo share one adapter, stamped with the host's name as their descriptors do.
    const adapter = BRIDGED.has(host)
      ? fs.readFileSync(path.join(RUNTIME, "host-bridge.cjs"), "utf8").replace('const HOST = "unstamped";', `const HOST = "${host}";`)
      : fs.readFileSync(path.join(RUNTIME, `host-${host}.cjs`), "utf8");
    fs.writeFileSync(path.join(dir, "lib/host.cjs"), adapter);
    installed.set(host, path.join(dir, ENTRY));
  }
  return installed.get(host);
}

/** A throwaway project: every always-written file clean, then `files` (project-relative) over it. */
function project(files = {}, { always = ALWAYS } = {}) {
  const root = tempDir("memory-project-");
  const all = { ...Object.fromEntries(always.map((name) => [`${MEMORY}/${name}`, "# T\n\nShort.\n"])), ...files };
  for (const [name, text] of Object.entries(all)) {
    const full = path.join(root, name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    if (text !== null) fs.writeFileSync(full, text);
  }
  return gitInit(root);
}

function write(root, name, text) {
  const full = path.join(root, name);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text);
}

function samples(file) {
  return JSON.parse(fs.readFileSync(path.join(PAYLOADS, file), "utf8")).samples;
}

/** A captured sample, the scrubbed project pointed at `root`. */
function captured(file, index, root) {
  // Replaced inside the JSON text, so the value goes in JSON-escaped: a Windows path's backslashes.
  const text = JSON.stringify(samples(file)[index].payload).replaceAll(SCRUBBED_PROJECT, JSON.stringify(root).slice(1, -1));
  return JSON.parse(text);
}

const SESSION_START = { claude: "claude-SessionStart.json", codex: "codex-SessionStart.json", copilot: "copilot-SessionStart.json", cursor: "cursor-sessionStart.json" };
const STOP = { claude: "claude-Stop.json", codex: "codex-Stop.json", copilot: "copilot-Stop.json", cursor: "cursor-stop.json" };
const PAYLOAD_HOSTS = Object.keys(SESSION_START);

// OpenCode and Kilo send no stdin: their bridge runs the hook with a payload built from the
// plugin's arguments (`opencode-hooks-bridge.ts`, read by the CLI's `hooks-runtime-bridges.integration.test.ts`).
function sessionStartPayload(host, root) {
  if (BRIDGED.has(host)) return { hook_event_name: "SessionStart", session_id: null, cwd: root };
  return captured(SESSION_START[host], 0, root);
}

function stopPayload(host, root, { active = false } = {}) {
  const payload = captured(STOP[host], 0, root);
  if (active) payload.stop_hook_active = true;
  return payload;
}

/** The goal hooks.json gives each event: a session start loads, a turn end syncs. */
function goalOf(payload) {
  const event = typeof payload === "string" ? "" : JSON.stringify(payload);
  return /"(?:SessionStart|sessionStart)"/u.test(event) ? "load" : "sync";
}

/** A run's own system temp folder: nothing a run leaves there may reach another. */
function run(host, payload, { cwd = os.tmpdir(), preload, tmp = tempDir("memory-hook-state-") } = {}) {
  const args = [...(preload ? ["--require", preload] : []), hookFor(host), goalOf(payload)];
  const result = spawnSync(process.execPath, args, {
    input: typeof payload === "string" ? payload : JSON.stringify(payload),
    encoding: "utf8",
    cwd,
    env: { ...ENV, ...tempEnv(tmp) },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function gitInit(root) {
  assert.equal(spawnSync("git", ["init", "-q"], { cwd: root, env: ENV }).status, 0);
  return root;
}

/** The Stop answer of a claude session, parsed; null when it printed nothing. */
function stopped(root, options) {
  const result = run("claude", stopPayload("claude", root, options));
  assert.equal(result.status, 0, result.stderr);
  return result.stdout === "" ? null : JSON.parse(result.stdout);
}

const VCS = `${MEMORY}/vcs.md`;
const BANK = "# VCS\n\n- keep one\n- release pipeline\n- keep two\n";
const PAIR = "# P\n\n<!-- aidd_project_memory:start -->\n<!-- aidd_project_memory:end -->\n";
const TEAM_BLOCK = "# P\n\n<!-- aidd_project_memory:start -->\n- Answer in French.\n<!-- aidd_project_memory:end -->\n";
const NOT_SYNCED = /^aidd-context: CLAUDE\.md holds a line the memory block would not write \("- Answer in French\."\), not synced$/u;

// ---- what the hook leaves behind --------------------------------------------------------------

test("a session start and a turn end keep no state: nothing in the project but the context files, nothing in the temp folder", () => {
  const root = project({ [VCS]: BANK, "AGENTS.md": PAIR });
  const tmp = tempDir("memory-hook-state-");
  assert.deepEqual(run("claude", sessionStartPayload("claude", root), { tmp }), { status: 0, stdout: "", stderr: "" });
  write(root, VCS, "# VCS\n");
  assert.deepEqual(run("claude", stopPayload("claude", root), { tmp }), { status: 0, stdout: "", stderr: "" });
  assert.equal(fs.existsSync(path.join(root, ".aidd")), false);
  assert.deepEqual(fs.readdirSync(tmp), []);
  const untracked = spawnSync("git", ["ls-files", "--others", "--exclude-standard"], { cwd: root, env: ENV, encoding: "utf8" }).stdout;
  assert.deepEqual(untracked.split("\n").filter((file) => !file.startsWith(MEMORY)).filter(Boolean), ["AGENTS.md"]);
});

test("a turn end that removed or wrote bank lines answers nothing: the skill reports its own changes", () => {
  const root = project({ [VCS]: BANK });
  write(root, VCS, "# VCS\n\n- keep one\n- Branch {{fill me}} here.\n");
  assert.equal(stopped(root), null);
});

for (const host of HOSTS) {
  test(`${host}: a session start lists the ui and pm folders in the block, stages nothing and prints nothing`, () => {
    const root = project({
      "aidd_docs/ui/x.md": "# UI\n",
      "aidd_docs/pm/x.md": "# PM\n",
      "CLAUDE.md": PAIR,
      "AGENTS.md": PAIR,
    });
    const git = (...args) => spawnSync("git", args, { cwd: root, env: ENV, encoding: "utf8" });
    git("add", "-A");
    git("-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-qm", "init");
    const { status, stdout } = run(host, sessionStartPayload(host, root));
    assert.deepEqual({ status, stdout }, { status: 0, stdout: "" });
    for (const file of ["CLAUDE.md", "AGENTS.md"]) {
      const text = fs.readFileSync(path.join(root, file), "utf8");
      assert.match(text, /^- aidd_docs\/pm\/$/mu, file);
      assert.match(text, /^- aidd_docs\/ui\/$/mu, file);
    }
    assert.equal(git("diff", "--cached", "--name-only").stdout, "", "the session start staged a file");
  });
}

// ---- Stop: the sync -------------------------------------------------------------------------

test("Stop runs the sync: a new on-demand file reaches the context block, silently", () => {
  const root = project({ "AGENTS.md": PAIR });
  write(root, `${MEMORY}/internal/new.md`, "# New\n");
  assert.equal(stopped(root), null);
  assert.match(fs.readFileSync(path.join(root, "AGENTS.md"), "utf8"), /^- aidd_docs\/memory\/internal\/new\.md$/mu);
});

test("Stop fills a marker pair added to a context file, and answers nothing", () => {
  const root = project({ [VCS]: BANK });
  write(root, "CLAUDE.md", PAIR);
  assert.equal(stopped(root), null);
  assert.match(fs.readFileSync(path.join(root, "CLAUDE.md"), "utf8"), /^@aidd_docs\/memory\/vcs\.md$/mu);
});

test("Stop says which context file misses a bank file it could not sync, and leaves the team's line in place", () => {
  const root = project({ "CLAUDE.md": TEAM_BLOCK, [VCS]: BANK });
  write(root, `${MEMORY}/internal/new.md`, "# New\n");
  assert.match(stopped(root).reason, NOT_SYNCED);
  assert.equal(fs.readFileSync(path.join(root, "CLAUDE.md"), "utf8"), TEAM_BLOCK);
});

test("Stop is silent on a context file it could not sync that already names every bank file", () => {
  const root = project({ [VCS]: BANK }, { always: [] });
  write(root, "CLAUDE.md", TEAM_BLOCK.replace("- Answer in French.\n", "@aidd_docs/memory/vcs.md\n- Answer in French.\n"));
  assert.equal(stopped(root), null);
});

test("Stop: a continuation turn answers nothing", () => {
  const root = project({ "CLAUDE.md": TEAM_BLOCK, [VCS]: BANK });
  write(root, `${MEMORY}/internal/new.md`, "# New\n");
  assert.equal(stopped(root, { active: true }), null);
});

// ---- Stop: what the person sees -------------------------------------------------------------

for (const host of PAYLOAD_HOSTS) {
  test(`${host}: Stop continues the turn with the file it could not sync, and only the claude adapter prints it for the person`, () => {
    const root = project({ "CLAUDE.md": TEAM_BLOCK, [VCS]: BANK });
    write(root, `${MEMORY}/internal/new.md`, "# New\n");
    const result = run(host, stopPayload(host, root));
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /not synced/u, `${host} printed ${result.stdout}`);
    const out = JSON.parse(result.stdout);
    if (host === "claude") assert.equal(out.systemMessage, out.reason);
    else assert.ok(!result.stdout.includes("systemMessage"), result.stdout);
  });
}

// ---- robustness and contract ----------------------------------------------------------------

for (const host of HOSTS) {
  test(`${host}: garbage, empty stdin and an unknown event answer nothing`, () => {
    for (const input of ["{nope", "", JSON.stringify({ hook_event_name: "Nope", cwd: os.tmpdir() })]) {
      assert.deepEqual(run(host, input), { status: 0, stdout: "", stderr: "" }, input);
    }
  });
}

test("an engine that throws answers nothing", () => {
  const root = project({ "CLAUDE.md": TEAM_BLOCK, [VCS]: BANK });
  write(root, `${MEMORY}/internal/new.md`, "# New\n");
  const preload = path.join(tempDir("memory-hook-throw-"), "throw.js");
  fs.writeFileSync(preload, 'const fs = require("node:fs");\nfs.readdirSync = () => { throw new Error("boom"); };\n');
  assert.deepEqual(run("claude", stopPayload("claude", root), { preload }), { status: 0, stdout: "", stderr: "" });
});

test("the hook loads in a project whose package.json declares an ES module", () => {
  const root = project({ [VCS]: BANK, "CLAUDE.md": PAIR, "package.json": JSON.stringify({ type: "module" }) });
  fs.cpSync(path.dirname(hookFor("claude")), path.join(root, "hooks"), { recursive: true });
  const payload = stopPayload("claude", root);
  const result = spawnSync(process.execPath, [path.join(root, "hooks", ENTRY), goalOf(payload)], { input: JSON.stringify(payload), encoding: "utf8", cwd: root, env: ENV });
  assert.equal(result.status, 0, result.stderr);
  assert.match(fs.readFileSync(path.join(root, "CLAUDE.md"), "utf8"), /^@aidd_docs\/memory\/vcs\.md$/mu);
});

test("the hook reads its event only through lib/host.cjs and never a host's payload", () => {
  const source = fs.readFileSync(path.join(HOOKS, ENTRY), "utf8");
  assert.match(source, /require\("\.\/lib\/host\.cjs"\)/u);
  for (const field of ["tool_input", "tool_name", "hook_event_name", "workspace_roots", "tool_result", "raw", "CLAUDE_PROJECT_DIR", "CURSOR_PROJECT_DIR", "Begin Patch", "sessionId"]) {
    assert.ok(!source.includes(field), `memory.cjs reads ${field}`);
  }
});

test("aidd-context formats its own findings and carries no copy of another plugin's library", () => {
  assert.equal(fs.existsSync(path.join(HOOKS, "lib", "common-rules.cjs")), false);
});

test("the entry and its libraries require only the built-ins the contract allows and their own modules", () => {
  for (const file of [ENTRY, "lib/markdown.cjs"]) {
    const required = [...fs.readFileSync(path.join(HOOKS, file), "utf8").matchAll(/require\(\s*["']([^"']+)["']\s*\)/gu)].map((m) => m[1]);
    for (const name of required) assert.ok(["node:crypto", "node:fs", "node:os", "node:path"].includes(name) || name.startsWith("./"), `${file} requires ${name}`);
  }
});

test("the hook's markdown reader is the skill's, byte for byte: each ships on its own", () => {
  const skill = path.join(REPO, "plugins/aidd-context/skills/02-project-memory/scripts/lib/markdown.cjs");
  assert.equal(fs.readFileSync(path.join(HOOKS, "lib/markdown.cjs"), "utf8"), fs.readFileSync(skill, "utf8"));
});

test("hooks.json names each event's goal, loads at session start and syncs at the turn end, within 5 s", () => {
  const { hooks } = JSON.parse(fs.readFileSync(path.join(HOOKS, "hooks.json"), "utf8"));
  const goals = { SessionStart: "load", Stop: "sync" };
  assert.deepEqual(Object.keys(hooks).sort(), ["SessionStart", "Stop"]);
  for (const event of ["SessionStart", "Stop"]) {
    assert.equal(hooks[event][0].hooks[0].command, `node \${CLAUDE_PLUGIN_ROOT}/hooks/memory.cjs ${goals[event]}`, event);
    assert.equal(hooks[event][0].hooks[0].timeout, 5, `${event} declares the contract's 5 s timeout`);
  }
  assert.equal(hooks.Stop[0].hooks[0].statusMessage, "AIDD Context: sync project memory");
});

test("the engine runs only as the hook: load and sync; guard, check and the older commands are gone", () => {
  for (const command of ["guard", "check", "plan", "answer", "report", "changes"]) {
    const result = spawnSync(process.execPath, [path.join(HOOKS, ENTRY), command], { encoding: "utf8" });
    assert.equal(result.stderr, "usage: memory.cjs load | sync\n", command);
    assert.equal(result.status, 1, command);
  }
  for (const lib of ["plan", "fact-sheet", "report", "changes", "bank-guard", "memory-rules"]) assert.equal(fs.existsSync(path.join(HOOKS, "lib", `${lib}.cjs`)), false, lib);
});
