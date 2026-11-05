const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { delimiter, dirname, join, resolve } = require("node:path");
const { test } = require("node:test");

const script = resolve(__dirname, "../check-hosts.cjs");
const posixOnly = { skip: process.platform === "win32" };
const MARKER = "<!-- aidd_global_instructions:start -->";

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

/** A framework of one plugin, one skill and one agent, with stubs standing in for the tools. */
function fixture(stubs) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "aidd-check-hosts-test-")));
  const framework = join(dir, "framework");
  const home = join(dir, "home");
  write(join(framework, "plugins/aidd-x/.claude-plugin/plugin.json"), "{}\n");
  write(join(framework, "plugins/aidd-x/skills/01-a/SKILL.md"), "---\nname: 01-a\n---\n");
  write(join(framework, "plugins/aidd-x/agents/reviewer.md"), "---\nname: reviewer\n---\n");
  mkdirSync(join(dir, "bin"), { recursive: true });
  mkdirSync(home, { recursive: true });
  for (const [name, body] of Object.entries(stubs(home))) {
    write(join(dir, "bin", name), `#!/bin/sh\n[ "$1" = --version ] && exit 0\n${body}\n`);
    chmodSync(join(dir, "bin", name), 0o755);
  }
  return { dir, framework, home };
}

function check({ dir, framework, home }, root = framework) {
  return spawnSync(process.execPath, [script, "--root", root], {
    encoding: "utf8",
    env: { HOME: home, PATH: [join(dir, "bin"), "/usr/bin", "/bin"].join(delimiter) },
  });
}

function scenario(name, stubs, assertions) {
  test(name, posixOnly, () => {
    const env = fixture(stubs);
    try {
      assertions(env);
    } finally {
      rmSync(env.dir, { recursive: true, force: true });
    }
  });
}

const kilo = (location) => `case "$1 $2" in
  'debug paths') echo "config $HOME/.config/kilo" ;;
  'debug skill') echo '[{"location":"${location}"}]' ;;
  'debug agent') [ "$3" = aidd-x-reviewer ] && echo '{}' || exit 1 ;;
esac`;

const opencode = (paths) => `case "$1 $2" in
  'debug paths') echo "$HOME/.config/opencode" ;;
  'api get') echo '{"data":[${paths.map((path) => `{"path":"${path}"}`).join(",")}]}' ;;
  'debug agents') echo '[{"id":"aidd-x-reviewer"}]' ;;
esac`;

const claude = ({ skills = ["aidd-x:01-a"], plugins = [{ name: "aidd-x" }] } = {}) => {
  const init = JSON.stringify({
    type: "system",
    subtype: "init",
    plugins,
    skills,
    agents: ["aidd-x:reviewer"],
  });
  return `case "$1 $2" in
  'plugin list') echo '[{"id":"aidd-x@aidd-framework","scope":"user","enabled":true}]' ;;
  *) echo '${init}' ;;
esac`;
};

scenario(
  "a tool that is not installed is said so and fails nothing",
  () => ({}),
  (env) => {
    const result = check(env);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\| Kilo \| not installed/);
  }
);

scenario(
  "a checkout with no plugin to expect is refused, never a table of 0/0",
  () => ({ kilo: "exit 0" }),
  (env) => {
    const result = check(env, join(env.dir, "nowhere"));
    assert.equal(result.status, 2);
    assert.match(result.stderr, /No plugin to expect/);
    assert.doesNotMatch(result.stdout, /0\/0/);
  }
);

test("Kilo", posixOnly, async (t) => {
  await t.test("passes when it answers with everything, proved by the tool", () => {
    const env = fixture((home) => ({ kilo: kilo(join(home, ".config/kilo/skills/aidd-x/01-a/SKILL.md")) }));
    try {
      write(join(env.home, ".config/kilo/skills/aidd-x/01-a/SKILL.md"), "x");
      const result = check(env);
      assert.equal(result.status, 0, result.stdout);
      assert.match(result.stdout, /\| Kilo \| ✅ 1\/1 \| ➖ none documented \| ✅ 1\/1 \| ✅ 1\/1 \|/);
    } finally {
      rmSync(env.dir, { recursive: true, force: true });
    }
  });

  await t.test("fails on a skill it lists from elsewhere than its config directory", () => {
    const env = fixture((home) => ({ kilo: kilo(join(home, "elsewhere/aidd-x/01-a/SKILL.md")) }));
    try {
      write(join(env.home, "elsewhere/aidd-x/01-a/SKILL.md"), "x");
      const result = check(env);
      assert.equal(result.status, 1);
      assert.match(result.stdout, /❌ 0\/1, missing aidd-x\/01-a/);
    } finally {
      rmSync(env.dir, { recursive: true, force: true });
    }
  });

  await t.test("fails on a skill it lists whose file is gone: a stale answer proves nothing", () => {
    const env = fixture((home) => ({ kilo: kilo(join(home, ".config/kilo/skills/aidd-x/01-a/SKILL.md")) }));
    try {
      assert.equal(check(env).status, 1);
    } finally {
      rmSync(env.dir, { recursive: true, force: true });
    }
  });
});

