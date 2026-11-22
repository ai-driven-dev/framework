const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
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
function install(plugin, host, dir) {
  fs.cpSync(path.join(REPO, "plugins", plugin, "hooks"), dir, { recursive: true });
  const adapter = BRIDGED.has(host)
    ? fs.readFileSync(path.join(RUNTIME, "host-bridge.cjs"), "utf8").replace('const HOST = "unstamped";', `const HOST = "${host}";`)
    : fs.readFileSync(path.join(RUNTIME, `host-${host}.cjs`), "utf8");
  fs.writeFileSync(path.join(dir, "lib/host.cjs"), adapter);
  return dir;
}
function hookFor(plugin, host) {
  const key = `${plugin}/${host}`;
  if (!installed.has(key)) installed.set(key, install(plugin, host, path.join(tempDir(`artifact-hook-${plugin}-${host}-`), "hooks")));
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

/** A PostToolUse running a shell command, the captured one unless `command` is given: no file in it. */
function shellPayload(host, root, command) {
  if (BRIDGED.has(host)) return { hook_event_name: "PostToolUse", session_id: SESSION, cwd: root, tool_name: "bash", tool_input: { command: command ?? "node write.cjs" } };
  const payload = captured(FILES[host].post, 1, root);
  if (command !== undefined) payload.tool_input.command = command;
  return payload;
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
function run(plugin, host, goal, payload, { tmp, cwd = os.tmpdir(), dir = hookFor(plugin, host) }) {
  // aidd-context has one Stop entry: memory.cjs answers the turn end and carries the artifacts' findings.
  const args = plugin === "aidd-context" && goal === "check" ? ["memory.cjs", "sync"] : ["artifacts.cjs", goal];
  const result = spawnSync(process.execPath, [path.join(dir, args[0]), args[1]], {
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
    shell: (command) => step("mark", shellPayload(host, root, command)),
    stop: (options) => step("check", stopPayload(host, root, options)),
    raw: (goal, payload) => run(plugin, host, goal, payload, { tmp }),
  };
}

/** The finding lines a Stop answered, after its fix hint, whatever the host's shape; null when it printed nothing. */
function lines(stdout) {
  if (stdout === "") return null;
  const answer = JSON.parse(stdout);
  assert.equal(stdout.trim().split("\n").length, 1, "one answer per turn");
  const [hint, ...found] = (answer.reason ?? answer.followup_message).split("\n");
  assert.match(hint, /^These files break their AIDD contract\. /u, "the answer opens with the fix hint");
  return found;
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

for (const host of ["codex", "cursor", "opencode"]) {
  test(`${host}: a broken run.md is answered with an IMPLEMENT finding`, () => {
    const s = session("aidd-dev", host, { [PLAN]: "---\nstatus: implemented\n---\n\n# Plan\n", "aidd_docs/tasks/x/run.md": "# Run\n\nnothing\n" });
    s.start();
    s.wrote("aidd_docs/tasks/x/run.md");
    assert.ok(lines(s.stop()).some((line) => /^aidd_docs\/tasks\/x\/run\.md:\d+ IMPLEMENT-\d\d /u.test(line)));
  });

  test(`${host}: a shell-written broken story is answered`, () => {
    const s = session("aidd-pm", host, { [STORY]: BROKEN_STORY });
    s.start();
    past(path.join(s.root, STORY), -60);
    s.shell();
    assert.ok(lines(s.stop()).every((line) => line.startsWith(`${STORY}:`)));
  });
}

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
  const files = { [PLAN]: GOOD_PLAN.replace("## Impact", "## Impakt"), [PHASE]: GOOD_PHASE };
  const written = session("aidd-dev", "claude", files);
  written.start();
  written.wrote(PLAN);
  assert.ok(lines(written.stop()).some((line) => line.startsWith(`${PLAN}:`)), "the plan is broken");
  const s = session("aidd-dev", "claude", files);
  s.start();
  s.wrote(PHASE);
  assert.equal(s.stop(), "");
});

test("a broken plan.md written by the model is answered with a PLAN-01 finding", () => {
  const s = session("aidd-dev", "claude", { [PLAN]: "# Plan\n" });
  s.start();
  s.wrote(PLAN);
  assert.ok(lines(s.stop()).some((line) => /^aidd_docs\/tasks\/x\/plan\.md:\d+ PLAN-01 \S/u.test(line)));
});

test("no generated contract scope matches a raw template under a plugin's assets, nor a folder above it", () => {
  const assets = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (dir.split(path.sep).includes("assets")) assets.push(path.relative(REPO, file).split(path.sep).join("/"));
    }
  };
  for (const plugin of fs.readdirSync(path.join(REPO, "plugins"))) {
    const skills = path.join(REPO, "plugins", plugin, "skills");
    if (!fs.existsSync(skills)) continue;
    for (const skill of fs.readdirSync(skills)) if (fs.existsSync(path.join(skills, skill, "assets"))) walk(path.join(skills, skill, "assets"));
  }
  assert.ok(assets.length > 0);
  let globs = 0;
  for (const plugin of ["aidd-context", "aidd-dev", "aidd-pm"]) {
    const root = path.join(REPO, "plugins", plugin, "hooks/lib/contracts");
    for (const name of fs.readdirSync(root).filter((entry) => entry !== "lib")) {
      const contract = JSON.parse(fs.readFileSync(path.join(root, name, "scripts/contract.json"), "utf8"));
      const { globRegex } = require(path.join(root, "lib/engine.cjs"));
      for (const glob of contract.scope ?? []) {
        globs += 1;
        const regex = globRegex(glob);
        for (const rel of assets) for (let at = rel; at !== "."; at = path.posix.dirname(at)) assert.equal(regex.test(at), false, `${glob} matches ${at}`);
      }
    }
  }
  assert.ok(globs > 0);
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
  // os.tmpdir() reads TMPDIR on POSIX, TEMP/TMP on Windows
  const TEMP_VARS = ["TMPDIR", "TEMP", "TMP"];
  const before = TEMP_VARS.map((name) => process.env[name]);
  let stats = 0;
  fs.statSync = (...args) => {
    stats += 1;
    return statSync(...args);
  };
  for (const name of TEMP_VARS) process.env[name] = s.tmp;
  try {
    assert.equal(atStop({ sessionId: stopPayload("claude", s.root).session_id, cwd: s.root, stopActive: false }), "");
  } finally {
    fs.statSync = statSync;
    TEMP_VARS.forEach((name, i) => {
      if (before[i] === undefined) delete process.env[name];
      else process.env[name] = before[i];
    });
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

test("a compaction's second start keeps the reference: a shell write before it is still answered", () => {
  const s = session("aidd-pm", "claude", { [STORY]: BROKEN_STORY });
  s.start();
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
  s.put(STORY, BROKEN_STORY);
  s.shell();
  s.start();
  assert.ok(lines(s.stop()).every((line) => line.startsWith(`${STORY}:`)));
});

test("a bad entry in scope does not silence the turn: a dangling link, an unreadable folder", (t) => {
  const s = session("aidd-dev", "claude", { [PLAN]: "# Plan\n", [PHASE]: "# nope\n" });
  try {
    fs.symlinkSync("/nonexistent", path.join(s.root, "aidd_docs/gone.md"));
  } catch {
    t.skip("symlinks cannot be created here");
    return;
  }
  const locked = path.join(s.root, "aidd_docs/locked");
  s.put("aidd_docs/locked/x.md", "x");
  const lock = typeof process.getuid === "function" && process.getuid() !== 0;
  if (lock) fs.chmodSync(locked, 0o000);
  try {
    s.start();
    s.wrote(PHASE);
    s.shell();
    assert.ok(lines(s.stop()).some((line) => line.includes(" PLAN-02 ")));
  } finally {
    if (lock) fs.chmodSync(locked, 0o700);
  }
});

test("a custom check that throws on a file names the file, the contract and the message", () => {
  const s = session("aidd-pm", "claude", { [STORY]: BROKEN_STORY });
  const engine = path.join(hookFor("aidd-pm", "claude"), "lib/contracts/lib/engine.cjs");
  const original = fs.readFileSync(engine, "utf8");
  fs.writeFileSync(engine, `${original}\nmodule.exports.check = () => {\n  throw new Error("boom");\n};\n`);
  try {
    s.start();
    s.wrote(STORY);
    assert.deepEqual(lines(s.stop()), [`${STORY}: 02-user-stories: boom`]);
  } finally {
    fs.writeFileSync(engine, original);
  }
});

/** Hook runs of one session, sharing one project and one system temp folder, in installs placed by `dirs` (plugin to folder). */
function shared(dirs) {
  const root = tempDir("artifact-project-");
  const tmp = tempDir("artifact-state-");
  fs.mkdirSync(path.join(root, path.dirname(STORY)), { recursive: true });
  fs.writeFileSync(path.join(root, STORY), BROKEN_STORY);
  const at = (plugin, goal, payload) => {
    const result = run(plugin, "claude", goal, payload, { tmp, dir: dirs[plugin] });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  return { root, at };
}

const LAYOUTS = {
  flat: (base, plugin) => path.join(base, ".claude/hooks", plugin),
  "plugin install": (base, plugin) => path.join(base, ".claude/plugins/cache/aidd", plugin, "2.8.0/hooks"),
};
for (const [layout, place] of Object.entries(LAYOUTS)) {
  for (const order of [["aidd-pm", "aidd-dev"], ["aidd-dev", "aidd-pm"]]) {
    test(`${layout}: two plugins marking the same story keep their own state, Stops in ${order.join(", ")} order`, () => {
      const base = tempDir("artifact-install-");
      const dirs = Object.fromEntries(["aidd-pm", "aidd-dev"].map((plugin) => [plugin, install(plugin, "claude", place(base, plugin))]));
      const s = shared(dirs);
      for (const plugin of ["aidd-pm", "aidd-dev"]) s.at(plugin, "start", startPayload("claude", s.root));
      for (const plugin of ["aidd-pm", "aidd-dev"]) s.at(plugin, "mark", writePayload("claude", s.root, STORY));
      const answers = Object.fromEntries(order.map((plugin) => [plugin, s.at(plugin, "check", stopPayload("claude", s.root))]));
      assert.ok(lines(answers["aidd-pm"]).every((line) => line.startsWith(`${STORY}:`)));
    });
  }
}

/** One hook run that does not block the test: parallel tool calls run their hooks at the same time. */
function runAsync(plugin, goal, payload, tmp) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(hookFor(plugin, "claude"), "artifacts.cjs"), goal], { cwd: os.tmpdir(), env: { ...ENV, TMPDIR: tmp, TEMP: tmp, TMP: tmp } });
    child.on("close", resolve);
    child.stdin.end(JSON.stringify(payload));
  });
}

