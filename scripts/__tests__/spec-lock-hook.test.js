const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const REPO = path.resolve(__dirname, "../..");
const HOOKS = path.join(REPO, "plugins/aidd-pm/hooks");
const ENTRY = "spec-lock.cjs";
const SPEC = "aidd_docs/tasks/2026_01/2026_01_02_export/spec.md";
const ENV = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));

// The neutral interface every adapter speaks: `readEvent()` gives the event, `refuse()` denies the
// pending tool call. This stand-in reads the neutral event on stdin and denies with exit 2 and a reason.
const NEUTRAL_HOST = `"use strict";
const fs = require("node:fs");
let current;
function readEvent() {
  try { current = JSON.parse(fs.readFileSync(0, "utf8")); } catch { current = undefined; }
  return current;
}
function refuse(reason) {
  if (current?.event !== "PreToolUse") return;
  process.stderr.write(reason);
  process.exitCode = 2;
}
module.exports = { readEvent, refuse, answer() {}, continueTurn() {} };
`;

const made = [];
test.after(() => {
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

function tempDir(prefix) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  made.push(dir);
  return dir;
}

/** The plugin's hooks, with `adapter` as their lib/host.cjs. */
function hooksWith(adapter) {
  const dir = path.join(tempDir("spec-lock-hooks-"), "hooks");
  fs.cpSync(HOOKS, dir, { recursive: true });
  if (adapter !== undefined) fs.writeFileSync(path.join(dir, "lib", "host.cjs"), adapter);
  return dir;
}

/** A project holding `files`, each relative path mapped to its text. */
function project(files) {
  const root = tempDir("spec-lock-project-");
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return root;
}

function run(hooks, root, payload) {
  return spawnSync(process.execPath, [path.join(hooks, ENTRY)], { cwd: root, env: ENV, input: JSON.stringify(payload), encoding: "utf8" });
}

const spec = (status) => `---\nstatus: ${status}\n---\n\n# Export\n\n## Target\n\nExport.\n`;
const before = (root, rel) => ({ event: "PreToolUse", files: [{ path: path.join(root, rel) }], cwd: root });

test("refuses a write to a spec its file declares locked, naming the file", () => {
  const root = project({ [SPEC]: spec("locked") });
  const result = run(hooksWith(NEUTRAL_HOST), root, before(root, SPEC));
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, new RegExp(SPEC.replaceAll("/", "\\/")));
  assert.match(result.stderr, /locked/);
});

test("refuses a write to a locked spec with Windows line endings or a quoted status", () => {
  for (const text of [spec("locked").replaceAll("\n", "\r\n"), spec('"locked"')]) {
    const root = project({ [SPEC]: text });
    assert.equal(run(hooksWith(NEUTRAL_HOST), root, before(root, SPEC)).status, 2, text);
  }
});

test("lets a write through to a draft spec, a new spec, or a file outside the specs", () => {
  const cases = [
    [{ [SPEC]: spec("draft") }, SPEC],
    [{}, SPEC],
    [{ "docs/spec.md": spec("locked") }, "docs/spec.md"],
    [{ [SPEC]: "# Export\n\nstatus: locked\n" }, SPEC],
    [{ [SPEC]: `${spec("draft")}\nstatus: locked\n` }, SPEC],
  ];
  for (const [files, rel] of cases) {
    const root = project(files);
    const result = run(hooksWith(NEUTRAL_HOST), root, before(root, rel));
    assert.deepEqual([result.status, result.stderr], [0, ""], rel);
  }
});

test("does nothing on another event", () => {
  const root = project({ [SPEC]: spec("locked") });
  const result = run(hooksWith(NEUTRAL_HOST), root, { ...before(root, SPEC), event: "PostToolUse" });
  assert.deepEqual([result.status, result.stderr], [0, ""]);
});

test("does nothing under an adapter that does not report the moment before a tool", () => {
  const root = project({ [SPEC]: spec("locked") });
  const payload = { hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: path.join(root, SPEC), content: "x" }, cwd: root };
  const result = run(hooksWith(undefined), root, payload);
  assert.deepEqual([result.status, result.stdout, result.stderr], [0, "", ""]);
});
