const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");

const skill = path.resolve(__dirname, "../../plugins/aidd-context/skills/08-hook-generate");
const CAPTURES = path.resolve(__dirname, "fixtures/hook-payloads");
const SCRIPT = "#!/usr/bin/env node\nprocess.exit(0);\n";
const PLUGIN = "export default { id: \"guard-shell\", server: async () => ({}) };\n";
const command = (target) => ({ runner: "node", extension: "cjs", script: SCRIPT, timeout: 30, ...target });
const hook = {
  name: "guard-shell",
  hosts: {
    claude: command({ event: "PreToolUse", matcher: "Bash" }),
    codex: command({ event: "PreToolUse", matcher: "Bash" }),
    cursor: command({ event: "preToolUse" }),
    copilot: command({ event: "preToolUse" }),
    antigravity: command({ event: "PreToolUse", matcher: "run_command" }),
    kiro: command({ event: "PreToolUse", matcher: "execute_bash" }),
  },
};
const only = (...tools) => ({ ...hook, hosts: Object.fromEntries(tools.map((tool) => [tool, hook.hosts[tool]])) });
const withHost = (tool, target) => ({ ...hook, hosts: { [tool]: target } });
const asFile = (value) => `${JSON.stringify(value, null, 2)}\n`;

const CLAUDE = ".claude/settings.json";
const CODEX = ".codex/hooks.json";
const CURSOR = ".cursor/hooks.json";
const COPILOT = ".github/hooks/guard-shell.json";
const ANTIGRAVITY = ".agents/hooks.json";
const KIRO = ".kiro/hooks/guard-shell.json";
const COPIES = [".claude/hooks/guard-shell.cjs", ".codex/hooks/guard-shell.cjs", ".cursor/hooks/guard-shell.cjs", ".github/hooks/guard-shell.cjs", ".agents/hooks/guard-shell.cjs", ".kiro/hooks/guard-shell.cjs"];
const ALL_FILES = [CLAUDE, COPIES[0], CODEX, COPIES[1], CURSOR, COPIES[2], COPILOT, COPIES[3], ANTIGRAVITY, COPIES[4], KIRO, COPIES[5]];

function fixture(t) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "aidd-hook-")));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const project = path.join(dir, "project");
  const installed = path.join(dir, "installed");
  fs.mkdirSync(project);
  fs.cpSync(skill, installed, { recursive: true });
  const script = path.join(installed, "scripts/write-hook.cjs");
  assert.ok(fs.existsSync(script), "installed skill must contain its standalone script");
  const exec = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8", cwd: dir, env: { PATH: "" } });
  function run(request = hook, extra = []) {
    const input = path.join(dir, "input.json");
    fs.writeFileSync(input, JSON.stringify(request));
    return exec("--project", project, "--input", input, ...extra);
  }
  const remove = (name, extra = []) => exec("--project", project, "--remove", name, ...extra);
  const read = (name) => fs.readFileSync(path.join(project, name), "utf8");
  const exists = (name) => fs.existsSync(path.join(project, name));
  function write(name, content) {
    fs.mkdirSync(path.dirname(path.join(project, name)), { recursive: true });
    fs.writeFileSync(path.join(project, name), content);
  }
  return { dir, project, exec, run, remove, read, exists, write };
}

