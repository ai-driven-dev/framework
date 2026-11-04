const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { delimiter, dirname, join, resolve } = require("node:path");
const { test } = require("node:test");

const script = resolve(__dirname, "../check-hosts.cjs");
const posixOnly = { skip: process.platform === "win32" };

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

/** A framework of one plugin, one skill and one agent, with stubs standing in for the tools. */
function fixture(stubs) {
  const dir = mkdtempSync(join(tmpdir(), "aidd-check-hosts-test-"));
  const framework = join(dir, "framework");
  write(join(framework, "plugins/aidd-x/.claude-plugin/plugin.json"), "{}\n");
  write(join(framework, "plugins/aidd-x/skills/01-a/SKILL.md"), "---\nname: 01-a\n---\n");
  write(join(framework, "plugins/aidd-x/agents/reviewer.md"), "---\nname: reviewer\n---\n");
  for (const [name, body] of Object.entries(stubs)) {
    write(join(dir, "bin", name), `#!/bin/sh\n[ "$1" = --version ] && exit 0\n${body}\n`);
    chmodSync(join(dir, "bin", name), 0o755);
  }
  mkdirSync(join(dir, "bin"), { recursive: true });
  mkdirSync(join(dir, "home"), { recursive: true });
  return { dir, framework, home: join(dir, "home") };
}

function check({ dir, framework, home }) {
  return spawnSync(process.execPath, [script, "--root", framework], {
    encoding: "utf8",
    env: { HOME: home, PATH: [join(dir, "bin"), "/usr/bin", "/bin"].join(delimiter) },
  });
}

const KILO = (location) => `case "$1 $2" in
  'debug skill') echo '[{"location":"${location}"}]' ;;
  'debug agent') [ "$3" = aidd-x-reviewer ] && echo '{}' || exit 1 ;;
esac`;

test("a tool that is not installed is said so and fails nothing", posixOnly, () => {
  const env = fixture({});
  try {
    const result = check(env);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\| Kilo \| not installed/);
  } finally {
    rmSync(env.dir, { recursive: true, force: true });
  }
});

test("a tool that answers with everything passes, proved by the tool", posixOnly, () => {
  const env = fixture({ kilo: KILO("/h/.config/kilo/skills/aidd-x/01-a/SKILL.md") });
  try {
    const result = check(env);
    assert.equal(result.status, 0, result.stdout);
    assert.match(result.stdout, /\| Kilo \| ✅ 1\/1 \| ➖ none documented \| ✅ 1\/1 \| ✅ 1\/1 \|/);
  } finally {
    rmSync(env.dir, { recursive: true, force: true });
  }
});

test("a skill the tool does not list fails the run and is named", posixOnly, () => {
  const env = fixture({ kilo: KILO("/h/.config/kilo/skills/aidd-x/99-other/SKILL.md") });
  try {
    const result = check(env);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /❌ 0\/1, missing aidd-x\/01-a/);
  } finally {
    rmSync(env.dir, { recursive: true, force: true });
  }
});

test("Cursor is read from its files, and a skill named apart from its folder is missing", posixOnly, () => {
  const env = fixture({ "cursor-agent": "exit 0" });
  const local = join(env.home, ".cursor/plugins/local/aidd-x");
  write(join(local, ".cursor-plugin/plugin.json"), "{}\n");
  write(join(local, "skills/01-a/SKILL.md"), "---\nname: a\n---\n");
  write(join(local, "agents/reviewer.md"), "---\n---\n");
  write(join(env.home, ".cursor/rules/aidd-agents.mdc"), "## Agents\n");
  try {
    const result = check(env);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /\| Cursor \| 🟡 1\/1 \| 🟡 ~\/\.cursor\/rules\/aidd-agents\.mdc \| ❌ 0\/1, missing aidd-x\/01-a \| 🟡 1\/1 \|/);
  } finally {
    rmSync(env.dir, { recursive: true, force: true });
  }
});