test("Claude Code", posixOnly, async (t) => {
  const withInstructions = (env) => write(join(env.home, ".claude/CLAUDE.md"), `${MARKER}\n`);

  await t.test("reads plugins, skills and agents from the session's own init event", () => {
    const env = fixture(() => ({ claude: claude() }));
    try {
      withInstructions(env);
      const result = check(env);
      assert.equal(result.status, 0, result.stdout);
      assert.match(result.stdout, /\| Claude Code \| ✅ 1\/1 \| 🟡 ~\/\.claude\/CLAUDE\.md \| ✅ 1\/1 \| ✅ 1\/1 \|/);
    } finally {
      rmSync(env.dir, { recursive: true, force: true });
    }
  });

  await t.test("compares skills by name: as many other skills do not count", () => {
    const env = fixture(() => ({ claude: claude({ skills: ["totally:other"] }) }));
    try {
      withInstructions(env);
      const result = check(env);
      assert.equal(result.status, 1);
      assert.match(result.stdout, /❌ 0\/1, missing aidd-x:01-a/);
    } finally {
      rmSync(env.dir, { recursive: true, force: true });
    }
  });

  await t.test("fails a plugin enabled in its list that the session did not load", () => {
    const env = fixture(() => ({ claude: claude({ plugins: [] }) }));
    try {
      withInstructions(env);
      assert.match(check(env).stdout, /\| Claude Code \| ❌ 0\/1, missing aidd-x/);
    } finally {
      rmSync(env.dir, { recursive: true, force: true });
    }
  });

  await t.test("does not take a personal Agents heading for the managed block", () => {
    const env = fixture(() => ({ claude: claude() }));
    try {
      write(join(env.home, ".claude/CLAUDE.md"), "## Agents\nmine\n");
      const result = check(env);
      assert.equal(result.status, 1);
      assert.match(result.stdout, /❌ no managed block in ~\/\.claude\/CLAUDE\.md/);
    } finally {
      rmSync(env.dir, { recursive: true, force: true });
    }
  });
});

scenario(
  "Codex reads plugins, instructions and skills from what it would send the model",
  () => ({
    codex: `case "$1 $2" in
  'plugin list') echo '{"installed":[{"name":"aidd-x","marketplaceName":"aidd-framework","installed":true,"enabled":true}]}' ;;
  'debug prompt-input') printf '%s' '[{"content":[{"text":"${MARKER}\\n- aidd-x:01-a: does a"}]}]' ;;
esac`,
  }),
  (env) => {
    write(
      join(env.home, ".codex/agents/aidd-x-reviewer.toml"),
      'name = "aidd-x-reviewer"\ndeveloper_instructions = "x"\n'
    );
    const result = check(env);
    assert.equal(result.status, 0, result.stdout);
    assert.match(result.stdout, /\| Codex \| ✅ 1\/1 \| ✅ in the prompt \| ✅ 1\/1 \| 🟡 1\/1 \|/);
  }
);

scenario(
  "Codex fails an agent file that names another agent",
  () => ({
    codex: `case "$1 $2" in
  'plugin list') echo '{"installed":[]}' ;;
  'debug prompt-input') echo '[]' ;;
esac`,
  }),
  (env) => {
    write(join(env.home, ".codex/agents/aidd-x-reviewer.toml"), 'name = "other"\n');
    assert.match(check(env).stdout, /❌ 0\/1, missing aidd-x-reviewer/);
  }
);

test("Copilot", posixOnly, async (t) => {
  await t.test("lists its agents through a session that sends no prompt", () => {
    const env = fixture((home) => ({
      copilot: `case "$1 $2" in
  'plugin list') echo '[{"name":"aidd-x","marketplace":"aidd-framework","enabled":true}]' ;;
  'instruction list') echo '[{"sourcePath":"${home}/.copilot/copilot-instructions.md"}]' ;;
  'skill list') echo '[{"source":"plugin","enabled":true,"path":"${home}/built/plugins/aidd-x/skills/01-a"}]' ;;
  --acp*) echo '{"id":2,"result":{"configOptions":[{"id":"agent","options":[{"value":"aidd-x:reviewer"}]}]}}' ;;
esac`,
    }));
    try {
      write(join(env.home, ".copilot/copilot-instructions.md"), `${MARKER}\n`);
      write(join(env.home, "built/plugins/aidd-x/skills/01-a/SKILL.md"), "x");
      const result = check(env);
      assert.equal(result.status, 0, result.stdout);
      assert.match(result.stdout, /\| Copilot \| ✅ 1\/1 \| ✅ listed \| ✅ 1\/1 \| ✅ 1\/1 \|/);
    } finally {
      rmSync(env.dir, { recursive: true, force: true });
    }
  });

  await t.test("fails its agents when the session dies without answering", () => {
    const env = fixture(() => ({ copilot: "exit 0" }));
    try {
      assert.match(check(env).stdout, /\| Copilot \| ❌ .*❌ 0\/1, missing aidd-x:reviewer \|/);
    } finally {
      rmSync(env.dir, { recursive: true, force: true });
    }
  });
});

