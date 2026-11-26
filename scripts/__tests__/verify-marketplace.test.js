const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { delimiter, dirname, join, resolve } = require("node:path");
const { afterEach, beforeEach, test } = require("node:test");
const { cleanEnv } = require("../lib/hook-sandbox.cjs");

const script = resolve(__dirname, "../verify-marketplace.cjs");
const posixOnly = { skip: process.platform === "win32" };
const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
const MANIFESTS = { claude: ".claude-plugin/plugin.json", codex: ".codex-plugin/plugin.json" };

let dir;
let remote;
let log;

beforeEach(() => {
  dir = realpathSync(mkdtempSync(join(tmpdir(), "aidd-verify-marketplace-test-")));
  remote = join(dir, "remote.git");
  log = join(dir, "client.log");
  execFileSync("git", ["init", "--quiet", "--bare", remote], { env: cleanEnv() });
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function git(...args) {
  return execFileSync("git", ["--git-dir", remote, ...args], { encoding: "utf8", env: cleanEnv() }).trim();
}

/** The remote holds `tool`'s branch and, unless `tagged` is false, its release tag, at one commit. */
function publishedRemote(tool, { tagged = true } = {}) {
  const commit = git("commit-tree", EMPTY_TREE, "-m", "x");
  git("update-ref", `refs/heads/${tool}`, commit);
  if (tagged) git("update-ref", `refs/tags/${tool}-v1.0.0`, commit);
  return commit;
}

function source(tool, version = "2.11.0") {
  const root = join(dir, `source-${tool}`);
  write(join(root, "plugins/aidd-context", MANIFESTS[tool] ?? ".cursor-plugin/plugin.json"), JSON.stringify(version === null ? {} : { version }));
  return root;
}

/** A client that logs its arguments and lists `aidd-context` at `listed` once installed. */
function stubClient(name, listed) {
  const entry = {
    claude: [{ id: "aidd-context@aidd-marketplace", scope: "user", enabled: true, version: listed }],
    codex: { installed: [{ name: "aidd-context", marketplaceName: "aidd-marketplace", installed: true, enabled: true, version: listed }] },
  }[name];
  write(
    join(dir, "bin", name),
    `#!/bin/sh\necho "$@" >> '${log}'\n[ "$1 $2" = 'plugin list' ] && echo '${JSON.stringify(entry)}'\nexit 0\n`
  );
  chmodSync(join(dir, "bin", name), 0o755);
}

function verify(tool, version, root) {
  return spawnSync(process.execPath, [script, tool, version, root, remote], {
    encoding: "utf8",
    env: { ...cleanEnv(), PATH: [join(dir, "bin"), process.env.PATH].join(delimiter) },
  });
}

const calls = () => readFileSync(log, "utf8").trim().split("\n");

test("Claude Code adds the stable branch and installs the plugin from the distribution catalog", posixOnly, () => {
  publishedRemote("claude");
  stubClient("claude", "2.11.0");
  const result = verify("claude", "v1.0.0", source("claude"));
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(calls(), [`plugin marketplace add ${remote}#claude`, "plugin install aidd-context@aidd-marketplace", "plugin list --json"]);
  assert.match(result.stdout, /installed aidd-context@aidd-marketplace 2.11.0 from claude/);
});

test("Codex adds the stable branch with --ref and installs with `plugin add`", posixOnly, () => {
  publishedRemote("codex");
  stubClient("codex", "2.11.0");
  const result = verify("codex", "v1.0.0", source("codex"));
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(calls().slice(0, 2), [`plugin marketplace add ${remote} --ref codex`, "plugin add aidd-context@aidd-marketplace"]);
});

test("a branch that moved past the release is installed from the release tag", posixOnly, () => {
  publishedRemote("claude");
  git("update-ref", "refs/heads/claude", git("commit-tree", git("rev-parse", "refs/heads/claude^{tree}"), "-p", git("rev-parse", "refs/heads/claude"), "-m", "newer"));
  stubClient("claude", "2.11.0");
  const result = verify("claude", "v1.0.0", source("claude"));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(calls()[0], `plugin marketplace add ${remote}#claude-v1.0.0`);
});

test("an installed version other than the release's is refused", posixOnly, () => {
  publishedRemote("claude");
  stubClient("claude", "2.10.0");
  const result = verify("claude", "v1.0.0", source("claude"));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /claude installed 2\.10\.0, expected aidd-context 2\.11\.0 from claude/);
});

test("a release whose tag is not on the remote is refused before any client runs", posixOnly, () => {
  publishedRemote("claude", { tagged: false });
  stubClient("claude", "2.11.0");
  const result = verify("claude", "v1.0.0", source("claude"));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Expected refs\/tags\/claude-v1\.0\.0/);
});

test("a plugin manifest with no version is refused", posixOnly, () => {
  publishedRemote("claude");
  stubClient("claude", "2.11.0");
  const result = verify("claude", "v1.0.0", source("claude", null));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /did not generate a version for aidd-context/);
});

test("a tool that publishes no catalog is refused with the usage", posixOnly, () => {
  const result = verify("kimi", "v1.0.0", dir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage: verify-marketplace/);
});
