const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { delimiter, join, resolve } = require("node:path");
const test = require("node:test");

const repo = resolve(__dirname, "../..");
const devAgents = ["checker.md", "executor.md"];
const buildDevAgents = devAgents.map((name) => `printf '%s\\n' 'updated agent' > "$out/.opencode/agents/aidd-dev-${name}"`).join("\n");

function executable(path, body) {
  writeFileSync(path, `#!/bin/sh\nset -eu\n${body}\n`);
  chmodSync(path, 0o755);
}

function fixture(home) {
  const source = join(home, "framework");
  if (!existsSync(source)) {
    for (const [plugin, skill, agents] of [["aidd-dev", "01-plan", devAgents], ["aidd-pm", "03-prd", []]]) {
      const pluginDir = join(source, "plugins", plugin);
      mkdirSync(join(pluginDir, ".claude-plugin"), { recursive: true });
      writeFileSync(join(pluginDir, ".claude-plugin/plugin.json"), "{}\n");
      mkdirSync(join(pluginDir, "skills", skill), { recursive: true });
      writeFileSync(join(pluginDir, "skills", skill, "SKILL.md"), "source skill\n");
      for (const name of agents) {
        mkdirSync(join(pluginDir, "agents"), { recursive: true });
        writeFileSync(join(pluginDir, "agents", name), "source agent\n");
      }
    }
  }
  return source;
}

/** On POSIX, nothing but the stubs and the platform's own utilities, so a real `opencode` or
 * `claude` installed on the machine running these tests can never answer in their place.
 * Windows has neither directory, and the utilities `dev-sync.sh` calls live wherever Git for
 * Windows put them, so there the inherited `PATH` is kept with the stubs merely first. */
const BASE_PATH =
  process.platform === "win32" ? (process.env.PATH ?? "") : ["/usr/bin", "/bin"].join(delimiter);

function runSync(fakeBin, home, args = ["all"]) {
  // `bash`, resolved on PATH, never the literal `/bin/bash`: that path does not exist on
  // Windows, where bash is the one Git for Windows ships. `spawnSync` resolves a bare name
  // through the platform's own rules on both.
  return spawnSync("bash", [join(repo, "scripts/dev-sync.sh"), ...args], {
    cwd: repo,
    env: {
      ...process.env,
      PATH: [fakeBin, BASE_PATH].join(delimiter),
      HOME: home,
      FW: fixture(home),
      BUILD: join(home, "build"),
      CODEX_CACHE: join(home, ".codex/plugins/cache"),
      CLAUDE_CACHE: join(home, ".claude/plugins/cache"),
      CODEX_AGENTS: join(home, ".codex/agents"),
      OPENCODE_SKILLS: join(home, ".config/opencode/skills"),
      OPENCODE_AGENTS: join(home, ".config/opencode/agents"),
    },
    encoding: "utf8",
  });
}

