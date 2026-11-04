const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const HOOKS = path.resolve(__dirname, "../../plugins/aidd-context/hooks");
const HOOK = path.join(HOOKS, "memory-hook.cjs");
const ENGINE = path.join(HOOKS, "memory-lint.cjs");
const MEMORY = "aidd_docs/memory";
const words = (count) => Array(count).fill("word").join(" ");
const LONG = `# T\n\n${words(26)}\n`;

// Run from inside a Claude Code session, an inherited project dir would redirect the hook.
const ENV = { ...process.env, CLAUDE_PROJECT_DIR: "", CURSOR_PROJECT_DIR: "" };

/** A throwaway project whose bank maps names to texts. */
function project(memory) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "memory-hook-"));
  for (const [name, text] of Object.entries(memory)) {
    const full = path.join(root, MEMORY, name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, text);
  }
  return root;
}

function hook(input, cwd = os.tmpdir()) {
  const result = spawnSync(process.execPath, [HOOK], {
    input: typeof input === "string" ? input : JSON.stringify(input),
    encoding: "utf8",
    cwd,
    env: ENV,
  });
  return { status: result.status, stdout: result.stdout };
}

function inProject(memory, body) {
  const root = project(memory);
  try {
    body(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const contextOf = (stdout) => JSON.parse(stdout);
const textOf = (stdout) => contextOf(stdout).hookSpecificOutput.additionalContext;
const claude = (root, name, toolInput, tool = "Write") => ({
  hook_event_name: "PostToolUse",
  cwd: root,
  tool_name: tool,
  tool_input: { file_path: path.join(root, MEMORY, name), ...toolInput },
  tool_response: {},
});

test("Claude payload naming a memory file with problems returns them as context", () => {
  inProject({ "a.md": LONG }, (root) => {
    const { status, stdout } = hook(claude(root, "a.md", {}));
    assert.equal(status, 0);
    const out = contextOf(stdout);
    assert.equal(out.hookSpecificOutput.hookEventName, "PostToolUse");
    assert.match(out.hookSpecificOutput.additionalContext, /^aidd_docs\/memory\/a\.md:3 M1 \S/);
  });
});

test("the hook loads in a project whose package.json declares an ES module", () => {
  inProject({ "a.md": LONG }, (root) => {
    fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ type: "module" }));
    fs.cpSync(HOOKS, path.join(root, "hooks"), { recursive: true });
    const result = spawnSync(process.execPath, [path.join(root, "hooks", path.basename(HOOK))], {
      input: JSON.stringify(claude(root, "a.md", {})),
      encoding: "utf8",
      cwd: root,
      env: ENV,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(textOf(result.stdout), /M1/);
  });
});

test("an Edit reports its own new line, not the errors the file already held", () => {
  const before = `# T\n\n${words(26)}\n\nSee 3 issues.\n\nKept.\n`;
  const after = before.replace("Kept.", "Now 41 commits.");
  inProject({ "a.md": after }, (root) => {
    const { stdout } = hook(claude(root, "a.md", { old_string: "Kept.", new_string: "Now 41 commits." }, "Edit"));
    assert.equal(textOf(stdout), 'aidd_docs/memory/a.md:7 M2 "41 commits" goes stale: name the thing, not how many');
  });
});

test("a MultiEdit reports the lines of each of its edits only", () => {
  const text = `# T\n\n${words(26)}\n\nOne 2 files.\n\nMiddle.\n\nTwo 5 runs.\n`;
  inProject({ "a.md": text }, (root) => {
    const edits = [{ new_string: "One 2 files." }, { new_string: "Two 5 runs." }];
    const { stdout } = hook(claude(root, "a.md", { edits }, "MultiEdit"));
    assert.deepEqual(textOf(stdout).split("\n"), [
      'aidd_docs/memory/a.md:5 M2 "2 files" goes stale: name the thing, not how many',
      'aidd_docs/memory/a.md:9 M2 "5 runs" goes stale: name the thing, not how many',
    ]);
  });
});

test("a Write with seven problems prints five error lines then the remainder", () => {
  const text = `# T\n\n${Array(7).fill(words(26)).join("\n\n")}\n\n- ${words(60)}\n`;
  inProject({ "a.md": text }, (root) => {
    const { stdout } = hook(claude(root, "a.md", { content: text }));
    const lines = textOf(stdout).split("\n");
    assert.equal(lines.length, 6);
    assert.ok(lines.slice(0, 5).every((entry) => /^aidd_docs\/memory\/a\.md:\d+ M1 /.test(entry)));
    assert.equal(lines[5], `+2 more: node ${ENGINE} ${root}`);
  });
});

test("the cut line leaves out the root when the hook runs in it", () => {
  const text = `# T\n\n${Array(7).fill(words(26)).join("\n\n")}\n\n- ${words(60)}\n`;
  inProject({ "a.md": text }, (made) => {
    const root = fs.realpathSync(made);
    const { stdout } = hook(claude(root, "a.md", { content: text }), root);
    assert.equal(textOf(stdout).split("\n")[5], `+2 more: node ${ENGINE}`);
  });
});

test("a warning alone prints nothing", () => {
  inProject({ "a.md": `# T\n\n- ${words(60)}\n` }, (root) => {
    assert.deepEqual(hook(claude(root, "a.md", {})), { status: 0, stdout: "" });
  });
});

test("a Codex patch checks only the lines it adds", () => {
  const text = `# T\n\n${words(26)}\n\nKept.\n\nNow 41 commits.\n`;
  inProject({ "a.md": text }, (root) => {
    const command = `*** Begin Patch\n*** Update File: ${MEMORY}/a.md\n@@\n Kept.\n-Old.\n+Now 41 commits.\n*** End Patch`;
    const { stdout } = hook({ hook_event_name: "PostToolUse", cwd: root, tool_name: "apply_patch", tool_input: { command }, tool_response: {} });
    assert.equal(textOf(stdout), 'aidd_docs/memory/a.md:7 M2 "41 commits" goes stale: name the thing, not how many');
  });
});

const shell = (root, command, tool = "Bash") => ({ hook_event_name: "PostToolUse", cwd: root, tool_name: tool, tool_input: { command }, tool_response: {} });
const STALE = "# T\n\nNow 41 commits.\n";

test("a shell command writing a bank file reports that file's errors", () => {
  inProject({ "a.md": STALE }, (root) => {
    const { stdout } = hook(shell(root, `cat > ${MEMORY}/a.md <<EOF\nNow 41 commits.\nEOF`));
    assert.equal(textOf(stdout), 'aidd_docs/memory/a.md:3 M2 "41 commits" goes stale: name the thing, not how many');
  });
});

test("a shell command not naming the bank reads nothing", () => {
  inProject({ "a.md": STALE }, (root) => {
    assert.equal(touched(root, shell(root, "ls src")), "");
    assert.deepEqual(hook(shell(root, "ls src")), { status: 0, stdout: "" });
  });
});

test("a shell command naming the bank skips a file it did not just change", () => {
  inProject({ "a.md": STALE }, (root) => {
    const old = new Date(Date.now() - 60_000);
    fs.utimesSync(path.join(root, MEMORY, "a.md"), old, old);
    assert.deepEqual(hook(shell(root, `cat ${MEMORY}/a.md`)), { status: 0, stdout: "" });
  });
});

test("the hook matcher covers the shell tools of Claude Code, Codex, Cursor and Copilot", () => {
  const { hooks } = JSON.parse(fs.readFileSync(path.join(HOOKS, "hooks.json"), "utf8"));
  const names = hooks.PostToolUse[0].matcher.split("|");
  for (const name of ["Bash", "Shell", "bash", "powershell"]) assert.ok(names.includes(name), name);
});

// A preload that logs every path under aidd_docs/ the hook touches through fs.
const SPY = `
const fs = require("node:fs");
for (const name of ["readFileSync", "readdirSync", "statSync", "existsSync", "lstatSync", "openSync"]) {
  const original = fs[name];
  fs[name] = function (target, ...rest) {
    if (typeof target === "string" && target.includes("aidd_docs")) fs.appendFileSync(process.env.SPY_LOG, target + "\\n");
    return original.call(this, target, ...rest);
  };
}
`;

/** The aidd_docs paths the hook touched for one payload. */
function touched(root, payload) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "memory-hook-spy-"));
  const spy = path.join(dir, "spy.js");
  const log = path.join(dir, "log");
  try {
    fs.writeFileSync(spy, SPY);
    fs.writeFileSync(log, "");
    const result = spawnSync(process.execPath, ["--require", spy, HOOK], {
      input: JSON.stringify(payload),
      encoding: "utf8",
      cwd: os.tmpdir(),
      env: { ...ENV, SPY_LOG: log },
    });
    assert.equal(result.status, 0);
    return fs.readFileSync(log, "utf8").trim();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("a path outside the memory folder, or none, never reads the bank; a memory file does", () => {
  inProject({ "a.md": LONG }, (root) => {
    assert.equal(touched(root, { cwd: root, tool_input: { file_path: path.join(root, "src", "x.md") } }), "");
    assert.equal(touched(root, { cwd: root, tool_input: { command: "ls" } }), "");
    assert.notEqual(touched(root, { cwd: root, tool_input: { file_path: path.join(root, MEMORY, "a.md") } }), "");
  });
});

test("Copilot payload gets a top-level additionalContext", () => {
  inProject({ "a.md": LONG }, (root) => {
    const { status, stdout } = hook({ cwd: root, tool_input: { path: `${MEMORY}/a.md` }, tool_result: {} });
    assert.equal(status, 0);
    const out = contextOf(stdout);
    assert.equal(out.hookSpecificOutput, undefined);
    assert.match(out.additionalContext, /M1/);
  });
});

test("Cursor payload takes its root from workspace_roots", () => {
  inProject({ "a.md": LONG }, (root) => {
    const { status, stdout } = hook({
      hook_event_name: "PostToolUse",
      tool_name: "Write",
      tool_input: { file_path: path.join(root, MEMORY, "a.md") },
      workspace_roots: [root],
      cursor_version: "1.0.0",
    });
    assert.equal(status, 0);
    assert.match(textOf(stdout), /M1/);
  });
});

test("a payload with no path prints nothing", () => {
  assert.deepEqual(hook({ hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command: "ls" } }), { status: 0, stdout: "" });
});

