const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { delimiter, dirname, join, resolve } = require("node:path");
const test = require("node:test");

const repo = resolve(__dirname, "../..");
const { render, sync } = require("../sync-global-instructions.cjs");

const instructionSource = "# AGENTS.md\n\n## Action\n- Keep scope.\n- Follow `docs/ARCHITECTURE.md`.\n\n## Agents\nUse available agents when useful. The caller owns scope and acceptance.\n\n## Memory Management\nProject docs live in aidd_docs/.\n<!-- aidd_project_memory:start -->\n@aidd_docs/memory/private.md\n<!-- aidd_project_memory:end -->\nLoad more memory.\n";

test("global instructions copy generic delegation guidance without project context", () => {
  for (const host of ["codex", "claude", "opencode", "copilot", "cursor"]) {
    const content = render(instructionSource, host);
    assert.match(content, /Use available agents when useful/);
    assert.doesNotMatch(content, /@aidd/);
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
    writeFileSync(source, instructionSource.replace("Use available agents when useful.", "Updated delegation guidance."));
    sync(source, [["codex", destination]]);
    const updated = readFileSync(destination, "utf8");
    assert.ok(updated.startsWith(personal));
    assert.match(updated, /Updated delegation guidance/);
    assert.doesNotMatch(updated, /Use available agents when useful\./);
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
    assert.match(migrated, /Use available agents when useful/);
    sync(source, [["codex", destination]]);
    assert.equal(readFileSync(destination, "utf8"), migrated);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("global agent extraction works without project memory and stops at the next section", () => {
  const source = "## Agents\nUse available agents when useful.\n\n## Project rules\nPrivate project rules.\n";
  assert.match(render(source, "claude"), /Use available agents when useful/);
  assert.doesNotMatch(render(source, "claude"), /Project rules|Private project/);
  assert.match(render(source.split("\n## Project rules")[0], "codex"), /Use available agents when useful/);
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
    assert.match(installed, /Use available agents when useful/);
    assert.doesNotMatch(installed, /@aidd/);
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
    for (const file of [copilot, cursor]) {
      assert.match(readFileSync(file, "utf8"), /Use available agents when useful/);
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
    for (const [plugin, skill] of [["aidd-dev", "01-plan"], ["aidd-pm", "03-prd"]]) {
      if (!plugins.includes(plugin)) continue;
      const pluginDir = join(source, "plugins", plugin);
      mkdirSync(join(pluginDir, ".claude-plugin"), { recursive: true });
      writeFileSync(join(pluginDir, ".claude-plugin/plugin.json"), "{}\n");
      mkdirSync(join(pluginDir, "skills", skill), { recursive: true });
      writeFileSync(join(pluginDir, "skills", skill, "SKILL.md"), "source skill\n");
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

function runSync(fakeBin, home, args = ["all"], overrides = {}, cwd = home) {
  executable(join(fakeBin, "node"), `exec '${process.execPath}' "$@"`);
  // `bash`, resolved on PATH, never the literal `/bin/bash`: that path does not exist on
  // Windows, where bash is the one Git for Windows ships. `spawnSync` resolves a bare name
  // through the platform's own rules on both.
  return spawnSync("bash", [join(repo, "scripts/dev-sync.sh"), ...args], {
    cwd,
    env: {
      ...process.env,
      PATH: [fakeBin, BASE_PATH].join(delimiter),
      HOME: home,
      FW: fixture(home),
      CODEX_INSTRUCTIONS: join(home, ".codex/AGENTS.md"),
      CLAUDE_INSTRUCTIONS: join(home, ".claude/CLAUDE.md"),
      OPENCODE_INSTRUCTIONS: join(home, ".config/opencode/AGENTS.md"),
      COPILOT_INSTRUCTIONS: join(home, ".copilot/copilot-instructions.md"),
      CURSOR_INSTRUCTIONS: join(home, ".cursor/rules/aidd-agents.mdc"),
      OPENCODE_DISABLE_CLAUDE_CODE: "",
      OPENCODE_DISABLE_CLAUDE_CODE_PROMPT: "",
      ...overrides,
    },
    encoding: "utf8",
  });
}

test("the global install runs from HOME, never the checkout whose settings enable the plugins", () => {
  const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-cwd-"));
  try {
    const fakeBin = join(root, "bin"), home = join(root, "home");
    mkdirSync(fakeBin);
    executable(join(fakeBin, "opencode"), "exit 0");
    const source = fixture(home);
    recordingCli(source, 'fs.writeFileSync(path.join(process.env.HOME, "observed-cwd"), process.cwd());');
    const result = runSync(fakeBin, home, [], {}, source);
    assert.equal(result.status, 0, result.stderr);
    // `.native` expands a Windows 8.3 short name (`RUNNER~1`), which bash's `cd "$HOME"` keeps.
    assert.equal(
      realpathSync.native(readFileSync(join(home, "observed-cwd"), "utf8").trim()),
      realpathSync.native(home)
    );
  } finally { rmSync(root, { recursive: true, force: true }); }
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
      executable(join(fakeBin, "opencode"), "exit 0");
      recordingCli(fixture(home));
      const result = runSync(fakeBin, home, [], { [flag]: "1" });
      assert.equal(result.status, 0, result.stderr);
      const installed = readFileSync(join(home, ".config/opencode/AGENTS.md"), "utf8");
      assert.doesNotMatch(installed, /Excluded Claude/);
      assert.match(installed, /Use available agents when useful/);
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
    const destinations = [".codex/AGENTS.md", ".claude/CLAUDE.md", ".config/opencode/AGENTS.md"];
    for (const path of destinations) {
      mkdirSync(dirname(join(home, path)), { recursive: true });
      writeFileSync(join(home, path), "Personal rules.\n");
    }
    for (const host of ["codex", "claude", "opencode"]) executable(join(fakeBin, host), "exit 0");
    executable(join(fakeBin, "npx"), "exit 0");
    const first = runSync(fakeBin, home, []);
    assert.equal(first.status, 0, first.stderr);
    assert.match(first.stdout, /global instructions\s+ok/);
    const contents = destinations.map((path) => {
      const content = readFileSync(join(home, path), "utf8");
      assert.ok(content.startsWith("Personal rules.\n"));
      assert.match(content, /Use available agents when useful/);
      assert.doesNotMatch(content, /@aidd/);
      assert.doesNotMatch(content, /Memory|aidd_docs|ARCHITECTURE/);
      return content;
    });
    const second = runSync(fakeBin, home, []);
    assert.equal(second.status, 0, second.stderr);
    destinations.forEach((path, index) => assert.equal(readFileSync(join(home, path), "utf8"), contents[index]));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/** A checkout CLI that records each call and answers `setup` with the given shell-free body. */
function recordingCli(source, setupBody = "") {
  const binary = join(source, "cli/dist/cli.js");
  mkdirSync(dirname(binary), { recursive: true });
  writeFileSync(binary, `const fs = require("node:fs"), path = require("node:path");
const args = process.argv.slice(2);
fs.appendFileSync(path.join(process.env.HOME, "aidd-calls"), args.join(" ") + "\\n");
if (args[0] !== "setup") process.exit(2);
${setupBody}`);
}

test("every host takes this checkout through aidd setup --global, afresh", () => {
  const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-global-"));
  try {
    const fakeBin = join(root, "bin"), home = join(root, "home");
    mkdirSync(fakeBin);
    const source = fixture(home, ["aidd-dev", "aidd-pm"]);
    recordingCli(source);
    for (const host of ["claude", "codex", "copilot", "cursor-agent", "kilo", "opencode"]) {
      executable(join(fakeBin, host), `printf '%s\\n' "${host} $*" >> "$HOME/host-calls"\n[ "$*" = "plugin list --json" ] && echo '[]'; exit 0`);
    }
    const result = runSync(fakeBin, home, []);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /global install\s+ok \(claude,codex,copilot,cursor,kilo,opencode\)/);
    assert.equal(
      readFileSync(join(home, "aidd-calls"), "utf8"),
      `setup --global --source local --path ${source} --ide claude,codex,copilot,cursor,kilo,opencode --plugins all --yes\n`
    );
    const hostCalls = readFileSync(join(home, "host-calls"), "utf8");
    for (const plugin of ["aidd-dev", "aidd-pm"]) {
      assert.match(hostCalls, new RegExp(`claude plugin uninstall ${plugin}@aidd-framework --scope user`));
      assert.match(hostCalls, new RegExp(`codex plugin remove ${plugin}@aidd-framework`));
    }
    assert.match(hostCalls, /^claude plugin marketplace remove aidd-framework$/m);
    assert.match(hostCalls, /codex plugin marketplace remove aidd-framework/);
    assert.doesNotMatch(hostCalls, /^(copilot|cursor-agent|kilo|opencode) /m);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

for (const [name, listing] of [
  ["a project installed from it", `echo '[{"id":"aidd-dev@aidd-framework","scope":"local","projectPath":"/p"}]'`],
  ["its list cannot be read", "exit 1"],
]) {
  test(`Claude's marketplace stays at user scope when ${name}`, () => {
    const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-local-"));
    try {
      const fakeBin = join(root, "bin"), home = join(root, "home");
      mkdirSync(fakeBin);
      recordingCli(fixture(home));
      executable(join(fakeBin, "claude"), `printf '%s\\n' "$*" >> "$HOME/claude-calls"\n[ "$*" = "plugin list --json" ] && { ${listing}; }\nexit 0`);
      const result = runSync(fakeBin, home, []);
      assert.equal(result.status, 0, result.stderr);
      const calls = readFileSync(join(home, "claude-calls"), "utf8");
      assert.match(calls, /^plugin marketplace remove aidd-framework --scope user$/m);
      assert.doesNotMatch(calls, /^plugin marketplace remove aidd-framework$/m);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
}

test("a failing global install stops the reload with its own cause", () => {
  const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-global-failed-"));
  try {
    const fakeBin = join(root, "bin"), home = join(root, "home");
    mkdirSync(fakeBin);
    recordingCli(fixture(home), 'console.error("fixture refusal"); process.exit(3);');
    executable(join(fakeBin, "opencode"), "exit 0");
    const result = runSync(fakeBin, home, []);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /fixture refusal/);
    assert.match(result.stderr, /aidd setup --global failed for opencode/);
    assert.doesNotMatch(result.stdout, /Done\./);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a global install from the published CLI is used when the checkout has none built", () => {
  const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-global-npx-"));
  try {
    const fakeBin = join(root, "bin"), home = join(root, "home");
    mkdirSync(fakeBin);
    executable(join(fakeBin, "codex"), "exit 0");
    executable(join(fakeBin, "npx"), 'printf \'%s\\n\' "$*" > "$HOME/npx-call"');
    const result = runSync(fakeBin, home, []);
    assert.equal(result.status, 0, result.stderr);
    assert.match(readFileSync(join(home, "npx-call"), "utf8"), /^--yes @ai-driven-dev\/cli@latest setup --global .* --ide codex --plugins all --yes$/m);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

for (const binary of ["cursor-agent", "agent", "cursor"]) {
  test(`Cursor found through ${binary} is installed globally with its always-on rule`, () => {
    const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-cursor-"));
    try {
      const fakeBin = join(root, "bin"), home = join(root, "home");
      mkdirSync(fakeBin);
      recordingCli(fixture(home));
      executable(join(fakeBin, binary), "echo 'Start the Cursor Agent'");
      const result = runSync(fakeBin, home, []);
      assert.equal(result.status, 0, result.stderr);
      assert.match(readFileSync(join(home, "aidd-calls"), "utf8"), / --ide cursor /);
      assert.match(readFileSync(join(home, ".cursor/rules/aidd-agents.mdc"), "utf8"), /^---\nalwaysApply: true\n---\n/);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
}

test("another tool named agent is not taken for Cursor", () => {
  const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-other-agent-"));
  try {
    const fakeBin = join(root, "bin"), home = join(root, "home");
    mkdirSync(fakeBin);
    recordingCli(fixture(home));
    executable(join(fakeBin, "agent"), "echo 'Grok Build TUI'");
    const result = runSync(fakeBin, home, []);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /No supported host installation found/);
    assert.equal(existsSync(join(home, "aidd-calls")), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Kilo is installed globally and gets no global instructions file", () => {
  const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-kilo-"));
  try {
    const fakeBin = join(root, "bin"), home = join(root, "home");
    mkdirSync(fakeBin);
    recordingCli(fixture(home));
    executable(join(fakeBin, "kilo"), "exit 0");
    const result = runSync(fakeBin, home, []);
    assert.equal(result.status, 0, result.stderr);
    assert.match(readFileSync(join(home, "aidd-calls"), "utf8"), / --ide kilo /);
    assert.equal(existsSync(join(home, ".config/kilo/AGENTS.md")), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("reload rejects plugin selection arguments before changing any host", () => {
  const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-no-filter-"));
  try {
    const fakeBin = join(root, "bin"), home = join(root, "home");
    mkdirSync(fakeBin);
    executable(join(fakeBin, "claude"), `printf '%s\\n' "$*" >> "$HOME/host-calls"`);
    const result = runSync(fakeBin, home, ["aidd-dev"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /every plugin/);
    assert.equal(existsSync(join(home, "host-calls")), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Copilot instructions follow its native home with task overrides taking precedence", () => {
  const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-copilot-home-"));
  try {
    const fakeBin = join(root, "bin"), home = join(root, "home"), nativeHome = join(home, "native-copilot");
    mkdirSync(fakeBin);
    recordingCli(fixture(home));
    executable(join(fakeBin, "copilot"), "exit 0");
    const result = runSync(fakeBin, home, [], { COPILOT_HOME: nativeHome, COPILOT_INSTRUCTIONS: "" });
    assert.equal(result.status, 0, result.stderr);
    assert.match(readFileSync(join(nativeHome, "copilot-instructions.md"), "utf8"), /Use available agents when useful/);
    assert.equal(existsSync(join(home, ".copilot/copilot-instructions.md")), false);
    assert.equal(runSync(fakeBin, home, [], { COPILOT_HOME: nativeHome }).status, 0);
    assert.match(readFileSync(join(home, ".copilot/copilot-instructions.md"), "utf8"), /Use available agents when useful/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

for (const override of ["CLAUDE_CONFIG_DIR", "CLAUDE_INSTRUCTIONS"]) {
  test(`OpenCode preserves its actual Claude fallback despite ${override}`, () => {
    const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-fallback-override-"));
    try {
      const fakeBin = join(root, "bin"), home = join(root, "home");
      mkdirSync(fakeBin);
      mkdirSync(join(home, ".claude"), { recursive: true });
      writeFileSync(join(home, ".claude/CLAUDE.md"), "Effective OpenCode personal instructions.\n");
      const custom = join(home, "custom-claude");
      mkdirSync(custom);
      writeFileSync(join(custom, "CLAUDE.md"), "Other Claude instructions.\n");
      executable(join(fakeBin, "opencode"), "exit 0");
      recordingCli(fixture(home));
      const result = runSync(fakeBin, home, [], override === "CLAUDE_CONFIG_DIR"
        ? { CLAUDE_CONFIG_DIR: custom, CLAUDE_INSTRUCTIONS: "" }
        : { CLAUDE_INSTRUCTIONS: join(custom, "CLAUDE.md") });
      assert.equal(result.status, 0, result.stderr);
      const installed = readFileSync(join(home, ".config/opencode/AGENTS.md"), "utf8");
      assert.match(installed, /Effective OpenCode personal instructions/);
      assert.doesNotMatch(installed, /Other Claude instructions/);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
}