test("writes typed native options only to each owned handler", (t) => {
  const { run, read, write, exists, remove } = fixture(t);
  const request = {
    ...hook,
    nativeOptions: {
      claude: { statusMessage: "Checking files" },
      codex: { statusMessage: "Reviewing the call" },
      cursor: { failClosed: true },
      copilot: { env: { AIDD_CHECK_MODE: "project" } },
      kiro: { enabled: false },
    },
  };
  const unrelated = { type: "command", command: "node .claude/hooks/existing.cjs" };
  const initial = asFile({ hooks: { PreToolUse: [{ hooks: [unrelated] }] } });
  write(CLAUDE, initial);
  const preview = run(request, ["--plan"]);
  assert.equal(preview.status, 0, preview.stdout);
  assert.deepEqual(json(preview).changes.find(({ path }) => path === CLAUDE).nativeOptions, request.nativeOptions.claude);
  assert.equal(read(CLAUDE), initial);
  assert.equal(exists(COPILOT), false);
  assert.equal(run(request).status, 0);
  assert.deepEqual(JSON.parse(read(CLAUDE)).hooks.PreToolUse[0].hooks, [unrelated]);
  assert.equal(JSON.parse(read(CLAUDE)).hooks.PreToolUse[1].hooks[0].statusMessage, "Checking files");
  assert.equal(JSON.parse(read(CODEX)).hooks.PreToolUse[0].hooks[0].statusMessage, "Reviewing the call");
  assert.equal(JSON.parse(read(CURSOR)).hooks.preToolUse[0].failClosed, true);
  assert.deepEqual(JSON.parse(read(COPILOT)).hooks.preToolUse[0].env, { AIDD_CHECK_MODE: "project" });
  assert.equal(JSON.parse(read(KIRO)).hooks[0].enabled, false);
  assert.equal(read(ANTIGRAVITY).includes("statusMessage"), false);
  assert.ok(json(run(request, ["--plan"])).changes.every(({ operation }) => operation === "unchanged"));
  assert.equal(remove(hook.name).status, 0);
  assert.equal(read(CLAUDE), initial);
});

test("refuses native hook options with an unsupported target, type, or managed field before writing", (t) => {
  const { run, exists } = fixture(t);
  const cases = [
    [{ antigravity: { statusMessage: "Checking" } }, /antigravity.*statusMessage/u],
    [{ cursor: { failClosed: "yes" } }, /cursor.*failClosed/u],
    [{ codex: { command: "node alternate.cjs" } }, /codex.*command/u],
    [{ kilo: { async: true } }, /kilo.*selected/u],
  ];
  for (const [nativeOptions, error] of cases) {
    const result = run({ ...hook, nativeOptions });
    assert.equal(result.status, 1, result.stdout);
    assert.match(json(result).error.message, error);
    assert.equal(exists(CLAUDE), false);
  }
  const module = run({ ...withHost("kilo", { plugin: PLUGIN }), nativeOptions: { kilo: { async: true } } });
  assert.equal(module.status, 1, module.stdout);
  assert.match(json(module).error.message, /kilo.*plugin/u);
});

const json = (r) => JSON.parse(r.stdout);
const operations = (r) => json(r).changes.map((change) => `${change.operation} ${change.path}`);

test("writes each host's native entry and its own copy of the script", (t) => {
  const { run, read } = fixture(t);
  const r = run();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const grouped = (command) => ({ hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command, timeout: 30 }] }] } });
  assert.equal(read(CLAUDE), asFile(grouped('node "$CLAUDE_PROJECT_DIR"/.claude/hooks/guard-shell.cjs')));
  assert.equal(read(CODEX), asFile(grouped('node "$(git rev-parse --show-toplevel)/.codex/hooks/guard-shell.cjs"')));
  assert.equal(read(CURSOR), asFile({ version: 1, hooks: { preToolUse: [{ command: 'node "$CURSOR_PROJECT_DIR"/.cursor/hooks/guard-shell.cjs', timeout: 30 }] } }));
  assert.equal(read(COPILOT), asFile({ version: 1, hooks: { preToolUse: [{ type: "command", bash: "node .github/hooks/guard-shell.cjs", cwd: ".", timeoutSec: 30 }] } }));
  assert.equal(read(ANTIGRAVITY), asFile({ "guard-shell": { PreToolUse: [{ matcher: "run_command", hooks: [{ type: "command", command: "node hooks/guard-shell.cjs", timeout: 30 }] }] } }));
  assert.equal(read(KIRO), asFile({ version: "v1", hooks: [{ name: "guard-shell", trigger: "PreToolUse", matcher: "execute_bash", action: { type: "command", command: "node .kiro/hooks/guard-shell.cjs" }, timeout: 30 }] }));
  for (const copy of COPIES) assert.equal(read(copy), SCRIPT);
  assert.deepEqual(operations(r), ALL_FILES.map((file) => `create ${file}`));
});