test("OpenCode", posixOnly, async (t) => {
  const present = (env) => {
    write(join(env.home, ".config/opencode/skills/aidd-x/01-a/SKILL.md"), "x");
    write(join(env.home, ".config/opencode/AGENTS.md"), `${MARKER}\n`);
  };

  await t.test("passes when its service lists every skill", () => {
    const env = fixture((home) => ({
      opencode: opencode([join(home, ".config/opencode/skills/aidd-x/01-a/SKILL.md")]),
    }));
    try {
      present(env);
      const result = check(env);
      assert.equal(result.status, 0, result.stdout);
      assert.match(result.stdout, /\| OpenCode \| ✅ 1\/1 \| 🟡 ~\/\.config\/opencode\/AGENTS\.md \| ✅ 1\/1 \| ✅ 1\/1 \|/);
    } finally {
      rmSync(env.dir, { recursive: true, force: true });
    }
  });

  await t.test("reads again while its service starts cold, and gets the whole list", () => {
    const env = fixture((home) => ({
      opencode: `case "$1 $2" in
  'debug paths') echo "$HOME/.config/opencode" ;;
  'api get')
    if [ -f "$HOME/warm" ]; then
      echo '{"data":[{"path":"${home}/.config/opencode/skills/aidd-x/01-a/SKILL.md"}]}'
    else
      : > "$HOME/warm"; echo '{"data":[]}'
    fi ;;
  'debug agents') echo '[{"id":"aidd-x-reviewer"}]' ;;
esac`,
    }));
    try {
      present(env);
      const result = check(env);
      assert.equal(result.status, 0, result.stdout);
    } finally {
      rmSync(env.dir, { recursive: true, force: true });
    }
  });

  await t.test("fails every cell when it answers no config directory, never the checkout's file", () => {
    const env = fixture(() => ({ opencode: "exit 1" }));
    try {
      const result = check(env);
      assert.equal(result.status, 1);
      assert.match(result.stdout, /\| OpenCode \| ❌ no config directory answered \| ❌/);
    } finally {
      rmSync(env.dir, { recursive: true, force: true });
    }
  });
});

test("Cursor is read from its files", posixOnly, async (t) => {
  const install = (env, skill) => {
    const local = join(env.home, ".cursor/plugins/local/aidd-x");
    write(join(local, ".cursor-plugin/plugin.json"), "{}\n");
    write(join(local, "skills/01-a/SKILL.md"), skill);
    write(join(local, "agents/reviewer.md"), "---\ndescription: reviews\n---\nBody\n");
    write(join(env.home, ".cursor/rules/aidd-agents.mdc"), `${MARKER}\n`);
  };
  const failsOnSkill = (skill) => () => {
    const env = fixture(() => ({ "cursor-agent": "exit 0" }));
    try {
      install(env, skill);
      const result = check(env);
      assert.equal(result.status, 1);
      assert.match(result.stdout, /❌ 0\/1, missing aidd-x\/01-a/);
    } finally {
      rmSync(env.dir, { recursive: true, force: true });
    }
  };

  await t.test("and passes a conforming skill", () => {
    const env = fixture(() => ({ "cursor-agent": "exit 0" }));
    try {
      install(env, "---\nname: 01-a\ndescription: does a\n---\n");
      const result = check(env);
      assert.equal(result.status, 0, result.stdout);
      assert.match(result.stdout, /\| Cursor \| 🟡 1\/1 \| 🟡 ~\/\.cursor\/rules\/aidd-agents\.mdc \| 🟡 1\/1 \| 🟡 1\/1 \|/);
    } finally {
      rmSync(env.dir, { recursive: true, force: true });
    }
  });

  await t.test("and fails a name apart from its folder", failsOnSkill("---\nname: a\ndescription: d\n---\n"));
  await t.test("and fails a name that only starts like it", failsOnSkill("---\nname: 01-abc\ndescription: d\n---\n"));
  await t.test("and fails a name found only in the body", failsOnSkill("---\ndescription: d\n---\nname: 01-a\n"));
  await t.test("and fails a skill with no description", failsOnSkill("---\nname: 01-a\n---\n"));
});

scenario(
  "a tool named agent counts as Cursor only when its help says so",
  () => ({ agent: 'echo "Grok Build TUI"' }),
  (env) => {
    assert.match(check(env).stdout, /\| Cursor \| not installed/);
  }
);