test("managed OpenCode reload uses the fixed-purpose helper without a local build", () => {
  const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-managed-"));
  try {
    const fakeBin = join(root, "bin");
    const home = join(root, "home");
    mkdirSync(fakeBin);
    mkdirSync(home);
    executable(join(fakeBin, "aidd-opencode-reload"), 'echo "managed:ok"');

    const result = runSync(fakeBin, home);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /reload opencode\s+managed:ok/);
    assert.equal(existsSync(join(home, "build")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

for (const layout of ["flat", "nested"]) {
  test(`local OpenCode reload refreshes only the selected plugin using ${layout} output`, () => {
    const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-local-"));
    try {
      const fakeBin = join(root, "bin");
      const home = join(root, "home");
      mkdirSync(fakeBin);
      mkdirSync(home);
      mkdirSync(join(home, ".config/opencode/skills/aidd-dev-stale"), { recursive: true });
      writeFileSync(join(home, ".config/opencode/skills/aidd-dev-stale/SKILL.md"), "stale\n");
      mkdirSync(join(home, ".config/opencode/skills/aidd-dev/removed"), { recursive: true });
      writeFileSync(join(home, ".config/opencode/skills/aidd-dev/removed/SKILL.md"), "stale\n");
      mkdirSync(join(home, ".config/opencode/skills/aidd-dev/01-plan"), { recursive: true });
      writeFileSync(join(home, ".config/opencode/skills/aidd-dev/01-plan/SKILL.md"), "old\n");
      const unrelated = join(home, ".config/opencode/skills/aidd-pm/03-prd/SKILL.md");
      mkdirSync(join(home, ".config/opencode/skills/aidd-pm/03-prd"), { recursive: true });
      writeFileSync(unrelated, "keep\n");
      const agentDir = join(home, ".config/opencode/agents");
      mkdirSync(agentDir, { recursive: true });
      writeFileSync(join(agentDir, "aidd-dev-checker.md"), "old agent\n");
      writeFileSync(join(agentDir, "aidd-dev-removed.md"), "stale\n");
      writeFileSync(join(agentDir, "personal.md"), "keep\n");
      writeFileSync(join(agentDir, "aidd-pm-review.md"), "keep\n");
      executable(join(fakeBin, "opencode"), "exit 0");
      const skillName = layout === "nested" ? "aidd-dev/01-plan" : "aidd-dev-01-plan";
      executable(
        join(fakeBin, "npx"),
        String.raw`out=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--out" ]; then shift; out=$1; fi
  shift
done
skill="$out/.opencode/skills/${skillName}"
mkdir -p "$skill/actions" "$skill/assets"
printf '%s\n' '---' 'name: aidd-dev-01-plan' 'description: test' '---' > "$skill/SKILL.md"
printf '%s\n' 'updated action' > "$skill/actions/04-plan.md"
printf '%s\n' 'updated template' > "$skill/assets/plan-template.md"
mkdir -p "$out/.opencode/agents"
${buildDevAgents}`,
      );

      const result = runSync(fakeBin, home, ["aidd-dev"]);
      assert.equal(result.status, 0, result.stderr);
      const installed = join(home, ".config/opencode/skills", skillName);
      assert.match(readFileSync(join(installed, "SKILL.md"), "utf8"), /name: aidd-dev-01-plan/);
      assert.equal(readFileSync(join(installed, "actions/04-plan.md"), "utf8"), "updated action\n");
      assert.equal(readFileSync(join(installed, "assets/plan-template.md"), "utf8"), "updated template\n");
      assert.equal(existsSync(join(home, ".config/opencode/skills/aidd-dev-stale")), false);
      assert.equal(existsSync(join(home, ".config/opencode/skills/aidd-dev/removed")), false);
      assert.equal(readFileSync(unrelated, "utf8"), "keep\n");
      assert.match(result.stdout, /install opencode\s+skills:ok/);
      for (const name of devAgents) {
        assert.equal(readFileSync(join(agentDir, `aidd-dev-${name}`), "utf8"), "updated agent\n");
      }
      assert.equal(existsSync(join(agentDir, "aidd-dev-removed.md")), false);
      assert.equal(readFileSync(join(agentDir, "personal.md"), "utf8"), "keep\n");
      assert.equal(readFileSync(join(agentDir, "aidd-pm-review.md"), "utf8"), "keep\n");
      assert.match(result.stdout, /agents:ok/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

test("local OpenCode reload rejects missing selected skills before removing installed ones", () => {
  const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-missing-"));
  try {
    const fakeBin = join(root, "bin");
    const home = join(root, "home");
    mkdirSync(fakeBin);
    const installed = join(home, ".config/opencode/skills/aidd-dev-01-plan/SKILL.md");
    mkdirSync(join(home, ".config/opencode/skills/aidd-dev-01-plan"), { recursive: true });
    writeFileSync(installed, "keep\n");
    executable(join(fakeBin, "opencode"), "exit 0");
    executable(join(fakeBin, "npx"), "exit 0");

    const result = runSync(fakeBin, home, ["aidd-dev"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /no built OpenCode skill for aidd-dev-01-plan/);
    assert.doesNotMatch(result.stdout, /skills:ok/);
    assert.equal(readFileSync(installed, "utf8"), "keep\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("local OpenCode reload rejects a missing agent before changing installed content", () => {
  const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-agent-missing-"));
  try {
    const fakeBin = join(root, "bin");
    const home = join(root, "home");
    mkdirSync(fakeBin);
    const skillDir = join(home, ".config/opencode/skills/aidd-dev-01-plan");
    const agentDir = join(home, ".config/opencode/agents");
    mkdirSync(skillDir, { recursive: true });
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "keep skill\n");
    writeFileSync(join(agentDir, "aidd-dev-checker.md"), "keep agent\n");
    executable(join(fakeBin, "opencode"), "exit 0");
    const remainingAgents = devAgents.filter((name) => name !== "checker.md").map((name) =>
      `printf '%s\\n' 'agent' > "$out/.opencode/agents/aidd-dev-${name}"`,
    ).join("\n");
    executable(join(fakeBin, "npx"), String.raw`out=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--out" ]; then shift; out=$1; fi
  shift
done
mkdir -p "$out/.opencode/skills/aidd-dev-01-plan"
printf '%s\n' 'new skill' > "$out/.opencode/skills/aidd-dev-01-plan/SKILL.md"
mkdir -p "$out/.opencode/agents"
${remainingAgents}`);

    const result = runSync(fakeBin, home, ["aidd-dev"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /no built OpenCode agent for aidd-dev-/);
    assert.doesNotMatch(result.stdout, /skills:ok|agents:ok/);
    assert.equal(readFileSync(join(skillDir, "SKILL.md"), "utf8"), "keep skill\n");
    assert.equal(readFileSync(join(agentDir, "aidd-dev-checker.md"), "utf8"), "keep agent\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("default OpenCode reload installs every plugin's skills and agents", () => {
  const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-all-"));
  try {
    const fakeBin = join(root, "bin");
    const home = join(root, "home");
    mkdirSync(fakeBin);
    mkdirSync(home);
    const skills = ["aidd-dev-01-plan", "aidd-pm-03-prd"];
    const agents = devAgents.map((name) => `aidd-dev-${name}`);
    const buildSkills = skills.map((name) => `mkdir -p "$out/.opencode/skills/${name}"\nprintf '%s\\n' 'skill' > "$out/.opencode/skills/${name}/SKILL.md"`).join("\n");
    const buildAgents = agents.map((name) => `printf '%s\\n' 'agent' > "$out/.opencode/agents/${name}"`).join("\n");
    executable(join(fakeBin, "opencode"), "exit 0");
    executable(join(fakeBin, "npx"), `out=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--out" ]; then shift; out=$1; fi
  shift
done
mkdir -p "$out/.opencode/agents"
${buildSkills}
${buildAgents}`);

    const result = runSync(fakeBin, home, []);
    assert.equal(result.status, 0, result.stderr);
    for (const skill of skills) {
      assert.equal(readFileSync(join(home, ".config/opencode/skills", `${skill}/SKILL.md`), "utf8"), "skill\n");
    }
    for (const agent of agents) {
      assert.equal(readFileSync(join(home, ".config/opencode/agents", agent), "utf8"), "agent\n");
    }
    assert.match(result.stdout, /skills:ok agents:ok/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

for (const badOutput of ["missing", "empty"]) {
  test(`OpenCode rejects ${badOutput} expected skill output despite another built skill`, () => {
    const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-partial-"));
    try {
      const fakeBin = join(root, "bin");
      const home = join(root, "home");
      mkdirSync(fakeBin);
      const source = fixture(home);
      const second = join(source, "plugins/aidd-dev/skills/02-implement");
      mkdirSync(second);
      writeFileSync(join(second, "SKILL.md"), "source skill\n");
      const installed = join(home, ".config/opencode/skills/aidd-dev-02-implement");
      mkdirSync(installed, { recursive: true });
      writeFileSync(join(installed, "SKILL.md"), "keep\n");
      executable(join(fakeBin, "opencode"), "exit 0");
      executable(join(fakeBin, "npx"), String.raw`out=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--out" ]; then shift; out=$1; fi
  shift
done
mkdir -p "$out/.opencode/skills/aidd-dev-01-plan" "$out/.opencode/agents"
printf '%s\n' 'skill' > "$out/.opencode/skills/aidd-dev-01-plan/SKILL.md"
${buildDevAgents}
${badOutput === "empty" ? 'mkdir -p "$out/.opencode/skills/aidd-dev-02-implement"; touch "$out/.opencode/skills/aidd-dev-02-implement/SKILL.md"' : ""}`);
      const result = runSync(fakeBin, home, ["aidd-dev"]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /no built OpenCode skill for aidd-dev-02-implement/);
      assert.equal(readFileSync(join(installed, "SKILL.md"), "utf8"), "keep\n");
      assert.doesNotMatch(result.stdout, /skills:ok|Done\./);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

for (const host of ["opencode", "codex"]) {
  test(`reload fails when the installed ${host} host's build fails`, () => {
    const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-build-failed-"));
    try {
      const fakeBin = join(root, "bin");
      const home = join(root, "home");
      mkdirSync(fakeBin);
      executable(join(fakeBin, host), "exit 0");
      executable(join(fakeBin, "npx"), "exit 7");
      const result = runSync(fakeBin, home, ["aidd-dev"]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, new RegExp(`${host} build failed`));
      assert.doesNotMatch(result.stdout, /Done\./);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

for (const host of ["codex", "claude"]) {
  test(`reload fails when the installed ${host} host rejects a plugin`, () => {
    const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-install-failed-"));
    try {
      const fakeBin = join(root, "bin");
      const home = join(root, "home");
      mkdirSync(fakeBin);
      executable(join(fakeBin, host), `if [ "$1" = plugin ] && [ "$2" = ${host === "codex" ? "add" : "install"} ]; then exit 8; fi\nexit 0`);
      executable(join(fakeBin, "npx"), "exit 0");
      const result = runSync(fakeBin, home, ["aidd-dev"]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /plugin install failed for aidd-dev/);
      assert.doesNotMatch(result.stdout, /Done\./);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}