test("marks written by parallel tool calls are all judged", async () => {
  const names = Array.from({ length: 4 }, (_, i) => `aidd_docs/backlog/stories/p${i}.md`);
  const s = session("aidd-pm", "claude", Object.fromEntries(names.map((rel) => [rel, BROKEN_STORY])));
  s.start();
  await Promise.all(names.map((rel) => runAsync("aidd-pm", "mark", writePayload("claude", s.root, rel), s.tmp)));
  const found = lines(s.stop());
  for (const rel of names) assert.ok(found.some((line) => line.startsWith(`${rel}:`)), rel);
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

// Only the hosts whose writer output passes the shared contract unchanged are in scope.
test("aidd-context: answers an agent or command written for another host in scope, not one out of scope", () => {
  const inScope = [".cursor/agents/a.md", ".github/prompts/c.prompt.md", ".opencode/commands/c.md", ".kilo/commands/c.md"];
  const outOfScope = [".opencode/agents/a.md", ".cursor/commands/c.md"];
  const all = [...inScope, ...outOfScope];
  const s = session("aidd-context", "claude", contextFiles(Object.fromEntries(all.map((rel) => [rel, "# nope\n"]))));
  s.start();
  for (const rel of all) s.wrote(rel);
  const found = lines(s.stop());
  for (const rel of inScope) assert.ok(found.some((line) => line.startsWith(`${rel}:`)), rel);
  for (const rel of outOfScope) assert.ok(!found.some((line) => line.startsWith(`${rel}:`)), rel);
});

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

test("aidd-context: a shell turn naming none of them never answers skills, agents or commands, which an install writes", () => {
  const files = { ".claude/skills/s/SKILL.md": "# nope\n", ".claude/agents/a.md": "# nope\n", ".claude/commands/c.md": "# nope\n" };
  const s = session("aidd-context", "claude", contextFiles(files));
  s.start();
  for (const rel of Object.keys(files)) past(path.join(s.root, rel), -60);
  s.shell();
  assert.equal(s.stop(), "");
});

const SKILL = ".claude/skills/s/SKILL.md";
const heredoc = (rel) => `mkdir -p ${path.posix.dirname(rel)} && cat > ${rel} <<'EOF'\n# nope\nEOF`;

for (const host of HOSTS) {
  test(`${host}: aidd-context answers a skill, an agent and a command a shell command names and wrote`, () => {
    const files = { [SKILL]: "# nope\n", ".claude/agents/a.md": "# nope\n", ".claude/commands/c.md": "# nope\n" };
    const s = session("aidd-context", host, contextFiles(files));
    s.start();
    for (const rel of Object.keys(files)) past(path.join(s.root, rel), -60);
    s.shell(Object.keys(files).map(heredoc).join(" && "));
    const found = lines(s.stop());
    for (const id of ["AGENT", "COMMAND", "SKILL"]) assert.ok(found.some((line) => line.includes(` ${id}-`)), id);
  });
}

test("aidd-context: an install's command names no file: the skills it wrote stay silent", () => {
  const s = session("aidd-context", "claude", contextFiles({ [SKILL]: "# nope\n" }));
  s.start();
  past(path.join(s.root, SKILL), -60);
  s.shell("npx @ai-driven-dev/cli setup --ide claude");
  assert.equal(s.stop(), "");
});

test("aidd-context: a skill a command names but did not change since the reference is silent", () => {
  const s = session("aidd-context", "claude", contextFiles({ [SKILL]: "# nope\n" }));
  past(path.join(s.root, SKILL), 3600);
  s.start();
  s.shell(`cat ${SKILL}`);
  assert.equal(s.stop(), "");
});

test("aidd-context: a skill named with Windows separators, or by its absolute path, is answered", () => {
  for (const name of [(root) => SKILL.replaceAll("/", "\\"), (root) => path.join(root, SKILL)]) {
    const s = session("aidd-context", "claude", contextFiles({ [SKILL]: "# nope\n" }));
    s.start();
    past(path.join(s.root, SKILL), -60);
    s.shell(`Set-Content ${name(s.root)} '# nope'`);
    assert.ok(lines(s.stop()).some((line) => line.startsWith(`${SKILL}:`)));
  }
});

test("aidd-context: a command naming a skill in one call is still read when another call of the turn names none", () => {
  const s = session("aidd-context", "claude", contextFiles({ [SKILL]: "# nope\n" }));
  s.start();
  past(path.join(s.root, SKILL), -60);
  s.shell(heredoc(SKILL));
  s.shell("echo done");
  assert.ok(lines(s.stop()).some((line) => line.startsWith(`${SKILL}:`)));
});

test("aidd-context: a skill the model wrote is still answered after a shell turn", () => {
  const s = session("aidd-context", "claude", contextFiles({ ".claude/skills/s/SKILL.md": "# nope\n" }));
  s.start();
  s.wrote(".claude/skills/s/SKILL.md");
  s.shell();
  assert.ok(lines(s.stop()).some((line) => line.startsWith(".claude/skills/s/SKILL.md:")));
});

test("a Stop answer holds at most 20 finding lines, then one line counting the rest", () => {
  const rels = Array.from({ length: 30 }, (_, i) => `aidd_docs/backlog/stories/s${i}.md`);
  const s = session("aidd-pm", "claude", Object.fromEntries(rels.map((rel) => [rel, BROKEN_STORY])));
  s.start();
  for (const rel of rels) s.wrote(rel);
  const found = lines(s.stop());
  assert.equal(found.length, 21);
  assert.match(found[20], /^\+\d+ more: run the skill's validate script$/u);
  assert.ok(found.slice(0, 20).every((line) => /^aidd_docs\/backlog\/stories\/s\d+\.md:/u.test(line)));
});

test("a Stop answer of 20 finding lines or fewer is never cut", () => {
  const rels = Array.from({ length: 2 }, (_, i) => `aidd_docs/backlog/stories/s${i}.md`);
  const s = session("aidd-pm", "claude", Object.fromEntries(rels.map((rel) => [rel, BROKEN_STORY])));
  s.start();
  for (const rel of rels) s.wrote(rel);
  const found = lines(s.stop());
  assert.ok(found.length > 0 && found.length <= 20);
  assert.ok(found.every((line) => !line.startsWith("+")));
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
