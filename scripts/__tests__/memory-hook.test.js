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
const SCRUBBED_FILE = "notes.md";
const ALWAYS = ["project-brief.md", "architecture.md", "coding-assertions.md", "testing.md", "vcs.md", "ecosystem.md"];
const words = (count) => Array(count).fill("word").join(" ");

// The project's own git must never be reached from a temp project, and a session's project dir never redirects one.
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

/** The plugin's hooks with one host's adapter where the build puts it, as each tool receives them. */
const installed = new Map();
function hookFor(host) {
  if (!installed.has(host)) {
    const dir = path.join(tempDir(`memory-hook-${host}-`), "hooks");
    fs.cpSync(HOOKS, dir, { recursive: true });
    fs.copyFileSync(path.join(RUNTIME, `host-${host}.cjs`), path.join(dir, "lib/host.cjs"));
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

function samples(file) {
  return JSON.parse(fs.readFileSync(path.join(PAYLOADS, file), "utf8")).samples;
}

/** A captured sample, the scrubbed project pointed at `root` and its written file at `file`. */
function captured(file, index, root, written = SCRUBBED_FILE) {
  const text = JSON.stringify(samples(file)[index].payload)
    .replaceAll(SCRUBBED_PROJECT, root)
    .replaceAll(SCRUBBED_FILE, written);
  return JSON.parse(text);
}

// OpenCode and Kilo send no stdin: their bridge runs the hook with a payload built from the
// plugin's arguments. These mirror that mapping (`opencode-hooks-bridge.ts`, read through the
// real bridge by the CLI's `hooks-runtime-bridges.integration.test.ts`).
function bridgedToolCall(call, directory) {
  const args = call.args;
  const toolInput = typeof args?.filePath === "string" ? { ...args, file_path: args.filePath } : args;
  return { hook_event_name: "PostToolUse", session_id: call.sessionID ?? null, cwd: directory, tool_name: call.tool, tool_input: toolInput };
}

function bridgedSessionStart(input) {
  return { hook_event_name: "SessionStart", session_id: null, cwd: input.directory };
}

const BRIDGED = new Set(["opencode", "kilo"]);
const POST_TOOL_USE = { claude: "claude-PostToolUse.json", codex: "codex-PostToolUse.json", copilot: "copilot-PostToolUse.json", cursor: "cursor-postToolUse.json" };
const SESSION_START = { claude: "claude-SessionStart.json", codex: "codex-SessionStart.json", copilot: "copilot-SessionStart.json", cursor: "cursor-sessionStart.json" };

/** A patch adding `text` to `file`, removing `replaced` first, as Codex and Copilot send one. */
function patchOf(file, text, kind = "Add", replaced) {
  const lines = (prefix, body) => (body === undefined || body === "" ? [] : body.replace(/\n$/u, "").split("\n").map((line) => `${prefix}${line}`));
  const hunk = kind === "Update" ? ["@@"] : [];
  return ["*** Begin Patch", `*** ${kind} File: ${file}`, ...hunk, ...lines("-", replaced), ...lines("+", text), "*** End Patch", ""].join("\n");
}

/**
 * What `host` sends after writing `text` at `file` in `root`: its first captured write sample,
 * carrying that text the way the host does. Codex and Copilot send a patch, the others the whole
 * file. With no text, the file's content on disk, or nothing when it is gone.
 */
function writePayload(host, root, file, text) {
  const body = text ?? (fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file), "utf8") : "");
  if (BRIDGED.has(host)) {
    const { call } = captured(`${host}-tool.execute.after.json`, 0, root, file);
    call.args.content = body;
    return bridgedToolCall(call, root);
  }
  const payload = captured(POST_TOOL_USE[host], 0, root, file);
  if (host === "codex") payload.tool_input.command = patchOf(file, body);
  else if (host === "copilot") payload.tool_input = patchOf(file, body);
  else payload.tool_input.content = body;
  return payload;
}

