const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const REPO = path.resolve(__dirname, "../..");
const RUNTIME = path.join(REPO, "cli/assets/hooks-runtime");
const PAYLOADS = path.join(__dirname, "fixtures/hook-payloads");
const HOSTS = ["claude", "codex", "copilot", "cursor", "opencode", "kilo"];
const BRIDGED = new Set(["opencode", "kilo"]);
const SCRUBBED_PROJECT = "/Users/user/project";
const SESSION = "00000000-0000-4000-8000-000000000000";

// The project's own git must never be reached from a temp project.
const ENV = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_") && key !== "CLAUDE_PROJECT_DIR"));

const made = [];
test.after(() => {
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

function tempDir(prefix) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  made.push(dir);
  return dir;
}

/** A plugin's generated hooks folder with one host's adapter where the build puts it, as each tool receives it. */
const installed = new Map();
function hookFor(plugin, host) {
  const key = `${plugin}/${host}`;
  if (!installed.has(key)) {
    const dir = path.join(tempDir(`artifact-hook-${plugin}-${host}-`), "hooks");
    fs.cpSync(path.join(REPO, "plugins", plugin, "hooks"), dir, { recursive: true });
    const adapter = BRIDGED.has(host)
      ? fs.readFileSync(path.join(RUNTIME, "host-bridge.cjs"), "utf8").replace('const HOST = "unstamped";', `const HOST = "${host}";`)
      : fs.readFileSync(path.join(RUNTIME, `host-${host}.cjs`), "utf8");
    fs.writeFileSync(path.join(dir, "lib/host.cjs"), adapter);
    installed.set(key, dir);
  }
  return installed.get(key);
}

const captured = (file, index, root) =>
  JSON.parse(JSON.stringify(JSON.parse(fs.readFileSync(path.join(PAYLOADS, file), "utf8")).samples[index].payload).replaceAll(SCRUBBED_PROJECT, JSON.stringify(root).slice(1, -1)));

const FILES = {
  claude: { start: "claude-SessionStart.json", post: "claude-PostToolUse.json", stop: "claude-Stop.json" },
  codex: { start: "codex-SessionStart.json", post: "codex-PostToolUse.json", stop: "codex-Stop.json" },
  copilot: { start: "copilot-SessionStart.json", post: "copilot-PostToolUse.json", stop: "copilot-Stop.json" },
  cursor: { start: "cursor-sessionStart.json", post: "cursor-postToolUse.json", stop: "cursor-stop.json" },
};
const patch = (rel) => `*** Begin Patch\n*** Add File: ${rel}\n+x\n*** End Patch\n`;

function startPayload(host, root) {
  if (BRIDGED.has(host)) return { hook_event_name: "SessionStart", session_id: SESSION, cwd: root };
  return captured(FILES[host].start, 0, root);
}

/** A PostToolUse writing `rel` (project-relative), in the host's own shape. */
function writePayload(host, root, rel) {
  if (BRIDGED.has(host)) return { hook_event_name: "PostToolUse", session_id: SESSION, cwd: root, tool_name: "write", tool_input: { filePath: path.join(root, rel), content: "x" } };
  const payload = captured(FILES[host].post, 0, root);
  if (host === "codex") payload.tool_input.command = patch(rel);
  else if (host === "copilot") payload.tool_input = patch(rel);
  else payload.tool_input.file_path = path.join(root, rel);
  return payload;
}

/** A PostToolUse running a shell command: no file in it. */
function shellPayload(host, root) {
  if (BRIDGED.has(host)) return { hook_event_name: "PostToolUse", session_id: SESSION, cwd: root, tool_name: "bash", tool_input: { command: "node write.cjs" } };
  return captured(FILES[host].post, 1, root);
}

function stopPayload(host, root, { active = false } = {}) {
  if (BRIDGED.has(host)) return { hook_event_name: "Stop", session_id: SESSION, cwd: root, ...(active ? { stop_hook_active: true } : {}) };
  const payload = captured(FILES[host].stop, 0, root);
  if (active) {
    if (host === "cursor") payload.loop_count = 1;
    else payload.stop_hook_active = true;
  }
  return payload;
}

/** One hook run in its own system temp folder: nothing a run leaves there may reach another. */
function run(plugin, host, goal, payload, { tmp, cwd = os.tmpdir() }) {
  // aidd-context has one Stop entry: memory.cjs answers the turn end and carries the artifacts' findings.
  const args = plugin === "aidd-context" && goal === "check" ? ["memory.cjs", "sync"] : ["artifacts.cjs", goal];
  const result = spawnSync(process.execPath, [path.join(hookFor(plugin, host), args[0]), args[1]], {
    input: typeof payload === "string" ? payload : JSON.stringify(payload),
    encoding: "utf8",
    cwd,
    env: { ...ENV, TMPDIR: tmp, TEMP: tmp, TMP: tmp },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** A session in a fresh project: `files` (project-relative) written over it; each step is one hook run. */
function session(plugin, host, files = {}) {
  const root = tempDir("artifact-project-");
  const tmp = tempDir("artifact-state-");
  const put = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  };
  for (const [rel, text] of Object.entries(files)) put(rel, text);
  const step = (goal, payload) => {
    const result = run(plugin, host, goal, payload, { tmp });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  return {
    root,
    tmp,
    put,
    start: () => step("start", startPayload(host, root)),
    wrote: (rel) => step("mark", writePayload(host, root, rel)),
    shell: () => step("mark", shellPayload(host, root)),
    stop: (options) => step("check", stopPayload(host, root, options)),
    raw: (goal, payload) => run(plugin, host, goal, payload, { tmp }),
  };
}

/** The lines a Stop answered, whatever the host's shape; null when it printed nothing. */
function lines(stdout) {
  if (stdout === "") return null;
  const answer = JSON.parse(stdout);
  assert.equal(stdout.trim().split("\n").length, 1, "one answer per turn");
  return (answer.reason ?? answer.followup_message).split("\n");
}

const PHASE = "aidd_docs/tasks/x/phase-1.md";
const STORY = "aidd_docs/backlog/stories/s.md";
const BROKEN_STORY = "# Story\n";
const GOOD_STORY = "---\ntype: story\nstatus: proposed\n---\n\n# Story: Pay\n\n**As** a buyer\n**I want** to pay\n**So that** I own it\n\n## Acceptance\n\n- the order is paid\n";
const FIXTURE_PLAN = path.join(REPO, "aidd_docs/tasks/2026_11/2026_11_20_artifact-hook");
const GOOD_PHASE = fs.readFileSync(path.join(FIXTURE_PLAN, "phase-1.md"), "utf8").replace(/^status: .*$/mu, "status: pending").replaceAll("✏️", "✅");
const GOOD_PLAN = fs.readFileSync(path.join(FIXTURE_PLAN, "plan.md"), "utf8");
const PLAN = "aidd_docs/tasks/x/plan.md";
const SKIPPED_TEMPLATE = "plugins/aidd-dev/skills/01-plan/assets/plan-template.md";
const past = (file, seconds) => fs.utimesSync(file, new Date(Date.now() - seconds * 1000), new Date(Date.now() - seconds * 1000));

// ---- every host: the write, then the turn end -----------------------------------------------------

for (const host of HOSTS) {
  test(`${host}: a broken phase is answered once at the turn end as file:line rule fix`, () => {
    const s = session("aidd-dev", host, { [PLAN]: "# Plan\n", [PHASE]: "# nope\n" });
    assert.equal(s.start(), "");
    assert.equal(s.wrote(PHASE), "");
    const found = lines(s.stop());
    assert.ok(found.length > 0);
    for (const line of found) assert.match(line, /^aidd_docs\/tasks\/x\/phase-1\.md:\d+ (PLAN|IMPLEMENT)-\d\d \S/u);
    assert.ok(found.some((line) => line.includes("PLAN-02")));
    assert.equal(s.stop(), "", "the mark is consumed");
  });

  test(`${host}: a broken story is answered`, () => {
    const s = session("aidd-pm", host, { [STORY]: BROKEN_STORY });
    s.start();
    s.wrote(STORY);
    assert.ok(lines(s.stop()).every((line) => /^aidd_docs\/backlog\/stories\/s\.md:\d+ STORY-01 \S/u.test(line)));
  });

  test(`${host}: a continuation turn end is silent and consumes the mark`, () => {
    const s = session("aidd-pm", host, { [STORY]: BROKEN_STORY });
    s.start();
    s.wrote(STORY);
    assert.equal(s.stop({ active: true }), "");
    assert.equal(s.stop(), "");
  });
}

test("a broken run.md is answered with an IMPLEMENT finding", () => {
  const s = session("aidd-dev", "claude", { "aidd_docs/tasks/x/plan.md": "---\nstatus: implemented\n---\n\n# Plan\n", "aidd_docs/tasks/x/run.md": "# Run\n\nnothing\n" });
  s.start();
  s.wrote("aidd_docs/tasks/x/run.md");
  assert.ok(lines(s.stop()).some((line) => /^aidd_docs\/tasks\/x\/run\.md:\d+ IMPLEMENT-\d\d /u.test(line)));
});

// ---- silent rows -----------------------------------------------------------------------------------

test("silent: a conforming story, a file no contract claims, a phase with no plan.md above it, a Stop with no write", () => {
  const s = session("aidd-pm", "claude", { [STORY]: GOOD_STORY, "src/a.md": "# x\n" });
  s.start();
  s.wrote(STORY);
  s.wrote("src/a.md");
  assert.equal(s.stop(), "");
  const d = session("aidd-dev", "claude", { [PHASE]: "# nope\n", "aidd_docs/other/x.md": "# nope\n" });
  d.start();
  d.wrote(PHASE);
  d.wrote("aidd_docs/other/x.md");
  assert.equal(d.stop(), "");
  assert.equal(d.stop(), "");
});

test("silent: a conforming phase beside its plan", () => {
  const s = session("aidd-dev", "claude", { [PLAN]: GOOD_PLAN, [PHASE]: GOOD_PHASE });
  s.start();
  s.wrote(PHASE);
  assert.equal(s.stop(), "");
});

test("a finding on a plan.md the turn did not write is dropped", () => {
  const s = session("aidd-dev", "claude", { [PLAN]: GOOD_PLAN, [PHASE]: GOOD_PHASE });
  s.start();
  s.wrote(PHASE);
  assert.equal(s.stop(), "");
});

test("a broken file in scope that no PostToolUse named is not reported", () => {
  const s = session("aidd-pm", "claude", { [STORY]: BROKEN_STORY, "aidd_docs/backlog/stories/t.md": GOOD_STORY });
  s.start();
  s.wrote("aidd_docs/backlog/stories/t.md");
  assert.equal(s.stop(), "");
});

test("a raw template inside a plugin's assets and a generated contract copy are never judged", () => {
  const s = session("aidd-dev", "claude", {
    [SKIPPED_TEMPLATE]: fs.readFileSync(path.join(REPO, SKIPPED_TEMPLATE)),
    "plugins/aidd-dev/hooks/lib/contracts/01-plan/assets/phase-template.md": "# nope\n",
  });
  s.start();
  s.wrote(SKIPPED_TEMPLATE);
  s.wrote("plugins/aidd-dev/hooks/lib/contracts/01-plan/assets/phase-template.md");
  assert.equal(s.stop(), "");
});

test("a Stop with no PostToolUse, garbage stdin, an unknown event and an unwritable TMPDIR are silent and exit 0", () => {
  const s = session("aidd-pm", "claude", { [STORY]: BROKEN_STORY });
  s.start();
  assert.equal(s.stop(), "");
  for (const goal of ["start", "mark", "check"]) for (const payload of ["not json", "{}", { hook_event_name: "Nope" }]) assert.deepEqual(s.raw(goal, payload), { status: 0, stdout: "", stderr: "" });
  const blocked = path.join(tempDir("artifact-blocked-"), "file");
  fs.writeFileSync(blocked, "");
  for (const [goal, payload] of [["start", startPayload("claude", s.root)], ["mark", writePayload("claude", s.root, STORY)], ["check", stopPayload("claude", s.root)]]) {
    const result = run("aidd-pm", "claude", goal, payload, { tmp: blocked });
    assert.deepEqual(result, { status: 0, stdout: "", stderr: "" });
  }
});

// ---- shell writes: found by mtime ------------------------------------------------------------------

test("a shell turn answers the in-scope files modified after the session start, never older ones", () => {
  const s = session("aidd-pm", "claude", { [STORY]: BROKEN_STORY, "aidd_docs/backlog/stories/old.md": BROKEN_STORY });
  past(path.join(s.root, "aidd_docs/backlog/stories/old.md"), 3600);
  s.start();
  past(path.join(s.root, STORY), -60);
  s.shell();
  const found = lines(s.stop());
  assert.ok(found.every((line) => line.startsWith(`${STORY}:`)));
});

test("a shell turn is silent when the broken file predates the reference", () => {
  const s = session("aidd-pm", "claude", { [STORY]: BROKEN_STORY });
  past(path.join(s.root, STORY), 3600);
  s.start();
  s.shell();
  assert.equal(s.stop(), "");
});

test("a file written, then touched by the same turn's shell, is reported once", () => {
  const s = session("aidd-pm", "claude", { [STORY]: BROKEN_STORY });
  s.start();
  s.wrote(STORY);
  past(path.join(s.root, STORY), -60);
  s.shell();
  const found = lines(s.stop());
  assert.equal(new Set(found).size, found.length);
});

test("a shell turn reads each in-scope file once, however deep, though two contracts share the scope", () => {
  const s = session("aidd-dev", "claude");
  const files = 200;
  for (let i = 0; i < files; i += 1) s.put(`aidd_docs/tasks/a/b/c${i % 10}/f${i}.md`, "x");
  s.start();
  s.shell();
  const { atStop } = require(path.join(hookFor("aidd-dev", "claude"), "artifacts.cjs"));
  const statSync = fs.statSync;
  const before = process.env.TMPDIR;
  let stats = 0;
  fs.statSync = (...args) => {
    stats += 1;
    return statSync(...args);
  };
  process.env.TMPDIR = s.tmp;
  try {
    assert.equal(atStop({ sessionId: stopPayload("claude", s.root).session_id, cwd: s.root, stopActive: false }), "");
  } finally {
    fs.statSync = statSync;
    if (before === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = before;
  }
  assert.ok(stats >= files, `the scan ran: ${stats} stats`);
  assert.ok(stats < files + 50, `${stats} stats for ${files} files`);
});

test("a shell turn with no session start has no reference: silent, nothing walked", () => {
  const s = session("aidd-pm", "claude", { [STORY]: BROKEN_STORY });
  s.shell();
  assert.equal(s.stop(), "");
});

test("the reference is the previous turn's end: a file modified before it is not told again", () => {
  const s = session("aidd-pm", "claude", { [STORY]: BROKEN_STORY });
  s.start();
  past(path.join(s.root, STORY), 0);
  s.shell();
  assert.ok(lines(s.stop()));
  s.shell();
  assert.equal(s.stop(), "");
});

// ---- a broken contract, the state folder ------------------------------------------------------------

test("a copied contract made invalid is one line naming it, exit 0", () => {
  const s = session("aidd-pm", "claude", { [STORY]: GOOD_STORY });
  const contract = path.join(hookFor("aidd-pm", "claude"), "lib/contracts/02-user-stories/scripts/contract.json");
  const original = fs.readFileSync(contract, "utf8");
  fs.writeFileSync(contract, original.replace('"version": 1', '"version": 2'));
  try {
    s.start();
    s.wrote(STORY);
    const found = lines(s.stop());
    assert.equal(found.length, 1);
    assert.match(found[0], /^02-user-stories: .*version must be 1/u);
  } finally {
    fs.writeFileSync(contract, original);
  }
});

test("a state folder that is not private is neither written nor read", () => {
  if (typeof process.getuid !== "function") return;
  const s = session("aidd-pm", "claude", { [STORY]: BROKEN_STORY });
  const own = path.join(s.tmp, `aidd-hooks-${process.getuid()}`);
  fs.mkdirSync(own, { mode: 0o755 });
  fs.chmodSync(own, 0o755);
  s.start();
  s.wrote(STORY);
  assert.equal(s.stop(), "");
  assert.deepEqual(fs.readdirSync(own), []);
});

test("a turn end with no write creates no state folder", () => {
  const s = session("aidd-pm", "claude");
  assert.equal(s.stop(), "");
  assert.deepEqual(fs.readdirSync(s.tmp), []);
});

// ---- aidd-context: artifacts ride memory's single Stop entry -------------------------------------------

const MEMORY_FILES = ["project-brief.md", "architecture.md", "coding-assertions.md", "testing.md", "vcs.md", "ecosystem.md"];
const CONTEXT = {
  "aidd_docs/rules/x/r.md": "# nope\n",
  ".claude/agents/a.md": "# nope\n",
  ".claude/commands/c.md": "# nope\n",
  ".claude/skills/s/SKILL.md": "# nope\n",
};
const contextFiles = (extra = {}) => ({ ...Object.fromEntries(MEMORY_FILES.map((name) => [`aidd_docs/memory/${name}`, "# T\n\nShort.\n"])), ...extra });

for (const host of HOSTS) {
  test(`${host}: aidd-context answers the four context artifacts in one answer`, () => {
    const s = session("aidd-context", host, contextFiles(CONTEXT));
    s.start();
    for (const rel of Object.keys(CONTEXT)) s.wrote(rel);
    const found = lines(s.stop());
    for (const id of ["AGENT", "COMMAND", "RULE", "SKILL"]) assert.ok(found.some((line) => line.includes(` ${id}-`)), id);
  });

  test(`${host}: aidd-context stays silent on a continuation and consumes the mark`, () => {
    const s = session("aidd-context", host, contextFiles(CONTEXT));
    s.start();
    s.wrote(".claude/agents/a.md");
    assert.equal(s.stop({ active: true }), "");
    assert.equal(s.stop(), "");
  });
}

test("aidd-context: the shell turn answers the rule modified after the reference, not the older one", () => {
  const s = session("aidd-context", "claude", contextFiles({ "aidd_docs/rules/x/r.md": "# nope\n", "aidd_docs/rules/x/old.md": "# nope\n" }));
  past(path.join(s.root, "aidd_docs/rules/x/old.md"), 3600);
  s.start();
  past(path.join(s.root, "aidd_docs/rules/x/r.md"), -60);
  s.shell();
  const found = lines(s.stop());
  assert.ok(found.length > 0);
  assert.ok(found.every((line) => line.startsWith("aidd_docs/rules/x/r.md:")));
});

test("aidd-context: one answer holds the artifact findings and memory's own text, never two", () => {
  const team = "# P\n\n<!-- aidd_project_memory:start -->\n- Answer in French.\n<!-- aidd_project_memory:end -->\n";
  const s = session("aidd-context", "claude", contextFiles({ "CLAUDE.md": team, ".claude/agents/a.md": "# nope\n" }));
  s.put("aidd_docs/memory/internal/new.md", "# New\n");
  s.start();
  s.wrote(".claude/agents/a.md");
  const found = lines(s.stop());
  assert.ok(found.some((line) => line.startsWith(".claude/agents/a.md:")));
  assert.ok(found.some((line) => line.startsWith("aidd-context: CLAUDE.md holds a line")));
});

test("aidd-context: other hosts' own artifact folders are never judged", () => {
  const files = { ".cursor/rules/x.mdc": "# nope\n", ".github/agents/a.agent.md": "# nope\n", ".codex/prompts/p.toml": "nope\n" };
  const s = session("aidd-context", "claude", contextFiles(files));
  s.start();
  for (const rel of Object.keys(files)) s.wrote(rel);
  assert.equal(s.stop(), "");
});