test("invalid or absent JSON prints nothing", () => {
  assert.deepEqual(hook("{nope"), { status: 0, stdout: "" });
  assert.deepEqual(hook(""), { status: 0, stdout: "" });
});

test("a missing memory file prints nothing", () => {
  inProject({ "b.md": "# T\n" }, (root) => {
    const result = hook({ cwd: root, tool_input: { file_path: path.join(root, MEMORY, "gone.md") } });
    assert.deepEqual(result, { status: 0, stdout: "" });
  });
});

test("a clean memory file prints nothing", () => {
  inProject({ "a.md": "# T\n\nShort.\n" }, (root) => {
    const result = hook({ cwd: root, tool_input: { file_path: path.join(root, MEMORY, "a.md") } });
    assert.deepEqual(result, { status: 0, stdout: "" });
  });
});

test("an engine that throws prints nothing", () => {
  inProject({ "a.md": LONG }, (root) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "memory-hook-throw-"));
    try {
      const preload = path.join(dir, "throw.js");
      fs.writeFileSync(preload, 'const fs = require("node:fs");\nfs.readdirSync = () => { throw new Error("boom"); };\n');
      const result = spawnSync(process.execPath, ["--require", preload, HOOK], {
        input: JSON.stringify(claude(root, "a.md", {})),
        encoding: "utf8",
        cwd: os.tmpdir(),
        env: ENV,
      });
      assert.deepEqual({ status: result.status, stdout: result.stdout }, { status: 0, stdout: "" });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

test("README.md and internal/ files are ignored", () => {
  inProject({ "README.md": LONG, "internal/x.md": LONG, "a.md": "# T\n" }, (root) => {
    for (const file of ["README.md", "internal/x.md"]) {
      const result = hook({ cwd: root, tool_input: { file_path: path.join(root, MEMORY, file) } });
      assert.deepEqual(result, { status: 0, stdout: "" });
    }
  });
});

test("the hook and the engine require only node:fs, node:path and their own modules", () => {
  for (const file of [HOOK, ENGINE, path.join(HOOKS, "lib/memory-rules.cjs")]) {
    const required = [...fs.readFileSync(file, "utf8").matchAll(/require\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]);
    for (const name of required) assert.ok(["node:fs", "node:path"].includes(name) || name.startsWith("./"), `${path.basename(file)} requires ${name}`);
  }
});

const DIRTY = `# T\n\n${words(26)}\n\nSee 3 issues.\n`;

test("a shell append of a clean line to a file already holding an error reports nothing", () => {
  inProject({ "a.md": `${DIRTY}- clean line\n` }, (root) => {
    assert.deepEqual(hook(shell(root, `printf '%s\\n' '- clean line' >> ${MEMORY}/a.md`)), { status: 0, stdout: "" });
  });
});

test("a shell append of an error line reports that line only", () => {
  inProject({ "a.md": `${DIRTY}Now 41 commits.\n` }, (root) => {
    const { stdout } = hook(shell(root, `echo 'Now 41 commits.' >> ${MEMORY}/a.md`));
    assert.equal(textOf(stdout), 'aidd_docs/memory/a.md:6 M2 "41 commits" goes stale: name the thing, not how many');
  });
});

test("a shell read of a file just modified reports nothing", () => {
  inProject({ "a.md": DIRTY }, (root) => {
    assert.deepEqual(hook(shell(root, `cat ${MEMORY}/a.md`)), { status: 0, stdout: "" });
  });
});

test("a PowerShell command naming the bank with backslashes reports the line it writes", () => {
  inProject({ "a.md": `${DIRTY}Now 41 commits.\n` }, (root) => {
    const { stdout } = hook(shell(root, `Add-Content aidd_docs\\memory\\a.md 'Now 41 commits.'`, "powershell"));
    assert.equal(textOf(stdout), 'aidd_docs/memory/a.md:6 M2 "41 commits" goes stale: name the thing, not how many');
  });
});