test("each host gets the script it was given, with its own extension and runner", (t) => {
  const { run, read } = fixture(t);
  const r = run({ ...hook, hosts: { claude: command({ event: "Stop", script: "claude\n" }), kiro: command({ event: "Stop", runner: "python3", extension: "py", script: "kiro\n" }) } });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(read(".claude/hooks/guard-shell.cjs"), "claude\n");
  assert.equal(read(".kiro/hooks/guard-shell.py"), "kiro\n");
  assert.equal(JSON.parse(read(KIRO)).hooks[0].action.command, "python3 .kiro/hooks/guard-shell.py");
});

test("an event without a matcher takes its handlers directly on Antigravity", (t) => {
  const { run, read } = fixture(t);
  const r = run(withHost("antigravity", command({ event: "Stop" })));
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(JSON.parse(read(ANTIGRAVITY)), { "guard-shell": { Stop: [{ type: "command", command: "node hooks/guard-shell.cjs", timeout: 30 }] } });
});

test("the timeout defaults to 30 seconds", (t) => {
  const { run, read } = fixture(t);
  const { timeout, ...withoutTimeout } = command({ event: "Stop" });
  assert.equal(run(withHost("claude", withoutTimeout)).status, 0);
  assert.equal(JSON.parse(read(CLAUDE)).hooks.Stop[0].hooks[0].timeout, 30);
});

test("rewriting the same hook changes nothing", (t) => {
  const { run } = fixture(t);
  assert.equal(run().status, 0);
  const again = run();
  assert.equal(again.status, 0, again.stdout);
  assert.ok(json(again).changes.every((change) => change.operation === "unchanged"), again.stdout);
});

test("keeps every neighbour entry, on write and on removal", (t) => {
  const { run, remove, read, write } = fixture(t);
  const foreign = { type: "command", command: "echo mine", timeout: 5 };
  const claude = { permissions: { allow: ["Bash(ls)"] }, hooks: { PreToolUse: [{ matcher: "Bash", hooks: [foreign] }], Stop: [{ hooks: [foreign] }] } };
  const cursor = { version: 1, hooks: { stop: [{ command: "echo mine" }] } };
  const antigravity = { "other-hook": { Stop: [foreign] } };
  write(CLAUDE, asFile(claude));
  write(CURSOR, asFile(cursor));
  write(ANTIGRAVITY, asFile(antigravity));
  const r = run();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const written = JSON.parse(read(CLAUDE));
  assert.deepEqual(written.permissions, claude.permissions);
  assert.deepEqual(written.hooks.Stop, claude.hooks.Stop);
  assert.deepEqual(written.hooks.PreToolUse[0], claude.hooks.PreToolUse[0]);
  assert.equal(written.hooks.PreToolUse.length, 2);
  assert.deepEqual(JSON.parse(read(CURSOR)).hooks.stop, cursor.hooks.stop);
  assert.deepEqual(JSON.parse(read(ANTIGRAVITY))["other-hook"], antigravity["other-hook"]);
  assert.equal(remove("guard-shell").status, 0);
  assert.equal(read(CLAUDE), asFile(claude));
  assert.equal(read(CURSOR), asFile(cursor));
  assert.equal(read(ANTIGRAVITY), asFile(antigravity));
});

test("keeps a neighbour handler merged by hand into its group", (t) => {
  const { run, remove, read, write } = fixture(t);
  assert.equal(run(only("claude")).status, 0);
  const settings = JSON.parse(read(CLAUDE));
  const foreign = { type: "command", command: "echo mine" };
  settings.hooks.PreToolUse[0].hooks.push(foreign);
  write(CLAUDE, asFile(settings));
  assert.equal(remove("guard-shell").status, 0);
  assert.deepEqual(JSON.parse(read(CLAUDE)), { hooks: { PreToolUse: [{ matcher: "Bash", hooks: [foreign] }] } });
});

