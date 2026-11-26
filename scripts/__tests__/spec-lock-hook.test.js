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

test("refuses a call writing several files when any one is a locked spec", () => {
  const root = project({ "docs/notes.md": "notes\n", [SPEC]: spec("locked") });
  const payload = { event: "PreToolUse", files: [{ path: path.join(root, "docs/notes.md") }, { path: path.join(root, SPEC) }], cwd: root };
  assert.equal(run(hooksWith(NEUTRAL_HOST), root, payload).status, 2);
});

test("does nothing on another event", () => {
  const root = project({ [SPEC]: spec("locked") });
  const result = run(hooksWith(NEUTRAL_HOST), root, { ...before(root, SPEC), event: "PostToolUse" });
  assert.deepEqual([result.status, result.stderr], [0, ""]);
});

const ADAPTERS = path.join(REPO, "cli/assets/hooks-runtime");
const PAYLOADS = path.join(REPO, "scripts/__tests__/fixtures/hook-payloads");
const adapter = (host) => fs.readFileSync(path.join(ADAPTERS, `host-${host}.cjs`), "utf8");
const captured = (file) => JSON.parse(fs.readFileSync(path.join(PAYLOADS, file), "utf8")).samples;
const CAPTURED_ROOT = "/Users/user/project";

/** A captured payload, its project folder moved to `root`. */
function rebase(value, root) {
  if (typeof value === "string") return value.replaceAll(CAPTURED_ROOT, root);
  if (Array.isArray(value)) return value.map((item) => rebase(item, root));
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rebase(item, root)]));
  return value;
}

// Every host that reports the moment before a tool, with the run captured from it: its first sample
// is a write to the locked spec the hook refused, its second a file created beside it.
const HOSTS = [
  ["claude", "claude-PreToolUse.json"],
  ["codex", "codex-PreToolUse.json"],
  ["copilot", "copilot-PreToolUse.json"],
  ["antigravity", "antigravity-PreToolUse.json"],
  ["kiro", "kiro-PreToolUse.json"],
];

for (const [host, file] of HOSTS) {
  test(`refuses the write to a locked spec the way ${host} delivers a refusal, and lets the rest through`, () => {
    const [refused, created] = captured(file);
    const root = project({ [SPEC]: spec("locked") });
    const result = run(hooksWith(adapter(host)), root, rebase(refused.payload, root));
    if (refused.hookExit === undefined) {
      assert.deepEqual([result.status, result.stderr, JSON.parse(result.stdout)], [0, "", refused.hookAnswer]);
    } else {
      assert.deepEqual([result.status, result.stdout, result.stderr], [refused.hookExit, "", refused.hookStderr]);
    }
    const draft = project({ [SPEC]: spec("draft") });
    const allowed = run(hooksWith(adapter(host)), draft, rebase(refused.payload, draft));
    assert.deepEqual([allowed.status, allowed.stdout, allowed.stderr], [0, "", ""]);
    const beside = run(hooksWith(adapter(host)), root, rebase(created.payload, root));
    assert.deepEqual([beside.status, beside.stdout, beside.stderr], [0, "", ""]);
  });
}

// Limit: no Cursor payload was captured before a tool, so its adapter does not report it.
test("does nothing under an adapter that does not report the moment before a tool", () => {
  const root = project({ [SPEC]: spec("locked") });
  const [post] = captured("cursor-postToolUse.json");
  const payload = { ...rebase(post.payload, root), hook_event_name: "preToolUse", tool_input: { file_path: path.join(root, SPEC) } };
  const result = run(hooksWith(adapter("cursor")), root, payload);
  assert.deepEqual([result.status, result.stdout, result.stderr], [0, "", ""]);
});