/** What `host` sends after an edit replacing `replaced` in `file` with `written`. */
function editPayload(host, root, file, written, replaced = "Kept.") {
  if (host === "codex" || host === "copilot") {
    const patch = patchOf(file, written, "Update", replaced);
    const payload = captured(POST_TOOL_USE[host], 0, root, file);
    if (host === "codex") payload.tool_input.command = patch;
    else payload.tool_input = patch;
    return payload;
  }
  if (BRIDGED.has(host)) {
    const { call } = captured(`${host}-tool.execute.after.json`, 0, root, file);
    call.tool = "edit";
    call.args = { filePath: call.args.filePath, oldString: replaced, newString: written };
    return bridgedToolCall(call, root);
  }
  const payload = { ...captured(POST_TOOL_USE.claude, 0, root, file), tool_name: "Edit" };
  payload.tool_input = { file_path: path.join(root, file), old_string: replaced, new_string: written };
  return payload;
}

/** What `host` sends after a shell command: its captured shell sample, running `command`. */
function shellPayload(host, root, command) {
  const payload = BRIDGED.has(host)
    ? bridgedToolCall(captured(`${host}-tool.execute.after.json`, 1, root).call, root)
    : captured(POST_TOOL_USE[host], 1, root);
  payload.tool_input.command = command;
  return payload;
}

function sessionStartPayload(host, root) {
  if (BRIDGED.has(host)) return bridgedSessionStart(captured(`${host}-server-init.json`, 0, root));
  return captured(SESSION_START[host], 0, root);
}

