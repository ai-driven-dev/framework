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
const TEMPLATES = path.join(REPO, "plugins/aidd-context/skills/02-project-memory/assets/templates/memory");

/** A question of the template named `name`, as a project leaves it when it never answers it. */
function slotOf(name, index = 0) {
  return [...fs.readFileSync(path.join(TEMPLATES, name), "utf8").matchAll(/\{\{[^{}\n]*\}\}/gu)][index][0];
}
const SLOT = slotOf("vcs.md", 2);
const shown = (slot) => (slot.length > 40 ? `${slot.slice(0, 39)}…` : slot);
const SHOWN = shown(SLOT);

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

function samples(file) {
  return JSON.parse(fs.readFileSync(path.join(PAYLOADS, file), "utf8")).samples;
}

/** A captured sample, the scrubbed project pointed at `root` and its written file at `file`. */
function captured(file, index, root, written = SCRUBBED_FILE) {
  // Replaced inside the JSON text, so each value goes in JSON-escaped: a Windows path's backslashes.
  const inJson = (value) => JSON.stringify(value).slice(1, -1);
  const text = JSON.stringify(samples(file)[index].payload)
    .replaceAll(SCRUBBED_PROJECT, inJson(root))
    .replaceAll(SCRUBBED_FILE, inJson(written));
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

/** A run's own system temp folder: every captured payload carries the same scrubbed session id,
 * so nothing a run leaves there may reach another. */
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

/** The host's answer read back as a level and a text, by the key each adapter prints. */
function answerOf(stdout) {
  if (stdout === "") return null;
  const out = JSON.parse(stdout);
  if (out.decision === "block") return { level: 2, text: out.reason };
  const text = out.hookSpecificOutput?.additionalContext ?? out.additionalContext ?? out.additional_context;
  assert.equal(typeof text, "string", stdout);
  return { level: 1, text };
}

// Hosts whose edit says what it wrote and what it replaced; Cursor sends an edit as a whole-file Write.
const EDITS_SAY_WHAT = ["claude", "codex", "copilot", "opencode", "kilo"];

/** Writes `text` at `file` in a full bank, then runs the host's write event for it. */
function afterWrite(host, file, text, options) {
  const root = project({ [file]: text }, options);
  return { root, ...run(host, writePayload(host, root, file, text)) };
}

for (const host of HOSTS) {
  test(`${host}: a write leaving a template slot in vcs.md names line, rule, excerpt and fix, and informs`, () => {
    const { status, stdout } = afterWrite(host, `${MEMORY}/vcs.md`, `# VCS\n\nBranch ${SLOT} here.\n`);
    assert.equal(status, 0);
    const answer = answerOf(stdout);
    assert.equal(answer.level, 1, stdout);
    assert.deepEqual(answer.text.split("\n"), ["aidd-context: 1 error, 0 warnings", `${MEMORY}/vcs.md:3 M3 "${SHOWN}" => fill it from the code`]);
  });

  test(`${host}: a {{ that is no slot of the template, a TODO and a TBD answer nothing`, () => {
    const text = "# VCS\n\n- Publish reads `${{ secrets.NPM_TOKEN }}`.\n- No TODO left in code.\n- TBD\n\n```yaml\ntoken: ${{ secrets.X }}\n```\n";
    assert.equal(afterWrite(host, `${MEMORY}/vcs.md`, text).stdout, "");
  });

  test(`${host}: a 31-word prose line informs and never blocks`, () => {
    const { stdout } = afterWrite(host, `${MEMORY}/vcs.md`, `# VCS\n\n${words(31)}\n`);
    const answer = answerOf(stdout);
    assert.equal(answer.level, 1, stdout);
    assert.match(answer.text, new RegExp(`^${MEMORY}/vcs\\.md:3 M1 "31 words, over the recommended 25" => split it into a list or a table; keep every fact$`, "mu"));
  });

  // The bank's layout belongs to check, never to a write.
  test(`${host}: a file written under memory/kpi/ answers nothing`, () => {
    assert.equal(afterWrite(host, `${MEMORY}/kpi/x.md`, "# KPI\n\nShort.\n").stdout, "");
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
    const root = project({ [`${MEMORY}/vcs.md`]: `# VCS\n\nBranch ${SLOT} here.\n` });
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
    env: { ...ENV, SPY_LOG: log, SPY_ROOT: root, ...tempEnv(dir) },
  });
  return { status: result.status, stdout: result.stdout, paths: fs.readFileSync(log, "utf8").trim() };
}

test("the guard sees a read: a write in the bank does touch the project", () => {
  const root = project();
  assert.notEqual(touched("claude", writePayload("claude", root, `${MEMORY}/vcs.md`), root).paths, "");
});

test("a shell command not naming aidd_docs/ reads nothing of the project", () => {
  const root = project({ [`${MEMORY}/vcs.md`]: `# VCS\n\n${SLOT}\n` });
  assert.deepEqual(touched("claude", shellPayload("claude", root, "ls src > out.txt"), root), { status: 0, stdout: "", paths: "" });
});

test("a shell command writing a bank file reaches that file", () => {
  const root = project({ [`${MEMORY}/vcs.md`]: "# VCS\n\nNow 41 commits.\n" });
  const { stdout } = run("claude", shellPayload("claude", root, `cat > ${MEMORY}/vcs.md <<EOF\nNow 41 commits.\nEOF`));
  assert.match(answerOf(stdout).text, /^aidd_docs\/memory\/vcs\.md:3 M2 warning "41 commits" goes stale => check it against the code; keep it if true$/mu);
});

test("a Claude PowerShell redirect writing a bank file reaches that file", () => {
  const root = project({ [`${MEMORY}/vcs.md`]: "# VCS\n\nNow 41 commits.\n" });
  const payload = captured("claude-PostToolUse.json", 4, root);
  payload.tool_input.command = `"Now 41 commits." > ${MEMORY}/vcs.md`;
  const { stdout } = run("claude", payload);
  assert.match(answerOf(stdout).text, /^aidd_docs\/memory\/vcs\.md:3 M2 warning "41 commits" goes stale => check it against the code; keep it if true$/mu);
});

// A shell write carries no touched lines: its findings inform, grouped, and never block.
test("a shell write of two bank files informs, its errors grouped by rule and folder", () => {
  const root = project({ [`${MEMORY}/vcs.md`]: `# VCS\n\n${SLOT}\n`, [`${MEMORY}/testing.md`]: `# T\n\n${slotOf("testing.md")}\n` });
  const { stdout } = run("claude", shellPayload("claude", root, `sed -i 's/x/y/' ${MEMORY}/vcs.md ${MEMORY}/testing.md`));
  assert.deepEqual(answerOf(stdout), { level: 1, text: "aidd-context: 2 errors, 0 warnings\nM3 ×2 in aidd_docs/memory/* => fill it from the code" });
});

test("a shell write of one bank file groups its errors under that file's name", () => {
  const root = project({ [`${MEMORY}/vcs.md`]: `# VCS\n\n${SLOT}\n\n${SLOT} again\n` });
  const { stdout } = run("claude", shellPayload("claude", root, `sed -i 's/x/y/' ${MEMORY}/vcs.md`));
  assert.deepEqual(answerOf(stdout), { level: 1, text: `aidd-context: 2 errors, 0 warnings\nM3 ×2 in aidd_docs/memory/vcs.md "${SHOWN}" => fill it from the code` });
});

test("a shell read of a bank file just modified reports nothing", () => {
  const root = project({ [`${MEMORY}/vcs.md`]: `# VCS\n\n${SLOT}\n` });
  assert.equal(run("claude", shellPayload("claude", root, `cat ${MEMORY}/vcs.md`)).stdout, "");
});

test("a shell write naming the bank skips a file it did not just change", () => {
  const root = project({ [`${MEMORY}/vcs.md`]: `# VCS\n\n${SLOT}\n` });
  const old = new Date(Date.now() - 60_000);
  for (const name of ALWAYS) fs.utimesSync(path.join(root, MEMORY, name), old, old);
  assert.equal(run("claude", shellPayload("claude", root, `echo x > ${MEMORY}/other.txt.bak`)).stdout, "");
});

// Contract rule 3: only what this write produced. An edit or a patch says what it wrote, and
// only errors on the lines that text now stands on are this write's.
const STANDING = `# VCS\n\n${SLOT}\n\nNow 12 commits.\n\nKept.\n`;

for (const host of EDITS_SAY_WHAT) {
  test(`${host}: an edit adding a clean line to a file holding standing errors answers nothing`, () => {
    const root = project({ [`${MEMORY}/vcs.md`]: STANDING.replace("Kept.", "Short and clean.") });
    assert.deepEqual(run(host, editPayload(host, root, `${MEMORY}/vcs.md`, "Short and clean.")), { status: 0, stdout: "", stderr: "" });
  });

  test(`${host}: an edit reports its own new line only, at its level`, () => {
    const written = `Owner ${SLOT} here.`;
    const root = project({ [`${MEMORY}/vcs.md`]: STANDING.replace("Kept.", written) });
    assert.deepEqual(answerOf(run(host, editPayload(host, root, `${MEMORY}/vcs.md`, written)).stdout), {
      level: 1,
      text: `aidd-context: 1 error, 0 warnings\n${MEMORY}/vcs.md:7 M3 "${SHOWN}" => fill it from the code`,
    });
  });

  test(`${host}: an edit of several lines reports each line it wrote, and none it did not`, () => {
    const root = project({ [`${MEMORY}/vcs.md`]: STANDING.replace("Kept.", "One 2 files.\n\nMiddle.\n\nTwo 5 runs.") });
    const text = answerOf(run(host, editPayload(host, root, `${MEMORY}/vcs.md`, "One 2 files.\n\nMiddle.\n\nTwo 5 runs.")).stdout).text;
    assert.deepEqual(text.split("\n").slice(1), [
      `${MEMORY}/vcs.md:7 M2 warning "2 files" goes stale => check it against the code; keep it if true`,
      `${MEMORY}/vcs.md:11 M2 warning "5 runs" goes stale => check it against the code; keep it if true`,
    ]);
  });
}

for (const host of EDITS_SAY_WHAT) {
  // A context line the edit repeats unchanged is no line it wrote, nor a written line equal to a
  // part of a standing one: only whole lines the write added or changed are its own.
  test(`${host}: a clean line written next to a standing slot line it only resembles answers nothing`, () => {
    const root = project({ [`${MEMORY}/vcs.md`]: `# VCS\n\n- Branch from ${SLOT} later.\n- Branch\n` });
    assert.deepEqual(run(host, editPayload(host, root, `${MEMORY}/vcs.md`, "- Branch", "- Kept")), { status: 0, stdout: "", stderr: "" });
  });

  test(`${host}: an edit repeating an unchanged slot line as context answers nothing`, () => {
    const owner = `- Owner ${SLOT} here.`;
    const root = project({ [`${MEMORY}/vcs.md`]: `# VCS\n\n${owner}\n- Short and clean.\n` });
    const payload = editPayload(host, root, `${MEMORY}/vcs.md`, `${owner}\n- Short and clean.`, `${owner}\n- Kept.`);
    assert.deepEqual(run(host, payload), { status: 0, stdout: "", stderr: "" });
  });

  // Counted as a multiset: a line written twice where it stood once is one more copy, a change.
  test(`${host}: an edit adding a second copy of a line it replaced reports it`, () => {
    const owner = `- Owner ${SLOT} here.`;
    const root = project({ [`${MEMORY}/vcs.md`]: `# VCS\n\n${owner}\n${owner}\n` });
    const payload = editPayload(host, root, `${MEMORY}/vcs.md`, `${owner}\n${owner}`, owner);
    assert.equal(answerOf(run(host, payload).stdout).level, 1);
  });

  test(`${host}: two lines joined into one long line report it`, () => {
    const root = project({ [`${MEMORY}/vcs.md`]: `# VCS\n\n${words(16)} ${words(15)}\n` });
    const answer = answerOf(run(host, editPayload(host, root, `${MEMORY}/vcs.md`, `${words(16)} ${words(15)}`, `${words(16)}\n${words(15)}`)).stdout);
    assert.deepEqual(answer, { level: 1, text: `aidd-context: 1 error, 0 warnings\n${MEMORY}/vcs.md:3 M1 "31 words, over the recommended 25" => split it into a list or a table; keep every fact` });
  });

  // A write that removes lines and adds none can still leave a standing error exposed, a fence
  // deleted around a long line: its lines are unknown, so the file's errors inform, grouped.
  test(`${host}: an edit that only removes lines informs on the file's errors, grouped, and never blocks`, () => {
    const root = project({ [`${MEMORY}/vcs.md`]: `# VCS\n\n${SLOT}\n\nOwner ${SLOT}\n` });
    assert.deepEqual(answerOf(run(host, editPayload(host, root, `${MEMORY}/vcs.md`, "", "```")).stdout), {
      level: 1,
      text: `aidd-context: 2 errors, 0 warnings\nM3 ×2 in aidd_docs/memory/vcs.md "${SHOWN}" => fill it from the code`,
    });
  });
}

for (const host of EDITS_SAY_WHAT) {
  // The edit changed the whole line, though it wrote a part of it.
  test(`${host}: an edit writing a slot inside a line reports that line`, () => {
    const root = project({ [`${MEMORY}/vcs.md`]: `# VCS\n\n- Use ${SLOT} for branches.\n` });
    const answer = answerOf(run(host, editPayload(host, root, `${MEMORY}/vcs.md`, SLOT, "feat/")).stdout);
    assert.deepEqual(answer.text.split("\n").slice(1), [`${MEMORY}/vcs.md:3 M3 "${SHOWN}" => fill it from the code`]);
  });
}

for (const host of EDITS_SAY_WHAT) {
  // A sentence wrapped over two lines is one finding; an edit of its last line touches it.
  test(`${host}: an edit of the last line of a wrapped long sentence reports the sentence`, () => {
    const tail = Array(15).fill("tail").join(" ");
    const root = project({ [`${MEMORY}/vcs.md`]: `# VCS\n\n${words(15)}\n${tail}\n` });
    const answer = answerOf(run(host, editPayload(host, root, `${MEMORY}/vcs.md`, tail, "short")).stdout);
    assert.deepEqual(answer.text.split("\n").slice(1), [`${MEMORY}/vcs.md:3 M1 "30 words, over the recommended 25" => split it into a list or a table; keep every fact`]);
  });
}

// Owner scope: a file another plugin owns is never read, whatever its content.
test("a write under another plugin's folder of aidd_docs/ reads nothing of that file", () => {
  const root = project({ "aidd_docs/ui/x.md": `# UI\n\n${words(31)}\n` });
  const dir = tempDir("memory-hook-reads-");
  const preload = path.join(dir, "reads.js");
  const log = path.join(dir, "log");
  fs.writeFileSync(log, "");
  fs.writeFileSync(preload, `const fs = require("node:fs");\nconst read = fs.readFileSync;\nfs.readFileSync = function (file, ...rest) { if (typeof file === "string") fs.appendFileSync(process.env.READ_LOG, file + "\\n"); return read.call(this, file, ...rest); };\n`);
  const payload = writePayload("claude", root, "aidd_docs/ui/x.md");
  const result = spawnSync(process.execPath, ["--require", preload, hookFor("claude"), "hook"], { input: JSON.stringify(payload), encoding: "utf8", cwd: os.tmpdir(), env: { ...ENV, READ_LOG: log } });
  assert.equal(result.stdout, "");
  assert.doesNotMatch(fs.readFileSync(log, "utf8"), /ui\/x\.md/u);
});

// The project is the one holding the written file's bank, found from its real path.
test("the project is found from the written file, whatever the working folder", () => {
  const root = project({ [`${MEMORY}/vcs.md`]: `# VCS\n\n- ${SLOT}\n`, "src/sub/keep.txt": "" });
  const expected = `aidd-context: 1 error, 0 warnings\n${MEMORY}/vcs.md:3 M3 "${SHOWN}" => fill it from the code`;
  const from = (cwd) => {
    const payload = writePayload("claude", root, `${MEMORY}/vcs.md`);
    payload.cwd = cwd;
    return answerOf(run("claude", payload).stdout)?.text;
  };
  assert.equal(from(path.join(root, "src/sub")), expected, "a working folder inside the project");
  assert.equal(from(os.tmpdir()), expected, "a working folder elsewhere");
  const alias = `${root}-alias`;
  fs.symlinkSync(root, alias);
  assert.equal(from(alias), expected, "a working folder reached through a link");
});

test("a bank nested in the project is the project of its own files", () => {
  const nested = `packages/a/${MEMORY}/vcs.md`;
  const root = project({ ...Object.fromEntries(ALWAYS.map((name) => [`packages/a/${MEMORY}/${name}`, "# T\n\nShort.\n"])), [nested]: `# VCS\n\n- ${SLOT}\n` });
  const payload = writePayload("claude", root, nested);
  assert.equal(answerOf(run("claude", payload).stdout).text.split("\n")[1], `packages/a/${MEMORY}/vcs.md:3 M3 "${SHOWN}" => fill it from the code`);
});

test("a file written through a link is read under its real project", () => {
  const root = project({ [`${MEMORY}/vcs.md`]: `# VCS\n\n- ${SLOT}\n` });
  const alias = `${root}-alias`;
  fs.symlinkSync(root, alias);
  const payload = writePayload("claude", root, `${MEMORY}/vcs.md`);
  payload.tool_input.file_path = path.join(alias, MEMORY, "vcs.md");
  assert.equal(answerOf(run("claude", payload).stdout).text.split("\n")[1], `${MEMORY}/vcs.md:3 M3 "${SHOWN}" => fill it from the code`);
});

// Every line the written text matches counts as touched: an identical line elsewhere raises the
// same findings, so the answer holds nothing this write did not also produce.
test("a written line repeated elsewhere in the file reports each copy, with the same finding", () => {
  const owner = `Owner ${SLOT}`;
  const root = project({ [`${MEMORY}/vcs.md`]: `# VCS\n\n${owner}\n\nKept.\n\n${owner}\n` });
  assert.deepEqual(answerOf(run("claude", editPayload("claude", root, `${MEMORY}/vcs.md`, owner)).stdout).text.split("\n").slice(1), [
    `${MEMORY}/vcs.md:3 M3 "${SHOWN}" => fill it from the code`,
    `${MEMORY}/vcs.md:7 M3 "${SHOWN}" => fill it from the code`,
  ]);
});

test("a Write covers the whole file: every error of it counts, and informs", () => {
  const root = project({ [`${MEMORY}/vcs.md`]: `# VCS\n\n${words(26)}\n\n${SLOT}\n` });
  const answer = answerOf(run("claude", writePayload("claude", root, `${MEMORY}/vcs.md`)).stdout);
  assert.equal(answer.level, 1);
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

test("a dead path in a written bank file informs", () => {
  const root = project({ [`${MEMORY}/vcs.md`]: "# VCS\n\nSee `src/gone.cfg`.\n", "src/here.cfg": "" });
  const answer = answerOf(run("claude", writePayload("claude", root, `${MEMORY}/vcs.md`)).stdout);
  assert.deepEqual(answer, { level: 1, text: 'aidd-context: 1 error, 0 warnings\naidd_docs/memory/vcs.md:3 M4 "src/gone.cfg" => fix the path; keep the fact' });
});

test("an M7 sentence written twice in the bank informs as a warning", () => {
  const sentence = "the quick brown fox jumps over the lazy dog every single morning again";
  const root = project({ [`${MEMORY}/testing.md`]: `# T\n\n${sentence}.\n`, [`${MEMORY}/vcs.md`]: `# VCS\n\n- ${sentence}\n` });
  const answer = answerOf(run("claude", writePayload("claude", root, `${MEMORY}/vcs.md`)).stdout);
  assert.equal(answer.level, 1);
  assert.match(answer.text, /^aidd_docs\/memory\/vcs\.md:3 M7 warning a sentence also written in aidd_docs\/memory\/testing\.md => keep it in one home$/mu);
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
  const root = project({ [`${MEMORY}/vcs.md`]: `# VCS\n\n${SLOT}\n`, "package.json": JSON.stringify({ type: "module" }) });
  fs.cpSync(path.dirname(hookFor("claude")), path.join(root, "hooks"), { recursive: true });
  fs.cpSync(TEMPLATES, path.join(root, "skills/02-project-memory/assets/templates/memory"), { recursive: true });
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
  const root = project({ [`${MEMORY}/vcs.md`]: `# VCS\n\n${SLOT}\n` });
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

test("the entry and its libraries require only the built-ins the contract allows, node:fs, node:os and node:path, and their own modules", () => {
  for (const file of [ENTRY, "lib/memory-rules.cjs", "lib/common-rules.cjs"]) {
    const required = [...fs.readFileSync(path.join(HOOKS, file), "utf8").matchAll(/require\(\s*["']([^"']+)["']\s*\)/gu)].map((m) => m[1]);
    for (const name of required) assert.ok(["node:fs", "node:os", "node:path"].includes(name) || name.startsWith("./"), `${file} requires ${name}`);
  }
});

test("hooks.json runs the one entry, within 5 s, at session start and after a write only, and its matcher names only the tools an adapter reads", () => {
  const { hooks } = JSON.parse(fs.readFileSync(path.join(HOOKS, "hooks.json"), "utf8"));
  const command = "node ${CLAUDE_PLUGIN_ROOT}/hooks/memory.cjs hook";
  assert.deepEqual(Object.keys(hooks).sort(), ["PostToolUse", "SessionStart"], "the memory hook has no turn end");
  for (const event of ["SessionStart", "PostToolUse"]) {
    assert.equal(hooks[event][0].hooks[0].command, command, event);
    assert.equal(hooks[event][0].hooks[0].timeout, 5, `${event} declares the contract's 5 s timeout`);
  }
  // Only the tools an adapter reads: MultiEdit is no Claude Code tool.
  assert.deepEqual(hooks.PostToolUse[0].matcher.split("|").sort(), ["Bash", "Delete", "Edit", "PowerShell", "Shell", "Write", "bash"]);
});

// Cursor filters postToolUse by matcher: a Delete reaches the hook only when the matcher names it.
test("a Cursor Delete of a bank file answers nothing: a missing file is check's, never a write's", () => {
  const root = project({});
  const payload = captured("cursor-postToolUse.json", 5, root);
  payload.tool_input.file_path = path.join(root, MEMORY, "old.md");
  assert.deepEqual(run("cursor", payload), { status: 0, stdout: "", stderr: "" });
});

// ---- the memory hook never answers a turn end: `check` is its one strict gate

const STOP = { claude: "claude-Stop.json", codex: "codex-Stop.json", copilot: "copilot-Stop.json" };

/** What `host` sends at its turn's end. The bridged hosts mirror their bridge: `session.idle`
 * becomes a Stop for the session's folder. */
function stopPayload(host, root) {
  if (!BRIDGED.has(host)) return captured(STOP[host], 0, root);
  const { properties } = captured(`${host}-session.idle.json`, 0, root);
  return { hook_event_name: "Stop", session_id: properties.sessionID, cwd: root, stop_hook_active: false };
}

const SLOT_LINE = `Branch ${SLOT} here.`;
const ASKED = `aidd-context: 1 error, 0 warnings\n${MEMORY}/vcs.md:3 M3 "${SHOWN}" => fill it from the code`;
const VCS = `${MEMORY}/vcs.md`;

for (const host of EDITS_SAY_WHAT) {
  test(`${host}: a Stop after an edit leaving a slot answers nothing: the edit informed, nothing blocks`, () => {
    const root = project({ [VCS]: `# VCS\n\n${SLOT_LINE}\n` });
    const tmp = tempDir("memory-hook-session-");
    assert.equal(answerOf(run(host, editPayload(host, root, VCS, SLOT_LINE), { tmp }).stdout).text, ASKED);
    assert.deepEqual(run(host, stopPayload(host, root), { tmp }), { status: 0, stdout: "", stderr: "" });
  });
}

/** A Claude Write over an existing file: the captured create sample, its response the update of `before`. */
function overwritePayload(root, file, before) {
  const payload = writePayload("claude", root, file);
  payload.tool_response = { ...payload.tool_response, type: "update", originalFile: before };
  return payload;
}

test("a Claude Write over an existing file reports only the line it changed", () => {
  const before = `# VCS\n\n${SLOT}\n\nKept.\n`;
  const after = before.replace("Kept.", words(31));
  const root = project({ [VCS]: after });
  const answer = answerOf(run("claude", overwritePayload(root, VCS, before)).stdout);
  assert.deepEqual(answer.text.split("\n").slice(1).map((line) => line.split(" ").slice(0, 2).join(" ")), [`${VCS}:5 M1`]);
});

test("a Claude Write that changes nothing reports nothing, though the file holds a standing slot", () => {
  const text = `# VCS\n\n${SLOT}\n\nKept.\n`;
  const root = project({ [VCS]: text });
  assert.deepEqual(run("claude", overwritePayload(root, VCS, text)), { status: 0, stdout: "", stderr: "" });
});

test("a shell write reports an error it reached once, as its own", () => {
  const root = project({ [VCS]: `# VCS\n\n${SLOT_LINE}\n` });
  assert.deepEqual(answerOf(run("claude", shellPayload("claude", root, `echo x > ${VCS}`)).stdout), { level: 1, text: ASKED });
});

// A fragment edit never reaches a standing slot that merely holds the same words.
test("an edit writing a part of a standing slot answers nothing: the slot is not its own", () => {
  const root = project({ [VCS]: `# VCS\n\n${SLOT_LINE}\n` });
  assert.equal(run("claude", editPayload("claude", root, VCS, SLOT.slice(2, 14), "x")).stdout, "");
});

test("a slot written in a sub-project bank is named from the project root the session started in", () => {
  const sub = Object.fromEntries(ALWAYS.map((name) => [`cli/${MEMORY}/${name}`, "# T\n\nShort.\n"]));
  const root = project({ ...sub, [`cli/${VCS}`]: `# VCS\n\n${SLOT_LINE}\n` });
  const answer = answerOf(run("claude", editPayload("claude", root, `cli/${VCS}`, SLOT_LINE)).stdout);
  assert.equal(answer.text, ASKED.replace(VCS, `cli/${VCS}`));
});
