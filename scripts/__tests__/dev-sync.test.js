const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { delimiter, dirname, join, resolve } = require("node:path");
const test = require("node:test");

const repo = resolve(__dirname, "../..");
const { render, sync } = require("../sync-global-instructions.cjs");
const devAgents = ["checker.md", "executor.md"];
const buildDevAgents = devAgents.map((name) => `printf '%s\\n' 'updated agent' > "$out/.opencode/agents/aidd-dev-${name}"`).join("\n");

const instructionSource = "# AGENTS.md\n\n## Action\n- Keep scope.\n- Follow `docs/ARCHITECTURE.md`.\n\n## Agents\n| name | role |\n| --- | --- |\n| @executor (Codex), @aidd-dev-executor (OpenCode) | Implement scope. |\n\n## Memory Management\nProject docs live in aidd_docs/.\n<!-- aidd_project_memory:start -->\n@aidd_docs/memory/private.md\n<!-- aidd_project_memory:end -->\nLoad more memory.\n";

test("global instructions exclude project context and use each host's native agent names", () => {
  for (const [host, name] of [["codex", "@aidd-dev-executor"], ["claude", "@aidd-dev:executor"], ["opencode", "@aidd-dev-executor"]]) {
    const content = render(instructionSource, host);
    assert.ok(content.includes(`| ${name} | Implement scope. |`));
    assert.doesNotMatch(content, /Memory|memory|aidd_docs|ARCHITECTURE/);
    assert.doesNotMatch(content, /Keep scope|## Action|## Behavior|## Communication/);
  }
});

test("global sync preserves personal rules, updates its block, and is idempotent", () => {
  const root = mkdtempSync(join(tmpdir(), "aidd-global-rules-"));
  try {
    const source = join(root, "source.md");
    const destination = join(root, "codex/AGENTS.md");
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(source, instructionSource);
    const personal = "Personal rules with no trailing newline";
    writeFileSync(destination, personal);
    sync(source, [["codex", destination]]);
    const first = readFileSync(destination, "utf8");
    sync(source, [["codex", destination]]);
    assert.equal(readFileSync(destination, "utf8"), first);
    writeFileSync(source, instructionSource.replace("Implement scope.", "Implement updated scope."));
    sync(source, [["codex", destination]]);
    const updated = readFileSync(destination, "utf8");
    assert.ok(updated.startsWith(personal));
    assert.match(updated, /Implement updated scope/);
    assert.doesNotMatch(updated, /Implement scope\./);
    assert.equal(updated.split("aidd_global_instructions:start").length, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("global sync replaces legacy duplicated instructions without changing personal text", () => {
  const root = mkdtempSync(join(tmpdir(), "aidd-global-migration-"));
  try {
    const source = join(root, "source.md");
    const destination = join(root, "AGENTS.md");
    const prefix = "## Behavior\nMy personal rules.\n\n";
    const suffix = "\n\nMy private closing note.\n";
    writeFileSync(source, instructionSource);
    writeFileSync(destination, prefix + "<!-- aidd_global_instructions:start -->\n## Behavior\nLegacy duplicated rules.\n## Communication\nLegacy communication.\n<!-- aidd_global_instructions:end -->" + suffix);
    sync(source, [["codex", destination]]);
    const migrated = readFileSync(destination, "utf8");
    assert.ok(migrated.startsWith(prefix));
    assert.ok(migrated.endsWith(suffix));
    assert.doesNotMatch(migrated, /Legacy|Keep scope|## Communication|## Action/);
    assert.equal(migrated.match(/^## Behavior$/gm).length, 1);
    assert.match(migrated, /@aidd-dev-executor \| Implement scope/);
    sync(source, [["codex", destination]]);
    assert.equal(readFileSync(destination, "utf8"), migrated);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("global agent extraction works without project memory and stops at the next section", () => {
  const source = "## Agents\n| name | role |\n| @executor | Implement scope. |\n\n## Project rules\nNever copy me.\n";
  assert.match(render(source, "claude"), /@aidd-dev:executor/);
  assert.doesNotMatch(render(source, "claude"), /Project rules|Never copy/);
  assert.match(render(source.split("\n## Project rules")[0], "codex"), /Implement scope/);
});

test("first OpenCode sync retains effective Claude personal rules without its managed block", () => {
  const root = mkdtempSync(join(tmpdir(), "aidd-global-fallback-"));
  try {
    const source = join(root, "source.md");
    const claude = join(root, "CLAUDE.md");
    const opencode = join(root, "opencode/AGENTS.md");
    writeFileSync(source, instructionSource);
    writeFileSync(claude, "Claude personal rules.\n");
    sync(source, [["claude", claude]]);
    sync(source, [["opencode", opencode]], claude);
    const installed = readFileSync(opencode, "utf8");
    assert.match(installed, /Claude personal rules/);
    assert.match(installed, /@aidd-dev-executor/);
    assert.doesNotMatch(installed, /@aidd-dev:executor/);
    writeFileSync(claude, "Changed fallback.\n");
    sync(source, [["opencode", opencode]], claude);
    assert.equal(readFileSync(opencode, "utf8"), installed);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("malformed managed blocks and missing agent sections leave all global files untouched", () => {
  const root = mkdtempSync(join(tmpdir(), "aidd-global-invalid-"));
  try {
    const source = join(root, "source.md");
    const codex = join(root, "AGENTS.md");
    const claude = join(root, "CLAUDE.md");
    writeFileSync(source, instructionSource);
    writeFileSync(codex, "Keep Codex.\n");
    for (const malformed of ["<!-- aidd_global_instructions:start -->", "<!-- aidd_global_instructions:end --><!-- aidd_global_instructions:start -->", "<!-- aidd_global_instructions:start --><!-- aidd_global_instructions:end -->".repeat(2)]) {
      writeFileSync(claude, malformed);
      assert.throws(() => sync(source, [["codex", codex], ["claude", claude]]), /Malformed/);
      assert.equal(readFileSync(codex, "utf8"), "Keep Codex.\n");
      assert.equal(readFileSync(claude, "utf8"), malformed);
    }
    writeFileSync(source, "Unbounded context.\n");
    assert.throws(() => sync(source, [["codex", codex]]), /Agents section/);
    assert.equal(readFileSync(codex, "utf8"), "Keep Codex.\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Copilot and Cursor global instructions retain personal rules and native rule activation", () => {
  const root = mkdtempSync(join(tmpdir(), "aidd-global-native-rules-"));
  try {
    const source = join(root, "source.md"), copilot = join(root, "copilot-instructions.md"), cursor = join(root, "aidd-agents.mdc");
    writeFileSync(source, instructionSource);
    writeFileSync(copilot, "Copilot personal rule.\n");
    sync(source, [["copilot", copilot], ["cursor", cursor]]);
    assert.match(readFileSync(copilot, "utf8"), /^Copilot personal rule\.\n/);
    const rule = readFileSync(cursor, "utf8");
    assert.match(rule, /^---\nalwaysApply: true\n---\n/);
    for (const [file, name] of [[copilot, "@aidd-dev:executor"], [cursor, "@aidd-dev-executor"]]) {
      assert.ok(readFileSync(file, "utf8").includes(`| ${name} |`));
      assert.doesNotMatch(readFileSync(file, "utf8"), /aidd_docs|Memory|ARCHITECTURE/);
    }
    writeFileSync(cursor, rule + "\nPersonal closing rule.\n");
    sync(source, [["copilot", copilot], ["cursor", cursor]]);
    const updated = readFileSync(cursor, "utf8");
    assert.match(updated, /^---\nalwaysApply: true\n---\n/);
    assert.ok(updated.endsWith("Personal closing rule.\n"));
    sync(source, [["cursor", cursor]]);
    assert.equal(readFileSync(cursor, "utf8"), updated);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

function executable(path, body) {
  writeFileSync(path, `#!/bin/sh\nset -eu\n${body}\n`);
  chmodSync(path, 0o755);
}

function fixture(home, plugins = ["aidd-dev"]) {
  const source = join(home, "framework");
  if (!existsSync(source)) {
    for (const [plugin, skill, agents] of [["aidd-dev", "01-plan", devAgents], ["aidd-pm", "03-prd", []]]) {
      if (!plugins.includes(plugin)) continue;
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
    writeFileSync(join(source, "AGENTS.md"), instructionSource);
  }
  return source;
}

/** On POSIX, nothing but the stubs and the platform's own utilities, so a real `opencode` or
 * `claude` installed on the machine running these tests can never answer in their place.
 * Windows has neither directory, and the utilities `dev-sync.sh` calls live wherever Git for
 * Windows put them, so there the inherited `PATH` is kept with the stubs merely first. */
const BASE_PATH =
  process.platform === "win32" ? (process.env.PATH ?? "") : ["/usr/bin", "/bin"].join(delimiter);

function runSync(fakeBin, home, args = ["all"], overrides = {}) {
  executable(join(fakeBin, "node"), `exec '${process.execPath}' "$@"`);
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
      CODEX_INSTRUCTIONS: join(home, ".codex/AGENTS.md"),
      CLAUDE_INSTRUCTIONS: join(home, ".claude/CLAUDE.md"),
      OPENCODE_INSTRUCTIONS: join(home, ".config/opencode/AGENTS.md"),
      COPILOT_INSTRUCTIONS: join(home, ".copilot/copilot-instructions.md"),
      CURSOR_INSTRUCTIONS: join(home, ".cursor/rules/aidd-agents.mdc"),
      CURSOR_PLUGINS: join(home, ".cursor/plugins/local"),
      OPENCODE_DISABLE_CLAUDE_CODE: "",
      OPENCODE_DISABLE_CLAUDE_CODE_PROMPT: "",
      ...overrides,
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
    assert.match(readFileSync(join(home, ".config/opencode/AGENTS.md"), "utf8"), /Implement scope/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

for (const flag of ["OPENCODE_DISABLE_CLAUDE_CODE", "OPENCODE_DISABLE_CLAUDE_CODE_PROMPT"]) {
  test(`OpenCode first reload respects disabled Claude fallback via ${flag}`, () => {
    const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-no-fallback-"));
    try {
      const fakeBin = join(root, "bin");
      const home = join(root, "home");
      mkdirSync(fakeBin);
      mkdirSync(join(home, ".claude"), { recursive: true });
      writeFileSync(join(home, ".claude/CLAUDE.md"), "Excluded Claude personal rules.\n");
      executable(join(fakeBin, "aidd-opencode-reload"), "exit 0");
      const result = runSync(fakeBin, home, [], { [flag]: "1" });
      assert.equal(result.status, 0, result.stderr);
      const installed = readFileSync(join(home, ".config/opencode/AGENTS.md"), "utf8");
      assert.doesNotMatch(installed, /Excluded Claude/);
      assert.match(installed, /Implement scope/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

test("reload delivers global instructions to all three hosts while preserving personal rules", () => {
  const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-rules-"));
  try {
    const fakeBin = join(root, "bin");
    const home = join(root, "home");
    mkdirSync(fakeBin);
    mkdirSync(home);
    const source = fixture(home, ["aidd-pm"]);
    writeFileSync(join(source, "AGENTS.md"), instructionSource);
    const destinations = [[".codex/AGENTS.md", "@aidd-dev-executor"], [".claude/CLAUDE.md", "@aidd-dev:executor"], [".config/opencode/AGENTS.md", "@aidd-dev-executor"]];
    for (const [path] of destinations) {
      mkdirSync(dirname(join(home, path)), { recursive: true });
      writeFileSync(join(home, path), "Personal rules.\n");
    }
    for (const host of ["codex", "claude", "opencode"]) executable(join(fakeBin, host), "exit 0");
    executable(join(fakeBin, "npx"), String.raw`out=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--out" ]; then shift; out=$1; fi
  shift
done
mkdir -p "$out/.opencode/skills/aidd-pm-03-prd"
printf '%s\n' 'skill' > "$out/.opencode/skills/aidd-pm-03-prd/SKILL.md"`);
    const first = runSync(fakeBin, home, []);
    assert.equal(first.status, 0, first.stderr);
    assert.match(first.stdout, /global instructions\s+ok/);
    const contents = destinations.map(([path, name]) => {
      const content = readFileSync(join(home, path), "utf8");
      assert.ok(content.startsWith("Personal rules.\n"));
      assert.ok(content.includes(`| ${name} | Implement scope. |`));
      assert.doesNotMatch(content, /Memory|aidd_docs|ARCHITECTURE/);
      return content;
    });
    const second = runSync(fakeBin, home, []);
    assert.equal(second.status, 0, second.stderr);
    destinations.forEach(([path], index) => assert.equal(readFileSync(join(home, path), "utf8"), contents[index]));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

for (const layout of ["flat", "nested"]) {
  test(`local OpenCode reload refreshes the framework namespace using ${layout} output`, () => {
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

      const result = runSync(fakeBin, home, []);
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

test("local OpenCode reload rejects missing framework skills before removing installed ones", () => {
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

    const result = runSync(fakeBin, home, []);
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

    const result = runSync(fakeBin, home, []);
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
    fixture(home, ["aidd-dev", "aidd-pm"]);
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
      const result = runSync(fakeBin, home, []);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /no built OpenCode skill for aidd-dev-02-implement/);
      assert.equal(readFileSync(join(installed, "SKILL.md"), "utf8"), "keep\n");
      assert.doesNotMatch(result.stdout, /skills:ok|Done\./);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

for (const host of ["opencode", "codex", "copilot", "cursor"]) {
  test(`reload fails when the installed ${host} host's build fails`, () => {
    const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-build-failed-"));
    try {
      const fakeBin = join(root, "bin");
      const home = join(root, "home");
      mkdirSync(fakeBin);
      executable(join(fakeBin, host), "exit 0");
      executable(join(fakeBin, "npx"), "exit 7");
      const result = runSync(fakeBin, home, []);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, new RegExp(`${host} build failed`));
      assert.doesNotMatch(result.stdout, /Done\./);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

for (const host of ["codex", "claude", "copilot"]) {
  test(`reload fails when the installed ${host} host rejects a plugin`, () => {
    const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-install-failed-"));
    try {
      const fakeBin = join(root, "bin");
      const home = join(root, "home");
      mkdirSync(fakeBin);
      fixture(home, ["aidd-pm"]);
      executable(join(fakeBin, host), `if [ "$1 $2" = 'plugin marketplace' ] && [ "$3" = list ]; then echo '[]'; fi\nif [ "$1" = plugin ] && [ "$2" = ${host === "codex" ? "add" : "install"} ]; then exit 8; fi\nexit 0`);
      executable(join(fakeBin, "npx"), host === "copilot" ? nativeBuildStub() : "exit 0");
      const result = runSync(fakeBin, home, []);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /plugin install failed for aidd-pm/);
      assert.doesNotMatch(result.stdout, /Done\./);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

test("Codex reload rejects missing built agents before replacing the previous cache", () => {
  const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-codex-incomplete-"));
  try {
    const fakeBin = join(root, "bin"), home = join(root, "home");
    mkdirSync(fakeBin);
    const cached = join(home, ".codex/plugins/cache/aidd-framework/aidd-dev/2.6.0/codex-agents/checker.toml");
    mkdirSync(dirname(cached), { recursive: true });
    writeFileSync(cached, "old cached agent\n");
    executable(join(fakeBin, "codex"), "exit 0");
    executable(join(fakeBin, "npx"), "exit 0");
    const result = runSync(fakeBin, home, []);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /no built Codex agent/);
    assert.equal(readFileSync(cached, "utf8"), "old cached agent\n");
    assert.doesNotMatch(result.stdout, /Done\./);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Codex reload namespaces renamed roles and retires only cache-matched short names", () => {
  const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-codex-migration-"));
  try {
    const fakeBin = join(root, "bin"), home = join(root, "home");
    mkdirSync(fakeBin); mkdirSync(home);
    const source = fixture(home);
    rmSync(join(source, "plugins/aidd-dev/agents/checker.md"));
    writeFileSync(join(source, "plugins/aidd-dev/agents/reviewer.md"), "new reviewer\n");
    const cached = join(home, ".codex/plugins/cache/aidd-framework/aidd-dev/2.6.0/codex-agents/checker.toml");
    const agents = join(home, ".codex/agents");
    mkdirSync(dirname(cached), { recursive: true }); mkdirSync(agents, { recursive: true });
    const legacy = 'name = "checker"\ndescription = "Legacy"\n';
    writeFileSync(cached, legacy); writeFileSync(join(agents, "checker.toml"), legacy);
    writeFileSync(join(agents, "reviewer.toml"), "personal reviewer\n");
    executable(join(fakeBin, "codex"), "exit 0");
    executable(join(fakeBin, "npx"), String.raw`out=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--out" ]; then shift; out=$1; fi
  shift
done
mkdir -p "$out/plugins/aidd-dev/codex-agents"
for role in reviewer executor; do
  printf 'name = "%s"\ndescription = "New role"\n' "$role" > "$out/plugins/aidd-dev/codex-agents/$role.toml"
done`);
    const result = runSync(fakeBin, home, []);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(join(agents, "checker.toml")), false);
    assert.equal(readFileSync(join(agents, "reviewer.toml"), "utf8"), "personal reviewer\n");
    assert.match(readFileSync(join(agents, "aidd-dev-reviewer.toml"), "utf8"), /^name = "aidd-dev-reviewer"/);
    assert.match(readFileSync(join(agents, "aidd-dev-executor.toml"), "utf8"), /^name = "aidd-dev-executor"/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

function nativeBuildStub(omitAgent = false) {
  return String.raw`out=""; tool=""
while [ "$#" -gt 0 ]; do
  case "$1" in --out) shift; out=$1 ;; --to) shift; tool=$1 ;; esac
  shift
done
for source in "$FW/plugins/"*/; do
  plugin="$(basename "$source")"
  target="$out/plugins/$plugin"
  manifest=".$tool-plugin"
  [ "$tool" != copilot ] || manifest=".plugin"
  mkdir -p "$target/$manifest" "$target/skills"
  printf '{"name":"%s"}\n' "$plugin" > "$target/$manifest/plugin.json"
  cp -R "$FW/plugins/$plugin/skills/." "$target/skills/"
done
mkdir -p "$out/plugins/aidd-dev/agents"
${omitAgent ? "" : 'for role in checker executor; do name="$role"; [ "$tool" != cursor ] || name="aidd-dev-$role"; printf \'%s\\n\' \'---\' "name: $name" \'---\' \'Native role\' > "$out/plugins/aidd-dev/agents/$role.md"; done'}`;
}

for (const binary of ["cursor-agent", "agent", "cursor"]) {
  test(`Cursor reload through ${binary} installs every built plugin and preserves personal content`, () => {
    const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-cursor-"));
    try {
      const fakeBin = join(root, "bin"), home = join(root, "home");
      mkdirSync(fakeBin);
      fixture(home, ["aidd-dev", "aidd-pm"]);
      const personal = [".cursor/agents/executor.md", ".cursor/rules/personal.mdc", ".cursor/mcp.json", ".cursor/plugins/local/personal/notes.md"];
      for (const file of personal) {
        mkdirSync(dirname(join(home, file)), { recursive: true });
        writeFileSync(join(home, file), "personal bytes\n");
      }
      const stale = join(home, ".cursor/plugins/local/aidd-dev/agents/removed.md");
      mkdirSync(dirname(stale), { recursive: true });
      writeFileSync(stale, "retired role\n");
      executable(join(fakeBin, binary), "echo 'Start the Cursor Agent'");
      executable(join(fakeBin, "npx"), nativeBuildStub());
      const result = runSync(fakeBin, home, []);
      assert.equal(result.status, 0, result.stderr);
      for (const [plugin, skill] of [["aidd-dev", "01-plan"], ["aidd-pm", "03-prd"]]) {
        assert.equal(readFileSync(join(home, `.cursor/plugins/local/${plugin}/skills/${skill}/SKILL.md`), "utf8"), "source skill\n");
      }
      assert.match(readFileSync(join(home, ".cursor/plugins/local/aidd-dev/agents/executor.md"), "utf8"), /name: aidd-dev-executor/);
      assert.match(readFileSync(join(home, ".cursor/rules/aidd-agents.mdc"), "utf8"), /\| @aidd-dev-executor \|/);
      assert.equal(existsSync(stale), false);
      for (const file of personal) assert.equal(readFileSync(join(home, file), "utf8"), "personal bytes\n");
      const first = readFileSync(join(home, ".cursor/plugins/local/aidd-dev/agents/executor.md"), "utf8");
      assert.equal(runSync(fakeBin, home, []).status, 0);
      assert.equal(readFileSync(join(home, ".cursor/plugins/local/aidd-dev/agents/executor.md"), "utf8"), first);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
}

test("Cursor reload rejects incomplete native output before changing installed plugins", () => {
  const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-cursor-incomplete-"));
  try {
    const fakeBin = join(root, "bin"), home = join(root, "home");
    mkdirSync(fakeBin);
    const installed = join(home, ".cursor/plugins/local/aidd-dev/agents/executor.md");
    mkdirSync(dirname(installed), { recursive: true });
    writeFileSync(installed, "old role\n");
    executable(join(fakeBin, "cursor-agent"), "exit 0");
    executable(join(fakeBin, "npx"), nativeBuildStub(true));
    const result = runSync(fakeBin, home, []);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /no built cursor agent/);
    assert.equal(readFileSync(installed, "utf8"), "old role\n");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("another tool named agent does not trigger Cursor installation", () => {
  const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-other-agent-"));
  try {
    const fakeBin = join(root, "bin"), home = join(root, "home");
    mkdirSync(fakeBin);
    executable(join(fakeBin, "agent"), "echo 'Grok Build TUI'");
    executable(join(fakeBin, "npx"), "exit 9");
    const result = runSync(fakeBin, home, []);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(join(home, "build/cursor")), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

const copilotStub = String.raw`printf '%s\n' "$*" >> "$HOME/copilot-calls"
case "$1 $2 $3" in
  'plugin marketplace list')
    if [ -f "$HOME/copilot-source" ]; then
      printf '[{"name":"aidd-framework","source":"Local: %s"}]\n' "$(cat "$HOME/copilot-source")"
    else echo '[]'; fi ;;
  'plugin marketplace add')
    if [ -f "$HOME/copilot-source" ]; then echo 'Marketplace "aidd-framework" already registered' >&2; exit 1; fi
    printf '%s' "$4" > "$HOME/copilot-source" ;;
  'plugin marketplace remove') rm "$HOME/copilot-source" ;;
  'plugin marketplace update') : ;;
esac`;

test("Copilot reload builds all native plugins, migrates its own source, and preserves personal files", () => {
  const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-copilot-"));
  try {
    const fakeBin = join(root, "bin"), home = join(root, "home");
    mkdirSync(fakeBin); mkdirSync(home);
    const source = fixture(home, ["aidd-dev", "aidd-pm"]);
    writeFileSync(join(home, "copilot-source"), source);
    const personal = [".copilot/agents/executor.agent.md", ".copilot/instructions/personal.instructions.md", ".copilot/settings.json"];
    for (const file of personal) {
      mkdirSync(dirname(join(home, file)), { recursive: true });
      writeFileSync(join(home, file), "personal bytes\n");
    }
    executable(join(fakeBin, "copilot"), copilotStub);
    executable(join(fakeBin, "npx"), nativeBuildStub());
    const first = runSync(fakeBin, home, []);
    assert.equal(first.status, 0, first.stderr);
    assert.equal(readFileSync(join(home, "copilot-source"), "utf8"), join(home, "build/copilot"));
    for (const plugin of ["aidd-dev", "aidd-pm"]) {
      assert.match(readFileSync(join(home, "copilot-calls"), "utf8"), new RegExp(`plugin install ${plugin}@aidd-framework`));
      assert.equal(JSON.parse(readFileSync(join(home, `build/copilot/plugins/${plugin}/.plugin/plugin.json`), "utf8")).name, plugin);
    }
    assert.match(readFileSync(join(home, ".copilot/copilot-instructions.md"), "utf8"), /@aidd-dev:executor/);
    assert.equal(runSync(fakeBin, home, []).status, 0);
    assert.match(readFileSync(join(home, "copilot-calls"), "utf8"), /marketplace update aidd-framework/);
    for (const file of personal) assert.equal(readFileSync(join(home, file), "utf8"), "personal bytes\n");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Copilot refuses another source registered under the same marketplace name", () => {
  const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-copilot-foreign-"));
  try {
    const fakeBin = join(root, "bin"), home = join(root, "home");
    mkdirSync(fakeBin); mkdirSync(home);
    writeFileSync(join(home, "copilot-source"), "/another/framework");
    executable(join(fakeBin, "copilot"), copilotStub);
    executable(join(fakeBin, "npx"), nativeBuildStub());
    const result = runSync(fakeBin, home, []);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /different Copilot marketplace source/);
    assert.equal(readFileSync(join(home, "copilot-source"), "utf8"), "/another/framework");
    assert.doesNotMatch(readFileSync(join(home, "copilot-calls"), "utf8"), /marketplace remove|plugin install/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Copilot rejects incomplete native output before registering or installing", () => {
  const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-copilot-incomplete-"));
  try {
    const fakeBin = join(root, "bin"), home = join(root, "home");
    mkdirSync(fakeBin);
    executable(join(fakeBin, "copilot"), copilotStub);
    executable(join(fakeBin, "npx"), nativeBuildStub(true));
    const result = runSync(fakeBin, home, []);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /no built copilot agent/);
    assert.equal(existsSync(join(home, "copilot-calls")), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Copilot registers an inherited own marketplace without trying to remove it", () => {
  const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-copilot-inherited-"));
  try {
    const fakeBin = join(root, "bin"), home = join(root, "home");
    mkdirSync(fakeBin);
    executable(join(fakeBin, "copilot"), String.raw`printf '%s\n' "$*" >> "$HOME/copilot-calls"
case "$1 $2 $3" in
  'plugin marketplace list') printf '[{"name":"aidd-framework","source":"Local: %s"}]\n' "$FW" ;;
  'plugin marketplace remove') echo 'Marketplace "aidd-framework" is not registered' >&2; exit 1 ;;
  'plugin marketplace add') printf '%s' "$4" > "$HOME/copilot-source" ;;
esac`);
    executable(join(fakeBin, "npx"), nativeBuildStub());
    const result = runSync(fakeBin, home, []);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(home, "copilot-source"), "utf8"), join(home, "build/copilot"));
    assert.doesNotMatch(readFileSync(join(home, "copilot-calls"), "utf8"), /marketplace remove/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

for (const command of ["add", "update", "install"]) {
  test(`Copilot ${command} failure retains the native cause`, () => {
    const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-copilot-cause-"));
    try {
      const fakeBin = join(root, "bin"), home = join(root, "home");
      mkdirSync(fakeBin);
      executable(join(fakeBin, "copilot"), String.raw`case "$1 $2 $3" in
  'plugin marketplace list') ${command === "update" ? 'printf \'[{"name":"aidd-framework","source":"Local: %s"}]\\n\' "$BUILD/copilot"' : "echo '[]'"} ;;
  'plugin marketplace ${command}'${command === "install" ? "|\'plugin install aidd-dev@aidd-framework\'" : ""}) echo 'fixture native permission denied' >&2; exit 9 ;;
esac`);
      executable(join(fakeBin, "npx"), nativeBuildStub());
      const result = runSync(fakeBin, home, []);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /fixture native permission denied/);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
}

test("reload rejects plugin selection arguments before changing any host", () => {
  const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-no-filter-"));
  try {
    const fakeBin = join(root, "bin"), home = join(root, "home");
    mkdirSync(fakeBin);
    const result = runSync(fakeBin, home, ["aidd-dev"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /every plugin/);
    assert.equal(existsSync(join(home, "build")), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("reload uses the checkout's built CLI instead of a published translator", () => {
  const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-local-cli-"));
  try {
    const fakeBin = join(root, "bin"), home = join(root, "home");
    mkdirSync(fakeBin);
    const source = fixture(home), binary = join(source, "cli/dist/cli.js");
    mkdirSync(dirname(binary), { recursive: true });
    writeFileSync(binary, String.raw`const fs = require("node:fs"), path = require("node:path");
const args = process.argv.slice(2);
if (args[0] !== "translate") process.exit(2);
const out = args[args.indexOf("--out") + 1];
const source = args[1];
for (const plugin of fs.readdirSync(path.join(source, "plugins"))) {
  const target = path.join(out, "plugins", plugin);
  fs.mkdirSync(path.join(target, ".cursor-plugin"), { recursive: true });
  fs.writeFileSync(path.join(target, ".cursor-plugin/plugin.json"), JSON.stringify({ name: plugin }));
  fs.cpSync(path.join(source, "plugins", plugin, "skills"), path.join(target, "skills"), { recursive: true });
  fs.mkdirSync(path.join(target, "agents"));
  for (const file of fs.readdirSync(path.join(source, "plugins", plugin, "agents"))) {
    fs.writeFileSync(path.join(target, "agents", file), "---\nname: " + plugin + "-" + file.slice(0, -3) + "\n---\nLocal translation\n");
  }
}`);
    executable(join(fakeBin, "cursor-agent"), "echo 'Start the Cursor Agent'");
    executable(join(fakeBin, "npx"), "exit 19");
    const result = runSync(fakeBin, home, []);
    assert.equal(result.status, 0, result.stderr);
    assert.match(readFileSync(join(home, ".cursor/plugins/local/aidd-dev/agents/executor.md"), "utf8"), /name: aidd-dev-executor[\s\S]*Local translation/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Copilot instructions follow its native home with task overrides taking precedence", () => {
  const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-copilot-home-"));
  try {
    const fakeBin = join(root, "bin"), home = join(root, "home"), nativeHome = join(home, "native-copilot");
    mkdirSync(fakeBin);
    executable(join(fakeBin, "copilot"), copilotStub);
    executable(join(fakeBin, "npx"), nativeBuildStub());
    const result = runSync(fakeBin, home, [], { COPILOT_HOME: nativeHome, COPILOT_INSTRUCTIONS: "" });
    assert.equal(result.status, 0, result.stderr);
    assert.match(readFileSync(join(nativeHome, "copilot-instructions.md"), "utf8"), /@aidd-dev:executor/);
    assert.equal(existsSync(join(home, ".copilot/copilot-instructions.md")), false);
    assert.equal(runSync(fakeBin, home, [], { COPILOT_HOME: nativeHome }).status, 0);
    assert.match(readFileSync(join(home, ".copilot/copilot-instructions.md"), "utf8"), /@aidd-dev:executor/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("OpenCode skills and agents follow its native home with task overrides taking precedence", () => {
  const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-opencode-home-"));
  try {
    const fakeBin = join(root, "bin"), home = join(root, "home"), config = join(home, "native-config");
    mkdirSync(fakeBin);
    executable(join(fakeBin, "opencode"), "exit 0");
    executable(join(fakeBin, "npx"), String.raw`out=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = --out ]; then shift; out=$1; fi
  shift
done
mkdir -p "$out/.opencode/skills/aidd-dev-01-plan" "$out/.opencode/agents"
printf '%s\n' 'native skill' > "$out/.opencode/skills/aidd-dev-01-plan/SKILL.md"
${buildDevAgents}`);
    const result = runSync(fakeBin, home, [], { XDG_CONFIG_HOME: config, OPENCODE_SKILLS: "", OPENCODE_AGENTS: "", OPENCODE_INSTRUCTIONS: "" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(config, "opencode/skills/aidd-dev-01-plan/SKILL.md"), "utf8"), "native skill\n");
    assert.equal(readFileSync(join(config, "opencode/agents/aidd-dev-executor.md"), "utf8"), "updated agent\n");
    assert.equal(existsSync(join(home, ".config/opencode/skills")), false);
    assert.equal(runSync(fakeBin, home, [], { XDG_CONFIG_HOME: config }).status, 0);
    assert.equal(readFileSync(join(home, ".config/opencode/skills/aidd-dev-01-plan/SKILL.md"), "utf8"), "native skill\n");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Codex agents and legacy cache migration follow its native home", () => {
  const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-codex-home-"));
  try {
    const fakeBin = join(root, "bin"), home = join(root, "home"), nativeHome = join(home, "native-codex");
    mkdirSync(fakeBin);
    const cached = join(nativeHome, "plugins/cache/aidd-framework/aidd-dev/2.6.0/codex-agents/checker.toml");
    const oldAgent = join(nativeHome, "agents/checker.toml"), legacy = 'name = "checker"\ndescription = "Legacy"\n';
    for (const file of [cached, oldAgent]) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, legacy); }
    executable(join(fakeBin, "codex"), "exit 0");
    executable(join(fakeBin, "npx"), String.raw`out=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = --out ]; then shift; out=$1; fi
  shift
done
mkdir -p "$out/plugins/aidd-dev/codex-agents"
for role in checker executor; do printf 'name = "%s"\ndescription = "Native"\n' "$role" > "$out/plugins/aidd-dev/codex-agents/$role.toml"; done`);
    const result = runSync(fakeBin, home, [], { CODEX_HOME: nativeHome, CODEX_CACHE: "", CODEX_AGENTS: "", CODEX_INSTRUCTIONS: "" });
    assert.equal(result.status, 0, result.stderr);
    assert.match(readFileSync(join(nativeHome, "agents/aidd-dev-executor.toml"), "utf8"), /^name = "aidd-dev-executor"/);
    assert.equal(existsSync(oldAgent), false);
    assert.equal(existsSync(join(home, ".codex/agents")), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

for (const customPluginRoot of [false, true]) {
  test(`Claude cache follows its native ${customPluginRoot ? "plugin root" : "config home"}`, () => {
    const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-claude-home-"));
    try {
      const fakeBin = join(root, "bin"), home = join(root, "home"), config = join(home, "native-claude");
      const plugins = customPluginRoot ? join(home, "native-plugins") : join(config, "plugins");
      mkdirSync(fakeBin);
      executable(join(fakeBin, "claude"), String.raw`if [ "$1 $2" = 'plugin install' ]; then
  cache="$CLAUDE_CONFIG_DIR/plugins"
  [ -z "$CLAUDE_CODE_PLUGIN_CACHE_DIR" ] || cache="$CLAUDE_CODE_PLUGIN_CACHE_DIR"
  cache="$cache/cache/aidd-framework/aidd-dev/2.6.0"
  mkdir -p "$cache/agents"
fi`);
      const result = runSync(fakeBin, home, [], { CLAUDE_CONFIG_DIR: config, CLAUDE_CODE_PLUGIN_CACHE_DIR: customPluginRoot ? plugins : "", CLAUDE_CACHE: "", CLAUDE_INSTRUCTIONS: "" });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(readFileSync(join(plugins, "cache/aidd-framework/aidd-dev/2.6.0/agents/executor.md"), "utf8"), "source agent\n");
      assert.match(readFileSync(join(config, "CLAUDE.md"), "utf8"), /@aidd-dev:executor/);
      assert.equal(existsSync(join(home, ".claude/plugins")), false);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
}
