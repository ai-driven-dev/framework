const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
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
const SESSION = "00000000-0000-4000-8000-000000000000";
const ALWAYS = ["project-brief.md", "architecture.md", "coding-assertions.md", "testing.md", "vcs.md", "ecosystem.md"];
const TEMPLATES = path.join(REPO, "plugins/aidd-context/skills/02-project-memory/assets/templates/memory");
const DAY_MS = 24 * 60 * 60 * 1000;

/** A question of the template named `name`, as a project leaves it when it never answers it. */
function slotOf(name, index = 0) {
  return [...fs.readFileSync(path.join(TEMPLATES, name), "utf8").matchAll(/\{\{[^{}\n]*\}\}/gu)][index][0];
}
const SLOT = slotOf("vcs.md", 2);
const SHOWN = SLOT.length > 40 ? `${SLOT.slice(0, 39)}…` : SLOT;

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
    fs.cpSync(TEMPLATES, path.join(dir, "../skills/02-project-memory/assets/templates/memory"), { recursive: true });
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
  return root;
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

/** A run's own system temp folder: nothing a run leaves there may reach another. */
function run(host, payload, { cwd = os.tmpdir(), preload, tmp = tempDir("memory-hook-state-") } = {}) {
  const args = [...(preload ? ["--require", preload] : []), hookFor(host), "hook"];
  const result = spawnSync(process.execPath, args, {
    input: typeof payload === "string" ? payload : JSON.stringify(payload),
    encoding: "utf8",
    cwd,
    env: { ...ENV, ...tempEnv(tmp) },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

const snapshotDir = (tmp) => path.join(tmp, "aidd-context");
const snapshotName = (root, session = SESSION) => `${crypto.createHash("sha1").update(fs.realpathSync(root)).digest("hex")}-${session}.json`;
const snapshotPath = (tmp, root, session) => path.join(snapshotDir(tmp), snapshotName(root, session));
const readSnapshot = (tmp, root) => JSON.parse(fs.readFileSync(snapshotPath(tmp, root), "utf8"));

/** A claude session over `root`: its session start has run, so the bank is snapshotted. */
function started(files, host = "claude") {
  const root = project(files);
  const tmp = tempDir("memory-hook-state-");
  assert.deepEqual(run(host, sessionStartPayload(host, root), { tmp }), { status: 0, stdout: "", stderr: "" });
  return { root, tmp };
}

/** The Stop answer of a claude session, parsed; null when it printed nothing. */
function stopped(root, tmp, options) {
  const result = run("claude", stopPayload("claude", root, options), { tmp });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout === "" ? null : JSON.parse(result.stdout);
}

const VCS = `${MEMORY}/vcs.md`;
const GONE = (count) => `aidd-context: ${count} memory lines gone from the bank since the last check`;
const SHOW_THEM = "Show these lines to the person as they are, and restore any the person did not approve.";

// ---- SessionStart: the snapshot -------------------------------------------------------------

test("a session start snapshots every markdown file of the bank, nested ones included, to the system temp folder", () => {
  const files = { [VCS]: "# VCS\n\n- one\n", [`${MEMORY}/internal/notes.md`]: "# N\n\n- deep\n", [`${MEMORY}/external/x.txt`]: "not markdown\n" };
  const { root, tmp } = started(files);
  const expected = Object.fromEntries(
    Object.entries({ ...Object.fromEntries(ALWAYS.map((name) => [`${MEMORY}/${name}`, "# T\n\nShort.\n"])), ...files })
      .filter(([name]) => name.endsWith(".md"))
      .sort(([a], [b]) => a.localeCompare(b))
  );
  assert.deepEqual(readSnapshot(tmp, root), expected);
  assert.deepEqual(fs.readdirSync(snapshotDir(tmp)), [snapshotName(root)]);
});

test("a session start with no session id writes no snapshot", () => {
  const root = project();
  const tmp = tempDir("memory-hook-state-");
  const payload = sessionStartPayload("claude", root);
  delete payload.session_id;
  assert.deepEqual(run("claude", payload, { tmp }), { status: 0, stdout: "", stderr: "" });
  assert.equal(fs.existsSync(snapshotDir(tmp)), false);
});

test("a session start in a project with no bank snapshots an empty bank", () => {
  const root = tempDir("memory-project-");
  const tmp = tempDir("memory-hook-state-");
  assert.deepEqual(run("claude", sessionStartPayload("claude", root), { tmp }), { status: 0, stdout: "", stderr: "" });
  assert.deepEqual(readSnapshot(tmp, root), {});
});

test("a setup after a session start with no bank gets its lint and its sync at Stop, with no lost line", () => {
  const root = tempDir("memory-project-");
  const tmp = tempDir("memory-hook-state-");
  write(root, "AGENTS.md", "# P\n\n<!-- aidd_project_memory:start -->\n<!-- aidd_project_memory:end -->\n");
  assert.deepEqual(run("claude", sessionStartPayload("claude", root), { tmp }), { status: 0, stdout: "", stderr: "" });
  write(root, `${MEMORY}/api.md`, `# API\n\n- Use ${slotOf("api.md")} here.\n`);
  assert.match(stopped(root, tmp).reason, /^aidd-context: 1 error, 0 warnings\naidd_docs\/memory\/api\.md:3 M3 /u);
  assert.match(fs.readFileSync(path.join(root, "AGENTS.md"), "utf8"), /^\[aidd_docs\/memory\/api\.md\]/mu);
});

test("a session start deletes snapshots older than 7 days and keeps the others", () => {
  const root = project();
  const tmp = tempDir("memory-hook-state-");
  fs.mkdirSync(snapshotDir(tmp));
  const stale = path.join(snapshotDir(tmp), "stale-session.json");
  const recent = path.join(snapshotDir(tmp), "recent-session.json");
  fs.writeFileSync(stale, "{}");
  fs.writeFileSync(recent, "{}");
  const old = new Date(Date.now() - 8 * DAY_MS);
  const near = new Date(Date.now() - 6 * DAY_MS);
  fs.utimesSync(stale, old, old);
  fs.utimesSync(recent, near, near);
  run("claude", sessionStartPayload("claude", root), { tmp });
  assert.deepEqual(fs.readdirSync(snapshotDir(tmp)).sort(), ["recent-session.json", snapshotName(root)].sort());
});

for (const host of HOSTS) {
  test(`${host}: a session start lists the ui and pm folders in the block, stages nothing and prints nothing`, () => {
    const root = project({
      "aidd_docs/ui/x.md": "# UI\n",
      "aidd_docs/pm/x.md": "# PM\n",
      "CLAUDE.md": "# P\n\n<!-- aidd_project_memory:start -->\n<!-- aidd_project_memory:end -->\n",
      "AGENTS.md": "# P\n\n<!-- aidd_project_memory:start -->\n<!-- aidd_project_memory:end -->\n",
    });
    const git = (...args) => spawnSync("git", args, { cwd: root, env: ENV, encoding: "utf8" });
    git("init", "-q");
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

// ---- Stop: lost lines, lint, sync -----------------------------------------------------------

const BANK = "# VCS\n\n- keep one\n- release pipeline\n- keep two\n";

test("Stop names a line gone from the bank, quoted exactly, and asks the model to show and restore", () => {
  const { root, tmp } = started({ [VCS]: BANK });
  write(root, VCS, "# VCS\n\n- keep one\n- keep two\n");
  assert.deepEqual(stopped(root, tmp), {
    decision: "block",
    reason: [GONE(1), `${VCS}: "- release pipeline"`, SHOW_THEM].join("\n"),
    systemMessage: [GONE(1), `${VCS}: "- release pipeline"`, SHOW_THEM].join("\n"),
  });
});

test("Stop: a line moved to another bank file is not lost", () => {
  const { root, tmp } = started({ [VCS]: BANK });
  write(root, VCS, "# VCS\n\n- keep one\n- keep two\n");
  write(root, `${MEMORY}/testing.md`, "# T\n\nShort.\n\n- release pipeline\n");
  assert.equal(stopped(root, tmp), null);
});

test("Stop: a line only reindented, padded or moved within its file is not lost", () => {
  const { root, tmp } = started({ [VCS]: "# VCS\n\n  - nested  \n- flat\n- last\n" });
  write(root, VCS, "# VCS\n\n- last\n- nested\n\n  - flat  \n");
  assert.equal(stopped(root, tmp), null);
});

test("Stop: a reworded line is reported as the old line lost", () => {
  const { root, tmp } = started({ [VCS]: BANK });
  write(root, VCS, BANK.replace("- release pipeline", "- release pipelines"));
  assert.match(stopped(root, tmp).reason, new RegExp(`^${GONE(1)}\\n${VCS}: "- release pipeline"\\n`, "u"));
});

test("Stop: a line of a deleted file is lost", () => {
  const { root, tmp } = started({ [`${MEMORY}/internal/old.md`]: "# Old\n\n- only here\n" });
  fs.rmSync(path.join(root, MEMORY, "internal/old.md"));
  const text = stopped(root, tmp).reason;
  assert.ok(text.includes(`${MEMORY}/internal/old.md: "- only here"`), text);
});

test("Stop: lost lines are listed in the snapshot's file order, each once", () => {
  const { root, tmp } = started({ [VCS]: "# VCS\n\n- b\n- a\n- b\n", [`${MEMORY}/testing.md`]: "# T\n\n- c\n- a\n" });
  write(root, VCS, "# VCS\n");
  write(root, `${MEMORY}/testing.md`, "# T\n");
  assert.deepEqual(stopped(root, tmp).reason.split("\n").slice(0, 4), [GONE(3), `${MEMORY}/testing.md: "- c"`, `${MEMORY}/testing.md: "- a"`, `${VCS}: "- b"`]);
});

test("Stop: more than 15 lost lines list 15 and point at git diff for the rest", () => {
  const lines = Array.from({ length: 18 }, (_, at) => `- fact ${String(at).padStart(2, "0")}`);
  const { root, tmp } = started({ [VCS]: `# VCS\n\n${lines.join("\n")}\n` });
  write(root, VCS, "# VCS\n");
  const text = stopped(root, tmp).reason.split("\n");
  assert.equal(text[0], GONE(18));
  assert.deepEqual(text.slice(1, 16), lines.slice(0, 15).map((line) => `${VCS}: "${line}"`));
  assert.equal(text[16], "+3 more, see git diff aidd_docs/memory");
  assert.equal(text[17], SHOW_THEM);
});

test("Stop: an unchanged bank answers nothing", () => {
  const { root, tmp } = started({ [VCS]: BANK });
  assert.equal(stopped(root, tmp), null);
});

test("Stop: a continuation turn answers nothing and leaves the snapshot as it was", () => {
  const { root, tmp } = started({ [VCS]: BANK });
  const before = fs.readFileSync(snapshotPath(tmp, root), "utf8");
  write(root, VCS, "# VCS\n");
  assert.equal(stopped(root, tmp, { active: true }), null);
  assert.equal(fs.readFileSync(snapshotPath(tmp, root), "utf8"), before);
});

test("Stop with no snapshot answers nothing and writes one, so the next loss is reported", () => {
  const root = project({ [VCS]: BANK });
  const tmp = tempDir("memory-hook-state-");
  write(root, VCS, "# VCS\n\n- keep one\n");
  assert.equal(stopped(root, tmp), null);
  assert.deepEqual(readSnapshot(tmp, root)[VCS], "# VCS\n\n- keep one\n");
  write(root, VCS, "# VCS\n");
  assert.match(stopped(root, tmp).reason, new RegExp(`^${GONE(1)}\\n`, "u"));
});

test("Stop with no session id answers nothing and writes no snapshot", () => {
  const { root, tmp } = started({ [VCS]: BANK });
  write(root, VCS, "# VCS\n");
  const payload = stopPayload("claude", root);
  delete payload.session_id;
  assert.deepEqual(run("claude", payload, { tmp }), { status: 0, stdout: "", stderr: "" });
});

test("Stop in a project with no bank answers nothing and writes no snapshot", () => {
  const root = tempDir("memory-project-");
  const tmp = tempDir("memory-hook-state-");
  assert.equal(stopped(root, tmp), null);
  assert.equal(fs.existsSync(snapshotDir(tmp)), false);
});

test("Stop advances the snapshot: the same loss is not reported twice", () => {
  const { root, tmp } = started({ [VCS]: BANK });
  write(root, VCS, "# VCS\n\n- keep one\n- keep two\n");
  assert.ok(stopped(root, tmp));
  assert.equal(readSnapshot(tmp, root)[VCS], "# VCS\n\n- keep one\n- keep two\n");
  assert.equal(stopped(root, tmp), null);
});

test("Stop advances the snapshot when only lint answers, and when nothing is lost", () => {
  const { root, tmp } = started({ [VCS]: BANK });
  write(root, VCS, `${BANK}- Branch ${SLOT} here.\n`);
  assert.ok(stopped(root, tmp));
  assert.equal(readSnapshot(tmp, root)[VCS], `${BANK}- Branch ${SLOT} here.\n`);
  assert.equal(stopped(root, tmp), null);
});

test("Stop lints only the files that changed or are new, and answers lint alone with no lost line", () => {
  const { root, tmp } = started({ [`${MEMORY}/testing.md`]: `# T\n\n- Standing ${slotOf("testing.md")}\n` });
  write(root, VCS, `${BANK}- Branch ${SLOT} here.\n`);
  assert.deepEqual(stopped(root, tmp).reason.split("\n"), ["aidd-context: 1 error, 0 warnings", `${VCS}:6 M3 "${SHOWN}" => fill it from the code`]);
});

test("Stop leaves out a finding on a line the turn did not write, so the team's own lines draw no lint", () => {
  const long = `- ${Array(40).fill("word").join(" ")}.`;
  const { root, tmp } = started({ [VCS]: `${BANK}${long}\n` });
  write(root, VCS, `${BANK}${long}\n- One short new line.\n`);
  assert.equal(stopped(root, tmp), null);
});

test("Stop reports a finding on a line the turn wrote, in a file it changed", () => {
  const long = `- ${Array(40).fill("word").join(" ")}.`;
  const { root, tmp } = started({ [VCS]: BANK });
  write(root, VCS, `${BANK}${long}\n`);
  assert.match(stopped(root, tmp).reason, /^aidd-context: 0 errors, 1 warning\naidd_docs\/memory\/vcs\.md:\d+ M5 warning /u);
});

test("Stop lints a new bank file", () => {
  const { root, tmp } = started();
  write(root, `${MEMORY}/api.md`, `# API\n\n- Use ${slotOf("api.md")} here.\n`);
  assert.match(stopped(root, tmp).reason, /^aidd-context: 1 error, 0 warnings\naidd_docs\/memory\/api\.md:3 M3 /u);
});

test("Stop puts lost lines first, then the instruction, then the lint findings, in one answer", () => {
  const { root, tmp } = started({ [VCS]: BANK });
  write(root, VCS, `# VCS\n\n- keep one\n- keep two\n- Branch ${SLOT} here.\n`);
  assert.deepEqual(stopped(root, tmp).reason.split("\n"), [
    GONE(1),
    `${VCS}: "- release pipeline"`,
    SHOW_THEM,
    "aidd-context: 1 error, 0 warnings",
    `${VCS}:5 M3 "${SHOWN}" => fill it from the code`,
  ]);
});

test("Stop with a file outside the bank's root files lints nothing for it", () => {
  const { root, tmp } = started();
  write(root, `${MEMORY}/internal/x.md`, `# X\n\n${Array(31).fill("word").join(" ")}\n`);
  assert.equal(stopped(root, tmp), null);
});

test("Stop runs the sync: a new on-demand file reaches the context block, silently", () => {
  const block = "# P\n\n<!-- aidd_project_memory:start -->\n<!-- aidd_project_memory:end -->\n";
  const { root, tmp } = started({ "AGENTS.md": block });
  write(root, `${MEMORY}/internal/new.md`, "# New\n");
  assert.equal(stopped(root, tmp), null);
  assert.match(fs.readFileSync(path.join(root, "AGENTS.md"), "utf8"), /^- aidd_docs\/memory\/internal\/new\.md$/mu);
});

test("Stop on an unchanged bank still fills a marker pair added to a context file, and answers nothing", () => {
  const { root, tmp } = started({ [VCS]: BANK });
  write(root, "CLAUDE.md", "# P\n\n<!-- aidd_project_memory:start -->\n<!-- aidd_project_memory:end -->\n");
  assert.equal(stopped(root, tmp), null);
  assert.match(fs.readFileSync(path.join(root, "CLAUDE.md"), "utf8"), /^@aidd_docs\/memory\/vcs\.md$/mu);
});

test("Stop runs the sync when a loss is also reported", () => {
  const block = "# P\n\n<!-- aidd_project_memory:start -->\n<!-- aidd_project_memory:end -->\n";
  const { root, tmp } = started({ "AGENTS.md": block, [VCS]: BANK });
  write(root, VCS, "# VCS\n");
  assert.ok(stopped(root, tmp));
  assert.match(fs.readFileSync(path.join(root, "AGENTS.md"), "utf8"), /aidd_docs\/memory\/vcs\.md/u);
});

// ---- Stop: what the person sees -------------------------------------------------------------

for (const host of PAYLOAD_HOSTS) {
  test(`${host}: Stop continues the turn with the lost lines, and only the claude adapter prints them for the person`, () => {
    const { root, tmp } = started({ [VCS]: BANK }, host);
    write(root, VCS, "# VCS\n");
    const result = run(host, stopPayload(host, root), { tmp });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /memory lines gone from the bank/u, `${host} printed ${result.stdout}`);
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

test("a rule that throws drops out of Stop: the lost lines are still reported", () => {
  const { root, tmp } = started({ [VCS]: BANK });
  write(root, VCS, `# VCS\n\n- keep one\n- Branch ${SLOT} here.\n`);
  const preload = path.join(tempDir("memory-hook-rule-throws-"), "throw.js");
  const rules = path.join(path.dirname(hookFor("claude")), "lib/memory-rules.cjs");
  fs.writeFileSync(preload, `const { RULES } = require(${JSON.stringify(rules)});\nRULES.find((rule) => rule.id === "M3").check = () => { throw new Error("boom"); };\n`);
  const result = run("claude", stopPayload("claude", root), { tmp, preload });
  assert.equal(result.status, 0);
  assert.match(JSON.parse(result.stdout).reason, new RegExp(`^${GONE(2)}\\n`, "u"));
  assert.doesNotMatch(result.stdout, /M3/u);
});

test("an engine that throws answers nothing", () => {
  const { root, tmp } = started({ [VCS]: BANK });
  write(root, VCS, "# VCS\n");
  const preload = path.join(tempDir("memory-hook-throw-"), "throw.js");
  fs.writeFileSync(preload, 'const fs = require("node:fs");\nfs.readdirSync = () => { throw new Error("boom"); };\n');
  assert.deepEqual(run("claude", stopPayload("claude", root), { tmp, preload }), { status: 0, stdout: "", stderr: "" });
});

test("the hook loads in a project whose package.json declares an ES module", () => {
  const root = project({ [VCS]: BANK, "package.json": JSON.stringify({ type: "module" }) });
  fs.cpSync(path.dirname(hookFor("claude")), path.join(root, "hooks"), { recursive: true });
  fs.cpSync(TEMPLATES, path.join(root, "skills/02-project-memory/assets/templates/memory"), { recursive: true });
  const tmp = tempDir("memory-hook-state-");
  const hook = (payload) =>
    spawnSync(process.execPath, [path.join(root, "hooks", ENTRY), "hook"], { input: JSON.stringify(payload), encoding: "utf8", cwd: root, env: { ...ENV, ...tempEnv(tmp) } });
  assert.equal(hook(sessionStartPayload("claude", root)).status, 0);
  write(root, VCS, "# VCS\n");
  const result = hook(stopPayload("claude", root));
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /memory lines gone/u);
});

test("the hook reads its event only through lib/host.cjs and never a host's payload", () => {
  const source = fs.readFileSync(path.join(HOOKS, ENTRY), "utf8");
  assert.match(source, /require\("\.\/lib\/host\.cjs"\)/u);
  for (const field of ["tool_input", "tool_name", "hook_event_name", "workspace_roots", "tool_result", "raw", "CLAUDE_PROJECT_DIR", "CURSOR_PROJECT_DIR", "Begin Patch"]) {
    assert.ok(!source.includes(field), `memory.cjs reads ${field}`);
  }
});

test("the entry and its libraries require only the built-ins the contract allows and their own modules", () => {
  for (const file of [ENTRY, "lib/memory-rules.cjs", "lib/common-rules.cjs"]) {
    const required = [...fs.readFileSync(path.join(HOOKS, file), "utf8").matchAll(/require\(\s*["']([^"']+)["']\s*\)/gu)].map((m) => m[1]);
    for (const name of required) assert.ok(["node:crypto", "node:fs", "node:os", "node:path"].includes(name) || name.startsWith("./"), `${file} requires ${name}`);
  }
});

test("hooks.json runs the one entry, within 5 s, at session start and at the turn end, and no longer after a write", () => {
  const { hooks } = JSON.parse(fs.readFileSync(path.join(HOOKS, "hooks.json"), "utf8"));
  const command = "node ${CLAUDE_PLUGIN_ROOT}/hooks/memory.cjs hook";
  assert.deepEqual(Object.keys(hooks).sort(), ["SessionStart", "Stop"]);
  for (const event of ["SessionStart", "Stop"]) {
    assert.equal(hooks[event][0].hooks[0].command, command, event);
    assert.equal(hooks[event][0].hooks[0].timeout, 5, `${event} declares the contract's 5 s timeout`);
  }
  assert.equal(hooks.Stop[0].hooks[0].statusMessage, "AIDD Context: check memory changes");
});

test("the engine keeps check, sync and hook and has dropped the plan, answer, report and changes commands and their libraries", () => {
  for (const command of ["plan", "answer", "report", "changes"]) {
    const result = spawnSync(process.execPath, [path.join(HOOKS, ENTRY), command], { encoding: "utf8" });
    assert.match(result.stderr, /^usage: memory\.cjs hook \| check \[root\] \[file\.\.\.\] \| sync \[--add\] \[tool\.\.\.\]\n$/u, command);
    assert.equal(result.status, 1, command);
  }
  for (const lib of ["plan", "fact-sheet", "report", "changes", "bank-guard"]) assert.equal(fs.existsSync(path.join(HOOKS, "lib", `${lib}.cjs`)), false, lib);
});