test("plan writes nothing and names each operation", (t) => {
  const { run, project } = fixture(t);
  const r = run(only("claude"), ["--plan"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(operations(r), [`create ${CLAUDE}`, "create .claude/hooks/guard-shell.cjs"]);
  assert.deepEqual(fs.readdirSync(project), []);
  run(only("claude"));
  assert.deepEqual(operations(run(only("claude"), ["--plan"])), [`unchanged ${CLAUDE}`, "unchanged .claude/hooks/guard-shell.cjs"]);
  const moved = withHost("claude", command({ event: "PostToolUse", matcher: "Edit" }));
  assert.deepEqual(operations(run(moved, ["--plan"])), [`update ${CLAUDE}`, "unchanged .claude/hooks/guard-shell.cjs"]);
});

test("refuses to change its own entry or a hand-edited copy without --force", (t) => {
  const { run, read, write } = fixture(t);
  assert.equal(run(only("claude", "copilot")).status, 0);
  const before = read(CLAUDE);
  const moved = withHost("claude", command({ event: "PostToolUse", matcher: "Edit" }));
  const entry = run(moved);
  assert.equal(entry.status, 1);
  assert.match(json(entry).error.message, /\.claude\/settings\.json/);
  assert.equal(read(CLAUDE), before);
  write(".github/hooks/guard-shell.cjs", "edited by hand\n");
  const copy = run(only("claude", "copilot"));
  assert.equal(copy.status, 1);
  assert.match(json(copy).error.message, /\.github\/hooks\/guard-shell\.cjs/);
  assert.equal(read(".github/hooks/guard-shell.cjs"), "edited by hand\n");
  assert.equal(run(only("claude", "copilot"), ["--force"]).status, 0);
  assert.equal(read(".github/hooks/guard-shell.cjs"), SCRIPT);
});

test("refuses a Copilot file, a Kiro file or an Antigravity key it did not write, unless forced", (t) => {
  const { run, read, write } = fixture(t);
  write(COPILOT, asFile({ version: 1, hooks: { sessionStart: [{ type: "command", bash: "echo theirs" }] } }));
  write(KIRO, asFile({ version: "v1", hooks: [{ name: "theirs", trigger: "Stop", action: { type: "command", command: "echo theirs" } }] }));
  write(ANTIGRAVITY, asFile({ "guard-shell": { Stop: [{ type: "command", command: "echo theirs" }] } }));
  for (const tool of ["copilot", "kiro", "antigravity"]) {
    const r = run(only(tool));
    assert.equal(r.status, 1, r.stdout);
    assert.equal(json(r).error.code, "REFUSED");
  }
  assert.match(read(COPILOT), /echo theirs/);
  assert.match(read(KIRO), /echo theirs/);
  assert.match(read(ANTIGRAVITY), /echo theirs/);
  assert.equal(run(only("kiro"), ["--force"]).status, 0);
  assert.doesNotMatch(read(KIRO), /echo theirs/);
});

test("refuses an invalid hook and writes nothing", (t) => {
  const { run, project } = fixture(t);
  const claude = (target) => withHost("claude", command({ event: "PreToolUse", ...target }));
  for (const bad of [
    { ...hook, name: "Guard Shell" },
    { ...hook, hosts: {} },
    { ...hook, hosts: { gemini: command({ event: "PreToolUse" }) } },
    claude({ runner: "node --inspect" }),
    claude({ extension: "json" }),
    claude({ extension: "c.js" }),
    claude({ script: " " }),
    claude({ timeout: 0 }),
    claude({ timeout: 1.5 }),
    claude({ matcher: "" }),
    claude({ matcher: "(" }),
    claude({ event: "preToolUse" }),
    claude({ event: "Notification" }),
    claude({ event: "Stop", matcher: "Bash" }),
    withHost("copilot", command({ event: "preToolUse", matcher: "bash(" })),
    withHost("copilot", command({ event: "sessionStart", matcher: "bash" })),
    withHost("kiro", command({ event: "preToolUse" })),
    withHost("claude", { ...command({ event: "Stop" }), plugin: PLUGIN }),
    withHost("opencode", { plugin: PLUGIN, event: "tool.execute.before" }),
    withHost("opencode", { plugin: PLUGIN, runner: "node" }),
    withHost("opencode", { event: "tool.execute.before" }),
    withHost("kilo", { plugin: "" }),
  ]) {
    const r = run(bad);
    assert.equal(r.status, 1, JSON.stringify(bad));
    assert.equal(json(r).error.code, "REFUSED");
  }
  assert.deepEqual(fs.readdirSync(project), []);
});

test("names the host whose event is unknown", (t) => {
  const { run } = fixture(t);
  const r = run(withHost("codex", command({ event: "preToolUse" })));
  assert.equal(r.status, 1);
  assert.match(json(r).error.message, /codex/);
});

test("rejects bad usage with exit 2", (t) => {
  const { exec, run, project } = fixture(t);
  assert.equal(exec("--input", "x.json").status, 2);
  assert.equal(exec("--project", project).status, 2);
  assert.equal(exec("--project", project, "--input", "x.json", "--remove", "guard-shell").status, 2);
  assert.equal(exec("--describe", "--project", project).status, 2);
  assert.equal(exec("--hosts", "claude").status, 2);
  assert.equal(run(hook, ["--bogus"]).status, 2);
  assert.equal(run(hook, ["--plan", "--plan"]).status, 2);
  assert.deepEqual(fs.readdirSync(project), []);
});

test("refuses a relative project, a symlink on the way and an unreadable config", (t) => {
  const { exec, run, dir, project, write, read } = fixture(t);
  run(hook, ["--plan"]);
  const relative = exec("--project", "project", "--input", "input.json");
  assert.equal(relative.status, 1);
  assert.match(json(relative).error.message, /absolute/);
  const outside = path.join(dir, "outside");
  fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(project, ".claude"));
  assert.equal(run(only("claude")).status, 1);
  assert.deepEqual(fs.readdirSync(outside), []);
  write(CURSOR, "{ not json");
  const broken = run(only("cursor"));
  assert.equal(broken.status, 1);
  assert.match(json(broken).error.message, /\.cursor\/hooks\.json/);
  assert.equal(read(CURSOR), "{ not json");
});

test("exits 3 before writing anything when one target cannot be written", (t) => {
  const { run, write, exists } = fixture(t);
  write(".codex", "not a directory");
  const r = run(only("claude", "codex"));
  assert.equal(r.status, 3, r.stdout);
  assert.ok(json(r).error.code);
  assert.equal(exists(CLAUDE), false);
});

test("a project checked out with CRLF line endings reads as its own output", (t) => {
  const { run, read, write } = fixture(t);
  assert.equal(run().status, 0);
  for (const name of json(run(hook, ["--plan"])).changes.map((change) => change.path)) write(name, read(name).replace(/\n/g, "\r\n"));
  const again = run(hook, ["--plan"]);
  assert.equal(again.status, 0, again.stdout);
  assert.ok(json(again).changes.every((change) => change.operation === "unchanged"), again.stdout);
});

test("remove deletes every entry, the whole-file configs, the copies and a config left empty", (t) => {
  const { run, remove, project, exists } = fixture(t);
  assert.equal(run().status, 0);
  const planned = remove("guard-shell", ["--plan"]);
  assert.equal(planned.status, 0, planned.stdout);
  assert.deepEqual(operations(planned), ALL_FILES.map((file) => `delete ${file}`));
  assert.ok(exists(CLAUDE));
  const r = remove("guard-shell");
  assert.equal(r.status, 0, r.stdout);
  for (const file of ALL_FILES) assert.equal(exists(file), false, file);
  assert.deepEqual(json(remove("guard-shell")).changes, []);
  assert.equal(remove("Guard Shell").status, 1);
  assert.ok(fs.readdirSync(project).every((entry) => fs.statSync(path.join(project, entry)).isDirectory()));
});

const OPENCODE = ".opencode/plugins/guard-shell.js";
const KILO = ".kilo/plugin/guard-shell.js";
const pluginHook = { name: "guard-shell", hosts: { opencode: { plugin: PLUGIN }, kilo: { plugin: `${PLUGIN}// kilo\n` } } };

test("a plugin host gets its plugin text verbatim and no script copy", (t) => {
  const { run, read, exists } = fixture(t);
  const r = run(pluginHook);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(operations(r), [OPENCODE, KILO].map((file) => `create ${file}`));
  assert.equal(read(OPENCODE), PLUGIN);
  assert.equal(read(KILO), `${PLUGIN}// kilo\n`);
  assert.equal(exists(".opencode/hooks"), false);
  assert.ok(json(run(pluginHook)).changes.every((change) => change.operation === "unchanged"));
});

test("a changed plugin needs --force, and removal deletes the plugin", (t) => {
  const { run, remove, read, exists } = fixture(t);
  assert.equal(run(pluginHook).status, 0);
  const changed = withHost("opencode", { plugin: "export default {};\n" });
  assert.equal(run(changed).status, 1);
  assert.equal(read(OPENCODE), PLUGIN);
  assert.equal(run(changed, ["--force"]).status, 0);
  assert.equal(read(OPENCODE), "export default {};\n");
  const r = remove("guard-shell");
  assert.equal(r.status, 0, r.stdout);
  assert.deepEqual(operations(r), [OPENCODE, KILO].map((file) => `delete ${file}`));
  for (const file of [OPENCODE, KILO]) assert.equal(exists(file), false, file);
});

// --describe: the one mapping, read-only.
const HOSTS = ["claude", "codex", "cursor", "copilot", "antigravity", "kiro", "opencode", "kilo"];
const MOMENTS = ["session-start", "prompt", "before-tool", "after-tool", "stop", "session-end"];
const EFFECTS = ["inform", "block", "ask", "continue"];
const describe = (t, ...extra) => json(fixture(t).exec("--describe", ...extra)).hosts;

function facts(host) {
  const found = [host.config ?? host.plugin, host.cwd, host.trust, host.shell];
  for (const moment of Object.values(host.moments)) if (moment) found.push(moment, ...(moment.v2 ? [moment.v2] : []));
  for (const effect of Object.values(host.effects)) if (effect) found.push(effect);
  return found;
}

test("--describe prints every host with a doc URL and a source on every fact", (t) => {
  const { exec } = fixture(t);
  const r = exec("--describe");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const { hosts } = json(r);
  assert.deepEqual(Object.keys(hosts), HOSTS);
  for (const [id, host] of Object.entries(hosts)) {
    assert.match(host.doc, /^https:\/\//, id);
    assert.equal("detect" in host, false, `${id}: detection markers live in the skill`);
    assert.deepEqual(Object.keys(host.moments), MOMENTS, id);
    assert.deepEqual(Object.keys(host.effects), EFFECTS, id);
    for (const fact of facts(host)) assert.match(fact.source, /^(https:\/\/|capture:)/, `${id}: ${JSON.stringify(fact)}`);
  }
});

test("--describe --hosts limits the output and refuses an unknown host", (t) => {
  const { exec } = fixture(t);
  assert.deepEqual(Object.keys(describe(t, "--hosts", "kiro,claude")).sort(), ["claude", "kiro"]);
  const bad = exec("--describe", "--hosts", "gemini");
  assert.equal(bad.status, 1);
  assert.match(json(bad).error.message, /gemini/);
});

test("a described event is exactly an accepted event", (t) => {
  const { run } = fixture(t);
  for (const [id, host] of Object.entries(describe(t))) {
    if (host.plugin) continue;
    const events = Object.values(host.moments).filter(Boolean);
    for (const moment of events) {
      const target = command({ event: moment.event, ...(moment.matcher ? { matcher: "Bash" } : {}) });
      const r = run(withHost(id, target), ["--plan"]);
      assert.equal(r.status, 0, `${id} ${moment.event}: ${r.stdout}`);
      if (!moment.matcher) assert.equal(run(withHost(id, { ...target, matcher: "Bash" }), ["--plan"]).status, 1, `${id} ${moment.event} takes no matcher`);
    }
    assert.equal(run(withHost(id, command({ event: "NoSuchEvent" })), ["--plan"]).status, 1, id);
  }
});

// Facts that cite a capture are pinned against the file, recorded through the route the writer writes.
const dotted = (value, field) => field.split(".").reduce((node, key) => (node === null || typeof node !== "object" ? undefined : node[key]), value);
const capture = (source) => {
  const file = path.join(CAPTURES, source.slice("capture:".length));
  assert.ok(fs.existsSync(file), `${source} must exist`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
};

test("every moment that cites a capture matches its event and its first sample's fields", (t) => {
  let pinned = 0;
  for (const [id, host] of Object.entries(describe(t))) {
    for (const [name, moment] of Object.entries(host.moments)) {
      for (const fact of [moment, moment?.v2]) {
        if (!fact?.source.startsWith("capture:")) continue;
        pinned++;
        const file = capture(fact.source);
        assert.equal(file.event, fact.event, `${id} ${name}: ${fact.source}`);
        assert.ok(fact.payload.length, `${id} ${name}: a captured moment names its payload fields`);
        for (const field of fact.payload) assert.notEqual(dotted(file.samples[0].payload, field), undefined, `${id} ${name}: ${field} in ${fact.source}`);
      }
    }
  }
  assert.ok(pinned >= 20, `only ${pinned} moments are pinned`);
});

test("every effect that cites a capture is answered that way in the file", (t) => {
  let pinned = 0;
  for (const [id, host] of Object.entries(describe(t))) {
    for (const [name, effect] of Object.entries(host.effects)) {
      if (!effect?.source.startsWith("capture:")) continue;
      pinned++;
      const file = capture(effect.source);
      assert.deepEqual(effect.at, [file.event], `${id} ${name}`);
      const answers = file.samples;
      const seen = effect.key !== undefined ? answers.some((sample) => dotted(sample.hookAnswer, effect.key) !== undefined)
        : effect.exit !== undefined ? answers.some((sample) => sample.hookExit === effect.exit)
          : answers.some((sample) => typeof sample.hookAnswer === "string" && sample.hookAnswer !== "");
      assert.ok(seen, `${id} ${name}: nothing in ${effect.source} answers ${JSON.stringify({ key: effect.key, exit: effect.exit })}`);
    }
  }
  assert.ok(pinned >= 10, `only ${pinned} effects are pinned`);
});

test("every host names its shell tool, and a captured name is one the host really sent", (t) => {
  for (const [id, host] of Object.entries(describe(t))) {
    assert.ok(host.shell && "value" in host.shell, `${id}: names its shell tool, or null when undocumented`);
    if (!host.shell.source.startsWith("capture:")) continue;
    const file = capture(host.shell.source);
    const field = host.moments["before-tool"].payload[0];
    const sent = file.samples.map((sample) => dotted(sample.payload, field));
    for (const name of [].concat(host.shell.value)) assert.ok(sent.includes(name), `${id}: ${name} in ${host.shell.source}`);
  }
});

test("every host names the argument its shell tool takes the command in, as a capture holds it", (t) => {
  for (const [id, host] of Object.entries(describe(t))) {
    assert.ok("command" in host.shell, `${id}: names its shell command argument, or null when undocumented`);
    if (!host.shell.source.startsWith("capture:")) continue;
    const [nameField, inputField] = host.moments["before-tool"].payload;
    const call = capture(host.shell.source).samples.find((sample) => dotted(sample.payload, nameField) === host.shell.value);
    assert.equal(typeof dotted(call.payload, inputField)?.[host.shell.command], "string", `${id}: ${host.shell.command} in ${host.shell.source}`);
  }
});

test("a Copilot fact cites only a capture of the camelCase route the writer writes", (t) => {
  for (const fact of facts(describe(t, "--hosts", "copilot").copilot)) assert.match(fact.source, /^(https:\/\/|capture:copilot-camel-)/);
});

test("Copilot names the Claude Code hooks it also runs", (t) => {
  const { alsoRuns } = describe(t, "--hosts", "copilot").copilot;
  assert.match(alsoRuns?.value ?? "", /\.claude\/settings\.json/);
  assert.match(alsoRuns.source, /^https:\/\//);
});

test("a write that succeeds deletes its input file, and a plan or a refusal keeps it", (t) => {
  const { dir, run, write } = fixture(t);
  const input = path.join(dir, "input.json");
  assert.equal(run(hook, ["--plan"]).status, 0);
  assert.ok(fs.existsSync(input), "a plan keeps the input");
  assert.equal(run().status, 0);
  assert.ok(!fs.existsSync(input), "a write deletes the input");
  write(".claude/hooks/guard-shell.cjs", "edited by hand\n");
  assert.equal(run().status, 1);
  assert.ok(fs.existsSync(input), "a refusal keeps the input");
});
