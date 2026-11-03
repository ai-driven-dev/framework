const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const HOOKS = path.resolve(__dirname, "../../plugins/aidd-context/hooks");
const HOOK = path.join(HOOKS, "memory-hook.js");
const ENGINE = path.join(HOOKS, "memory-lint.js");
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

test("Claude payload naming a memory file with problems returns them as context", () => {
  inProject({ "a.md": LONG }, (root) => {
    const { status, stdout } = hook({
      hook_event_name: "PostToolUse",
      cwd: root,
      tool_name: "Write",
      tool_input: { file_path: path.join(root, MEMORY, "a.md") },
      tool_response: {},
    });
    assert.equal(status, 0);
    const out = contextOf(stdout);
    assert.equal(out.hookSpecificOutput.hookEventName, "PostToolUse");
    assert.match(out.hookSpecificOutput.additionalContext, /aidd_docs\/memory\/a\.md:3:.*\(M1\)/);
  });
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

test("Codex apply_patch paths resolve against the payload cwd", () => {
  inProject({ "a.md": LONG }, (root) => {
    const command = `*** Begin Patch\n*** Update File: ${MEMORY}/a.md\n@@\n-x\n+y\n*** End Patch`;
    const { status, stdout } = hook({
      hook_event_name: "PostToolUse",
      cwd: root,
      tool_name: "apply_patch",
      tool_input: { command },
      tool_response: {},
    });
    assert.equal(status, 0);
    assert.match(contextOf(stdout).hookSpecificOutput.additionalContext, /\(M1\)/);
  });
});

test("Copilot payload gets a top-level additionalContext", () => {
  inProject({ "a.md": LONG }, (root) => {
    const { status, stdout } = hook({ cwd: root, tool_input: { path: `${MEMORY}/a.md` }, tool_result: {} });
    assert.equal(status, 0);
    const out = contextOf(stdout);
    assert.equal(out.hookSpecificOutput, undefined);
    assert.match(out.additionalContext, /\(M1\)/);
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
    assert.match(contextOf(stdout).hookSpecificOutput.additionalContext, /\(M1\)/);
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

test("more than ten problems print ten lines then one naming the command", () => {
  const text = `# T\n\n${Array(12).fill(words(26)).join("\n\n")}\n`;
  inProject({ "a.md": text }, (root) => {
    const { status, stdout } = hook({ cwd: root, tool_input: { file_path: path.join(root, MEMORY, "a.md") } });
    assert.equal(status, 0);
    const lines = contextOf(stdout).hookSpecificOutput.additionalContext.split("\n");
    assert.equal(lines.filter((line) => line.includes("(M1)")).length, 10);
    assert.equal(lines.length, 11);
    assert.ok(lines[10].includes(`node ${ENGINE} ${root}`));
  });
});

test("errors come before warnings in the capped list", () => {
  const text = `# T\n\n${Array(10).fill(words(26)).join("\n\n")}\n`;
  const warned = `${text}\n- ${words(60)}\n`;
  inProject({ "a.md": warned }, (root) => {
    const { stdout } = hook({ cwd: root, tool_input: { file_path: path.join(root, MEMORY, "a.md") } });
    const lines = contextOf(stdout).hookSpecificOutput.additionalContext.split("\n");
    assert.ok(lines.slice(0, 10).every((line) => line.includes("(M1)")));
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
  for (const file of [HOOK, ENGINE, path.join(HOOKS, "lib/memory-rules.js")]) {
    const required = [...fs.readFileSync(file, "utf8").matchAll(/require\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]);
    for (const name of required) assert.ok(["node:fs", "node:path"].includes(name) || name.startsWith("./"), `${path.basename(file)} requires ${name}`);
  }
});