function run(host, payload, { cwd = os.tmpdir(), preload } = {}) {
  const args = [...(preload ? ["--require", preload] : []), hookFor(host), "hook"];
  const result = spawnSync(process.execPath, args, {
    input: typeof payload === "string" ? payload : JSON.stringify(payload),
    encoding: "utf8",
    cwd,
    env: ENV,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** The host's answer read back as a level and a text, by the key each adapter prints. */
function answerOf(stdout) {
  if (stdout === "") return null;
  const out = JSON.parse(stdout);
  if (out.decision === "block") return { level: 2, text: out.reason };
  const text = out.hookSpecificOutput?.additionalContext ?? out.additionalContext ?? out.additional_context;
  assert.equal(typeof text, "string", stdout);
  return { level: 1, text };
}

// Hosts where a block after a write reaches the model; elsewhere the adapter informs instead.
const BLOCKS = new Set(["claude", "codex", "copilot"]);
// Hosts whose edit says what it wrote: the others' edits fall back to the shell's rule.
const EDITS_SAY_WHAT = ["claude", "codex", "copilot"];

/** Writes `text` at `file` in a full bank, then runs the host's write event for it. */
function afterWrite(host, file, text, options) {
  const root = project({ [file]: text }, options);
  return { root, ...run(host, writePayload(host, root, file, text)) };
}

for (const host of HOSTS) {
  test(`${host}: a write leaving {{x}} in vcs.md names line, rule, excerpt and fix, and blocks where the write carries the file`, () => {
    const { status, stdout } = afterWrite(host, `${MEMORY}/vcs.md`, "# VCS\n\nBranch {{x}} here.\n");
    assert.equal(status, 0);
    const answer = answerOf(stdout);
    assert.equal(answer.level, BLOCKS.has(host) ? 2 : 1, stdout);
    assert.deepEqual(answer.text.split("\n"), ["aidd-context: 1 errors, 0 warnings", `${MEMORY}/vcs.md:3 M3 "{{x}}" => fill it or remove it`]);
  });

  test(`${host}: a 31-word prose line informs and never blocks`, () => {
    const { stdout } = afterWrite(host, `${MEMORY}/vcs.md`, `# VCS\n\n${words(31)}\n`);
    const answer = answerOf(stdout);
    assert.equal(answer.level, 1, stdout);
    assert.match(answer.text, new RegExp(`^${MEMORY}/vcs\\.md:3 M1 "31 words, over 25" => make it a table, a list or a heading$`, "mu"));
  });

  test(`${host}: a file written under memory/kpi/ informs, naming its move, and never blocks`, () => {
    const { stdout } = afterWrite(host, `${MEMORY}/kpi/x.md`, "# KPI\n\nShort.\n");
    const answer = answerOf(stdout);
    assert.equal(answer.level, 1, stdout);
    assert.match(answer.text, new RegExp(`^${MEMORY}/kpi/x\\.md placement => move ${MEMORY}/kpi/ to ${MEMORY}/internal/kpi/, or to the aidd_docs/ folder of the plugin that owns it$`, "mu"));
  });

  // A missing always-written file belongs to the bank, not to a write: only check names it.
  test(`${host}: a write in the bank while architecture.md is missing answers nothing`, () => {
    const always = ALWAYS.filter((name) => name !== "architecture.md");
    assert.deepEqual(afterWrite(host, `${MEMORY}/vcs.md`, "# VCS\n\nShort.\n", { always }).stdout, "");
  });

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

  test(`${host}: a write outside aidd_docs/ exits before reading anything of the project`, () => {
    const root = project({ "src/x.md": `# X\n\n${words(31)}\n` });
    const read = touched(host, writePayload(host, root, "src/x.md"), root);
    assert.deepEqual(read, { status: 0, stdout: "", paths: "" });
  });

  test(`${host}: a rule that throws answers nothing`, () => {
    const root = project({ [`${MEMORY}/vcs.md`]: "# VCS\n\nBranch {{x}} here.\n" });
    const preload = path.join(tempDir("memory-hook-rule-throws-"), "throw.js");
    const rules = path.join(path.dirname(hookFor(host)), "lib/memory-rules.cjs");
    fs.writeFileSync(preload, `const { RULES } = require(${JSON.stringify(rules)});\nRULES.find((rule) => rule.id === "M3").check = () => { throw new Error("boom"); };\n`);
    assert.deepEqual(run(host, writePayload(host, root, `${MEMORY}/vcs.md`), { preload }), { status: 0, stdout: "", stderr: "" });
  });

  test(`${host}: garbage, empty stdin and an unknown event answer nothing`, () => {
    for (const input of ["{nope", "", JSON.stringify({ hook_event_name: "Nope", cwd: os.tmpdir() })]) {
      assert.deepEqual(run(host, input), { status: 0, stdout: "", stderr: "" }, input);
    }
  });
}

// A preload that logs every path under the project the hook touches through fs.
const SPY = `
const fs = require("node:fs");
for (const name of ["readFileSync", "readdirSync", "statSync", "existsSync", "lstatSync", "openSync", "realpathSync"]) {
  const original = fs[name];
  fs[name] = function (target, ...rest) {
    if (typeof target === "string" && target.startsWith(process.env.SPY_ROOT)) fs.appendFileSync(process.env.SPY_LOG, target + "\\n");
    return original.call(this, target, ...rest);
  };
}
`;

/** The project paths the hook touched for one payload. */
function touched(host, payload, root) {
  const dir = tempDir("memory-hook-spy-");
  const spy = path.join(dir, "spy.js");
  const log = path.join(dir, "log");
  fs.writeFileSync(spy, SPY);
  fs.writeFileSync(log, "");
  const result = spawnSync(process.execPath, ["--require", spy, hookFor(host), "hook"], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    cwd: os.tmpdir(),
    env: { ...ENV, SPY_LOG: log, SPY_ROOT: root },
  });
  return { status: result.status, stdout: result.stdout, paths: fs.readFileSync(log, "utf8").trim() };
}

test("the guard sees a read: a write in the bank does touch the project", () => {
  const root = project();
  assert.notEqual(touched("claude", writePayload("claude", root, `${MEMORY}/vcs.md`), root).paths, "");
});

test("a shell command not naming aidd_docs/ reads nothing of the project", () => {
  const root = project({ [`${MEMORY}/vcs.md`]: "# VCS\n\nTBD\n" });
  assert.deepEqual(touched("claude", shellPayload("claude", root, "ls src > out.txt"), root), { status: 0, stdout: "", paths: "" });
});

test("a shell command writing a bank file reaches that file", () => {
  const root = project({ [`${MEMORY}/vcs.md`]: "# VCS\n\nNow 41 commits.\n" });
  const { stdout } = run("claude", shellPayload("claude", root, `cat > ${MEMORY}/vcs.md <<EOF\nNow 41 commits.\nEOF`));
  assert.match(answerOf(stdout).text, /^aidd_docs\/memory\/vcs\.md:3 M2 "41 commits" => name the thing, not how many$/mu);
});

// A shell write carries no touched lines: its findings inform, grouped, and never block.
test("a shell write of two bank files informs, its errors grouped by rule and folder", () => {
  const root = project({ [`${MEMORY}/vcs.md`]: "# VCS\n\nTBD\n", [`${MEMORY}/testing.md`]: "# T\n\nTBD\n" });
  const { stdout } = run("claude", shellPayload("claude", root, `sed -i 's/x/TBD/' ${MEMORY}/vcs.md ${MEMORY}/testing.md`));
  assert.deepEqual(answerOf(stdout), { level: 1, text: 'aidd-context: 2 errors, 0 warnings\nM3 ×2 in aidd_docs/memory/* "TBD" => fill it or remove it' });
});

test("a shell write of one bank file groups its errors under that file's name", () => {
  const root = project({ [`${MEMORY}/vcs.md`]: "# VCS\n\nTBD\n\nTBD again\n" });
  const { stdout } = run("claude", shellPayload("claude", root, `sed -i 's/x/TBD/' ${MEMORY}/vcs.md`));
  assert.deepEqual(answerOf(stdout), { level: 1, text: 'aidd-context: 2 errors, 0 warnings\nM3 ×2 in aidd_docs/memory/vcs.md "TBD" => fill it or remove it' });
});

test("a shell read of a bank file just modified reports nothing", () => {
  const root = project({ [`${MEMORY}/vcs.md`]: "# VCS\n\nTBD\n" });
  assert.equal(run("claude", shellPayload("claude", root, `cat ${MEMORY}/vcs.md`)).stdout, "");
});

test("a shell write naming the bank skips a file it did not just change", () => {
  const root = project({ [`${MEMORY}/vcs.md`]: "# VCS\n\nTBD\n" });
  const old = new Date(Date.now() - 60_000);
  for (const name of ALWAYS) fs.utimesSync(path.join(root, MEMORY, name), old, old);
  assert.equal(run("claude", shellPayload("claude", root, `echo x > ${MEMORY}/other.txt.bak`)).stdout, "");
});

// Contract rule 3: only what this write produced. An edit or a patch says what it wrote, and
// only errors on the lines that text now stands on are this write's.
const STANDING = "# VCS\n\nTBD\n\nNow 12 commits.\n\nKept.\n";

for (const host of EDITS_SAY_WHAT) {
  test(`${host}: an edit adding a clean line to a file holding standing errors answers nothing`, () => {
    const root = project({ [`${MEMORY}/vcs.md`]: STANDING.replace("Kept.", "Short and clean.") });
    assert.deepEqual(run(host, editPayload(host, root, `${MEMORY}/vcs.md`, "Short and clean.")), { status: 0, stdout: "", stderr: "" });
  });

  test(`${host}: an edit reports its own new line only, at its level`, () => {
    const root = project({ [`${MEMORY}/vcs.md`]: STANDING.replace("Kept.", "Owner {{x}} here.") });
    assert.deepEqual(answerOf(run(host, editPayload(host, root, `${MEMORY}/vcs.md`, "Owner {{x}} here.")).stdout), {
      level: 2,
      text: `aidd-context: 1 errors, 0 warnings\n${MEMORY}/vcs.md:7 M3 "{{x}}" => fill it or remove it`,
    });
  });

  test(`${host}: an edit of several lines reports each line it wrote, and none it did not`, () => {
    const root = project({ [`${MEMORY}/vcs.md`]: STANDING.replace("Kept.", "One 2 files.\n\nMiddle.\n\nTwo 5 runs.") });
    const text = answerOf(run(host, editPayload(host, root, `${MEMORY}/vcs.md`, "One 2 files.\n\nMiddle.\n\nTwo 5 runs.")).stdout).text;
    assert.deepEqual(text.split("\n").slice(1), [
      `${MEMORY}/vcs.md:7 M2 "2 files" => name the thing, not how many`,
      `${MEMORY}/vcs.md:11 M2 "5 runs" => name the thing, not how many`,
    ]);
  });
}

for (const host of EDITS_SAY_WHAT) {
  // A context line the edit repeats unchanged is no line it wrote, nor a written line equal to a
  // part of a standing one: only whole lines the write added or changed are its own.
  test(`${host}: a clean line written next to a standing {{x}} line it only resembles answers nothing`, () => {
    const root = project({ [`${MEMORY}/vcs.md`]: "# VCS\n\n- Branch from {{x}} later.\n- Branch\n" });
    assert.deepEqual(run(host, editPayload(host, root, `${MEMORY}/vcs.md`, "- Branch", "- Kept")), { status: 0, stdout: "", stderr: "" });
  });

  test(`${host}: an edit repeating an unchanged {{x}} line as context answers nothing`, () => {
    const root = project({ [`${MEMORY}/vcs.md`]: "# VCS\n\n- Owner {{x}} here.\n- Short and clean.\n" });
    const payload = editPayload(host, root, `${MEMORY}/vcs.md`, "- Owner {{x}} here.\n- Short and clean.", "- Owner {{x}} here.\n- Kept.");
    assert.deepEqual(run(host, payload), { status: 0, stdout: "", stderr: "" });
  });

  // Counted as a multiset: a line written twice where it stood once is one more copy, a change.
  test(`${host}: an edit adding a second copy of a line it replaced reports it`, () => {
    const root = project({ [`${MEMORY}/vcs.md`]: "# VCS\n\n- Owner {{x}} here.\n- Owner {{x}} here.\n" });
    const payload = editPayload(host, root, `${MEMORY}/vcs.md`, "- Owner {{x}} here.\n- Owner {{x}} here.", "- Owner {{x}} here.");
    assert.equal(answerOf(run(host, payload).stdout).level, 2);
  });

  test(`${host}: two lines joined into one long line report it`, () => {
    const root = project({ [`${MEMORY}/vcs.md`]: `# VCS\n\n${words(16)} ${words(15)}\n` });
    const answer = answerOf(run(host, editPayload(host, root, `${MEMORY}/vcs.md`, `${words(16)} ${words(15)}`, `${words(16)}\n${words(15)}`)).stdout);
    assert.deepEqual(answer, { level: 1, text: `aidd-context: 1 errors, 0 warnings\n${MEMORY}/vcs.md:3 M1 "31 words, over 25" => make it a table, a list or a heading` });
  });

  // A write that removes lines and adds none can still leave a standing error exposed, a fence
  // deleted around a long line: its lines are unknown, so the file's errors inform, grouped.
  test(`${host}: an edit that only removes lines informs on the file's errors, grouped, and never blocks`, () => {
    const root = project({ [`${MEMORY}/vcs.md`]: "# VCS\n\nTBD\n\nOwner TBD\n" });
    assert.deepEqual(answerOf(run(host, editPayload(host, root, `${MEMORY}/vcs.md`, "", "```")).stdout), {
      level: 1,
      text: 'aidd-context: 2 errors, 0 warnings\nM3 ×2 in aidd_docs/memory/vcs.md "TBD" => fill it or remove it',
    });
  });
}

// Every line the written text matches counts as touched: an identical line elsewhere raises the
// same findings, so the answer holds nothing this write did not also produce.
test("a written line repeated elsewhere in the file reports each copy, with the same finding", () => {
  const root = project({ [`${MEMORY}/vcs.md`]: "# VCS\n\nOwner TBD\n\nKept.\n\nOwner TBD\n" });
  assert.deepEqual(answerOf(run("claude", editPayload("claude", root, `${MEMORY}/vcs.md`, "Owner TBD")).stdout).text.split("\n").slice(1), [
    `${MEMORY}/vcs.md:3 M3 "TBD" => fill it or remove it`,
    `${MEMORY}/vcs.md:7 M3 "TBD" => fill it or remove it`,
  ]);
});

// OpenCode and Kilo edits say nothing of what they wrote: the shell's rule, grouped and informing.
for (const host of ["opencode", "kilo"]) {
  test(`${host}: an edit that does not say what it wrote informs, grouped under the file, and never blocks`, () => {
    const root = project({ [`${MEMORY}/vcs.md`]: "# VCS\n\nTBD\n\nShort.\n\nOwner TBD\n" });
    assert.deepEqual(answerOf(run(host, editPayload(host, root, `${MEMORY}/vcs.md`, "Short.")).stdout), {
      level: 1,
      text: 'aidd-context: 2 errors, 0 warnings\nM3 ×2 in aidd_docs/memory/vcs.md "TBD" => fill it or remove it',
    });
  });

  test(`${host}: an edit that does not say what it wrote groups a file's long prose lines into one M1 line`, () => {
    const root = project({ [`${MEMORY}/vcs.md`]: `# VCS\n\n${words(26)}\n\n${words(40)}\n` });
    assert.deepEqual(answerOf(run(host, editPayload(host, root, `${MEMORY}/vcs.md`, "Short.")).stdout), {
      level: 1,
      text: "aidd-context: 2 errors, 0 warnings\nM1 ×2 in aidd_docs/memory/vcs.md => make it a table, a list or a heading",
    });
  });
}

test("a Write covers the whole file: every error of it counts, at its level", () => {
  const root = project({ [`${MEMORY}/vcs.md`]: `# VCS\n\n${words(26)}\n\nTBD\n` });
  const answer = answerOf(run("claude", writePayload("claude", root, `${MEMORY}/vcs.md`)).stdout);
  assert.equal(answer.level, 2);
  assert.deepEqual(answer.text.split("\n").slice(1).map((line) => line.split(" ").slice(0, 2).join(" ")), [`${MEMORY}/vcs.md:3 M1`, `${MEMORY}/vcs.md:5 M3`]);
});

test("warnings are capped at ten, the count line keeping the total", () => {
  const text = `# VCS\n\n${Array(12).fill(`- ${words(36)}`).join("\n")}\n`;
  const { stdout } = afterWrite("claude", `${MEMORY}/vcs.md`, text);
  const lines = answerOf(stdout).text.split("\n");
  assert.equal(lines[0], "aidd-context: 0 errors, 13 warnings");
  assert.equal(lines.length, 11);
  assert.ok(lines.slice(1).every((line) => / M[56] warning /u.test(line)), lines.join("\n"));
});

test("a dead path in a written bank file requires the fix", () => {
  const root = project({ [`${MEMORY}/vcs.md`]: "# VCS\n\nSee `src/gone.cfg`.\n", "src/here.cfg": "" });
  const answer = answerOf(run("claude", writePayload("claude", root, `${MEMORY}/vcs.md`)).stdout);
  assert.deepEqual(answer, { level: 2, text: 'aidd-context: 1 errors, 0 warnings\naidd_docs/memory/vcs.md:3 M4 "src/gone.cfg" => fix the path or remove it' });
});

// A rule that blocks is an error: errors are never capped, so the line the model must fix is printed.
test("an M7 sentence after more than ten warnings blocks, and its line is printed", () => {
  const sentence = "the quick brown fox jumps over the lazy dog every single morning again";
  const bullets = Array.from({ length: 12 }, (_, index) => `- ${words(36, `w${index}`)}`).join("\n");
  const root = project({ [`${MEMORY}/testing.md`]: `# T\n\n${sentence}.\n`, [`${MEMORY}/vcs.md`]: `# VCS\n\n${bullets}\n\n- ${sentence}\n` });
  const answer = answerOf(run("claude", writePayload("claude", root, `${MEMORY}/vcs.md`)).stdout);
  assert.equal(answer.level, 2);
  assert.match(answer.text, /^aidd_docs\/memory\/vcs\.md:16 M7 "aidd_docs\/memory\/testing\.md" => keep it in one home$/mu);
});

test("every rule that blocks is an error, so no capped warning can block", () => {
  const { LEVELS } = require(path.join(HOOKS, ENTRY));
  const { RULES, ERROR } = require(path.join(HOOKS, "lib/memory-rules.cjs"));
  for (const [rule, level] of Object.entries(LEVELS)) {
    if (level !== 2 || rule === "placement") continue;
    assert.equal(RULES.find((candidate) => candidate.id === rule)?.severity, ERROR, `${rule} blocks as a warning`);
  }
});

test("an M7 sentence written twice in the bank requires the fix", () => {
  const sentence = "the quick brown fox jumps over the lazy dog every single morning again";
  const root = project({ [`${MEMORY}/testing.md`]: `# T\n\n${sentence}.\n`, [`${MEMORY}/vcs.md`]: `# VCS\n\n- ${sentence}\n` });
  const answer = answerOf(run("claude", writePayload("claude", root, `${MEMORY}/vcs.md`)).stdout);
  assert.equal(answer.level, 2);
  assert.match(answer.text, /^aidd_docs\/memory\/vcs\.md:3 M7 "aidd_docs\/memory\/testing\.md" => keep it in one home$/mu);
});

test("a clean memory file, a deleted one, README.md and internal/ files answer nothing", () => {
  const root = project({ [`${MEMORY}/README.md`]: `${words(31)}\n`, [`${MEMORY}/internal/x.md`]: `${words(31)}\nTBD\n` });
  for (const file of ["vcs.md", "gone.md", "README.md", "internal/x.md"]) {
    assert.deepEqual(run("claude", writePayload("claude", root, `${MEMORY}/${file}`)), { status: 0, stdout: "", stderr: "" }, file);
  }
});

test("a file another plugin owns under aidd_docs/ is never checked", () => {
  const { stdout } = afterWrite("claude", "aidd_docs/ui/x.md", `# UI\n\n${words(31)}\nTBD\n`);
  assert.equal(stdout, "");
});

test("the hook loads in a project whose package.json declares an ES module", () => {
  const root = project({ [`${MEMORY}/vcs.md`]: "# VCS\n\nTBD\n", "package.json": JSON.stringify({ type: "module" }) });
  fs.cpSync(path.dirname(hookFor("claude")), path.join(root, "hooks"), { recursive: true });
  const result = spawnSync(process.execPath, [path.join(root, "hooks", ENTRY), "hook"], {
    input: JSON.stringify(writePayload("claude", root, `${MEMORY}/vcs.md`)),
    encoding: "utf8",
    cwd: root,
    env: ENV,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(answerOf(result.stdout).text, /M3/u);
});

test("an engine that throws answers nothing", () => {
  const root = project({ [`${MEMORY}/vcs.md`]: "# VCS\n\nTBD\n" });
  const preload = path.join(tempDir("memory-hook-throw-"), "throw.js");
  fs.writeFileSync(preload, 'const fs = require("node:fs");\nfs.readdirSync = () => { throw new Error("boom"); };\n');
  assert.deepEqual(run("claude", writePayload("claude", root, `${MEMORY}/vcs.md`), { preload }), { status: 0, stdout: "", stderr: "" });
});

test("the hook reads its event only through lib/host.cjs and never a host's payload", () => {
  const source = fs.readFileSync(path.join(HOOKS, ENTRY), "utf8");
  assert.match(source, /require\("\.\/lib\/host\.cjs"\)/u);
  for (const field of ["tool_input", "tool_name", "hook_event_name", "workspace_roots", "tool_result", "raw", "CLAUDE_PROJECT_DIR", "CURSOR_PROJECT_DIR", "Begin Patch"]) {
    assert.ok(!source.includes(field), `memory.cjs reads ${field}`);
  }
});

test("the entry and its libraries require only node:fs, node:path and their own modules", () => {
  for (const file of [ENTRY, "lib/memory-rules.cjs", "lib/common-rules.cjs"]) {
    const required = [...fs.readFileSync(path.join(HOOKS, file), "utf8").matchAll(/require\(\s*["']([^"']+)["']\s*\)/gu)].map((m) => m[1]);
    for (const name of required) assert.ok(["node:fs", "node:path"].includes(name) || name.startsWith("./"), `${file} requires ${name}`);
  }
});

test("hooks.json runs the one entry, within 5 s, at session start and after a write, and its matcher names only the tools an adapter reads", () => {
  const { hooks } = JSON.parse(fs.readFileSync(path.join(HOOKS, "hooks.json"), "utf8"));
  const command = "node ${CLAUDE_PLUGIN_ROOT}/hooks/memory.cjs hook";
  for (const event of ["SessionStart", "PostToolUse"]) {
    assert.equal(hooks[event][0].hooks[0].command, command, event);
    assert.equal(hooks[event][0].hooks[0].timeout, 5, `${event} declares the contract's 5 s timeout`);
  }
  // Only the tools an adapter reads: MultiEdit is no Claude Code tool, and no adapter reads PowerShell.
  assert.deepEqual(hooks.PostToolUse[0].matcher.split("|").sort(), ["Bash", "Edit", "Shell", "Write", "bash"]);
});
