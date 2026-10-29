const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");

test("static skill-eval cases specify idempotence and critical refusal checks", () => {
  const cases = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/skill-eval/cases.json"), "utf8"));
  const byName = new Map(cases.map((item) => [item.name, item]));
  const idempotence = byName.get("Kilo native skill uses one canonical tree");
  const noConsent = byName.get("Kilo cannot choose portable without agreement");
  const mixedSkill = byName.get("unsafe late Kilo target leaves earlier Claude target absent");
  const mixedHook = byName.get("invalid final mixed target stops before prior writes");
  assert.equal(idempotence.expect.repeat, true);
  for (const item of [noConsent, mixedSkill, mixedHook]) {
    assert.ok(item, "Missing critical execution case");
    assert.ok(item.expect.stdoutMatches?.length, item.name);
    assert.ok(item.expect.filesAbsent?.length, item.name);
    assert.ok(item.expect.filesUnchanged?.length, item.name);
  }
});

test("skill eval rejects invalid jobs and repeat counts before launching a host", (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "skill-eval-counts-"));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const spawnLog = path.join(tmp, "host-spawns.log");
  const preload = path.join(tmp, "forbid-host.cjs");
  fs.writeFileSync(preload, [
    'const fs = require("node:fs");',
    'const childProcess = require("node:child_process");',
    'childProcess.spawn = (command) => {',
    '  fs.appendFileSync(process.env.SKILL_EVAL_SPAWN_LOG, `${command}\\n`);',
    '  throw new Error("host launch must not happen for invalid counts");',
    '};',
    'require("node:module").syncBuiltinESMExports();',
  ].join("\n"));
  const invalid = [
    "--jobs=0", "--jobs=-1", "--jobs=1.5", "--jobs=Infinity", "--jobs=abc",
    "--repeat=0", "--repeat=-1", "--repeat=1.5", "--repeat=NaN", "--repeat=abc",
  ];
  for (const option of invalid) {
    const result = spawnSync(process.execPath, [
      "--require", preload,
      path.join(ROOT, "scripts/skill-eval.mjs"),
      "--host=codex",
      "--case=filename rule keeps a dotless name",
      option,
    ], {
      encoding: "utf8",
      env: { ...process.env, SKILL_EVAL_SPAWN_LOG: spawnLog },
    });
    assert.equal(result.status, 2, `${option}\n${result.stdout}${result.stderr}`);
    assert.match(result.stderr, /(jobs|repeat).*positive integer/iu, option);
    assert.doesNotMatch(result.stdout, /Running \d+ case/u, option);
  }
  assert.equal(fs.existsSync(spawnLog) ? fs.readFileSync(spawnLog, "utf8") : "", "");
});

test("bundled skills and agents leave model selection to the host", () => {
  const plugins = path.join(ROOT, "plugins");
  const files = fs.readdirSync(plugins, { recursive: true }).filter((file) =>
    /(?:\/SKILL\.md$|\/agents\/[^/]+\.md$|\/assets\/agent-template\.md$)/.test(file.replaceAll(path.sep, "/"))
  );
  assert.ok(files.length > 0);
  const overrides = files.filter((file) => {
    const content = fs.readFileSync(path.join(plugins, file), "utf8");
    const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    return frontmatter && /^model\s*:/m.test(frontmatter[1]);
  });
  assert.deepEqual(overrides, []);
});

for (const model of [undefined, "user-selected-model"]) {
  test(`skill eval ${model ? "honors an explicit model" : "does not override the host model"}`, (t) => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "model-selection-"));
    t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
    const argsFile = path.join(tmp, "args.json");
    const stub = path.join(tmp, "claude.cjs");
    fs.writeFileSync(stub, [
      'const fs = require("node:fs");',
      'fs.writeFileSync(process.env.MODEL_SELECTION_ARGS, JSON.stringify(process.argv.slice(2)));',
      'fs.writeFileSync("Makefile-shadow-report.md", "stub report");',
    ].join("\n"));
    const preload = path.join(tmp, "preload.cjs");
    fs.writeFileSync(preload, [
      'const childProcess = require("node:child_process");',
      'const spawn = childProcess.spawn;',
      `childProcess.spawn = (command, args, options) => command === "claude"`,
      `  ? spawn(process.execPath, [${JSON.stringify(stub)}, ...args], options)`,
      '  : spawn(command, args, options);',
      'require("node:module").syncBuiltinESMExports();',
    ].join("\n"));
    const result = spawnSync(process.execPath, [
      "--require", preload,
      path.join(ROOT, "scripts/skill-eval.mjs"),
      "--case=filename rule keeps a dotless name",
      ...(model ? [`--model=${model}`] : []),
    ], {
      encoding: "utf8",
      env: { ...process.env, MODEL_SELECTION_ARGS: argsFile },
    });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    const args = JSON.parse(fs.readFileSync(argsFile, "utf8"));
    const at = args.indexOf("--model");
    if (model) {
      assert.notEqual(at, -1);
      assert.equal(args[at + 1], model);
    } else {
      assert.equal(at, -1);
    }
  });
}

test("skill eval stages a worktree skill for Codex and checks its final output", (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "codex-skill-eval-"));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const stub = path.join(tmp, "codex.cjs");
  fs.writeFileSync(stub, [
    'const fs = require("node:fs");',
    'const path = require("node:path");',
    'const args = process.argv.slice(2);',
    'const cwd = process.cwd();',
    'if (!fs.existsSync(path.join(cwd, ".agents/skills/xeval-shadow/SKILL.md"))) process.exit(3);',
    'if (fs.existsSync(path.join(cwd, ".claude/skills/xeval-shadow/SKILL.md"))) process.exit(4);',
    'fs.writeFileSync("Makefile-shadow-report.md", "stub report");',
    'if (!process.env.MISSING_CODEX_OUTPUT) fs.writeFileSync(args[args.indexOf("-o") + 1], "completed");',
  ].join("\n"));
  const preload = path.join(tmp, "preload.cjs");
  fs.writeFileSync(preload, [
    'const childProcess = require("node:child_process");',
    'const spawn = childProcess.spawn;',
    `childProcess.spawn = (command, args, options) => command === "codex"`,
    `  ? spawn(process.execPath, [${JSON.stringify(stub)}, ...args], options)`,
    '  : spawn(command, args, options);',
    'require("node:module").syncBuiltinESMExports();',
  ].join("\n"));
  const result = spawnSync(process.execPath, [
    "--require", preload,
    path.join(ROOT, "scripts/skill-eval.mjs"),
    "--host=codex",
    "--case=filename rule keeps a dotless name",
  ], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  const missingOutput = spawnSync(process.execPath, [
    "--require", preload,
    path.join(ROOT, "scripts/skill-eval.mjs"),
    "--host=codex",
    "--case=filename rule keeps a dotless name",
  ], { encoding: "utf8", env: { ...process.env, MISSING_CODEX_OUTPUT: "1" } });
  assert.equal(missingOutput.status, 1, missingOutput.stdout + missingOutput.stderr);
});

test("skill eval marks a skipped judge incomplete instead of passing it", (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "skill-eval-judge-skip-"));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const stub = path.join(tmp, "codex.cjs");
  fs.writeFileSync(stub, [
    'const fs = require("node:fs");',
    'const args = process.argv.slice(2);',
    'fs.appendFileSync(process.env.SKILL_EVAL_CALLS, JSON.stringify(args) + "\\n");',
    'fs.writeFileSync(args[args.indexOf("-o") + 1], "Use `.kilo/plugin/`; `session.created` is documented.");',
  ].join("\n"));
  const preload = path.join(tmp, "preload.cjs");
  fs.writeFileSync(preload, [
    'const childProcess = require("node:child_process");',
    'const spawn = childProcess.spawn;',
    `childProcess.spawn = (command, args, options) => command === "codex"`,
    `  ? spawn(process.execPath, [${JSON.stringify(stub)}, ...args], options)`,
    '  : spawn(command, args, options);',
    'require("node:module").syncBuiltinESMExports();',
  ].join("\n"));
  const calls = path.join(tmp, "calls.jsonl");
  const result = spawnSync(process.execPath, [
    "--require", preload,
    path.join(ROOT, "scripts/skill-eval.mjs"),
    "--host=codex",
    "--case=Kilo-only session start gives guidance without files",
  ], { encoding: "utf8", env: { ...process.env, SKILL_EVAL_CALLS: calls } });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout, /INCOMPLETE \(judge skipped\)/u);
  assert.match(result.stdout, /0\/1 cases fully passed; 1 incomplete/u);
  assert.match(result.stdout, /1 judge evaluation\(s\) skipped/u);
  assert.doesNotMatch(result.stdout, /1\/1 cases fully passed/u);
  assert.equal(fs.readFileSync(calls, "utf8").trim().split("\n").length, 1);
});

test("skill eval runs a Codex judge with Codex rather than Claude", (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "skill-eval-codex-judge-"));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const stub = path.join(tmp, "codex.cjs");
  fs.writeFileSync(stub, [
    'const fs = require("node:fs");',
    'const args = process.argv.slice(2);',
    'fs.appendFileSync(process.env.SKILL_EVAL_CALLS, JSON.stringify(args) + "\\n");',
    'fs.writeFileSync(args[args.indexOf("-o") + 1], args.at(-1).includes("You grade a test") ? "PASS\\nvalid guidance" : "Use `.kilo/plugin/`; `session.created` is documented.");',
  ].join("\n"));
  const preload = path.join(tmp, "preload.cjs");
  fs.writeFileSync(preload, [
    'const childProcess = require("node:child_process");',
    'const spawn = childProcess.spawn;',
    `childProcess.spawn = (command, args, options) => ["codex", "claude"].includes(command)`,
    `  ? spawn(process.execPath, [${JSON.stringify(stub)}, command, ...args], options)`,
    '  : spawn(command, args, options);',
    'require("node:module").syncBuiltinESMExports();',
  ].join("\n"));
  const calls = path.join(tmp, "calls.jsonl");
  const result = spawnSync(process.execPath, [
    "--require", preload,
    path.join(ROOT, "scripts/skill-eval.mjs"),
    "--host=codex",
    "--judge",
    "--case=Kilo-only session start gives guidance without files",
  ], { encoding: "utf8", env: { ...process.env, SKILL_EVAL_CALLS: calls } });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout, /PASS  08-hook-generate/u);
  assert.match(result.stdout, /\(PASS \| valid guidance\)/u);
  const invocations = fs.readFileSync(calls, "utf8").trim().split("\n").map(JSON.parse);
  assert.equal(invocations.length, 2);
  assert.ok(invocations.every(([host]) => host === "codex"));
  assert.ok(invocations[1].at(-1).includes("You grade a test"));
});

test("skill eval checks documented event names and native hook JSON shapes", (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "skill-eval-hook-json-"));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const stub = path.join(tmp, "codex.cjs");
  fs.writeFileSync(stub, [
    'const fs = require("node:fs");',
    'const path = require("node:path");',
    'const args = process.argv.slice(2);',
    'if (!args.at(-1).includes("You grade a test")) {',
    '  const files = {',
    '    ".claude/settings.json": { hooks: { SessionStart: [{ hooks: [{ type: "command", command: "/hook.sh" }] }] } },',
    '    ".cursor/hooks.json": { version: 1, hooks: { sessionStart: [{ command: "/hook.sh" }] } },',
    '    ".github/hooks/aidd.json": { version: 1, hooks: { SessionStart: [{ type: "command", command: "/hook.sh" }] } },',
    '  };',
    '  for (const [file, value] of Object.entries(files)) {',
    '    fs.mkdirSync(path.dirname(file), { recursive: true });',
    '    fs.writeFileSync(file, JSON.stringify(value));',
    '  }',
    '}',
    'fs.writeFileSync(args[args.indexOf("-o") + 1], args.at(-1).includes("You grade a test") ? "PASS\\nnative hook entries are valid" : "Published Claude, Cursor and Copilot session-start hooks.");',
  ].join("\n"));
  const preload = path.join(tmp, "preload.cjs");
  fs.writeFileSync(preload, [
    'const childProcess = require("node:child_process");',
    'const spawn = childProcess.spawn;',
    `childProcess.spawn = (command, args, options) => command === "codex"`,
    `  ? spawn(process.execPath, [${JSON.stringify(stub)}, ...args], options)`,
    '  : spawn(command, args, options);',
    'require("node:module").syncBuiltinESMExports();',
  ].join("\n"));
  const result = spawnSync(process.execPath, [
    "--require", preload,
    path.join(ROOT, "scripts/skill-eval.mjs"),
    "--host=codex",
    "--judge",
    "--case=declarative session start publishes supported non-Codex targets",
  ], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /valid JSON: \.claude\/settings\.json/u);
  assert.match(result.stdout, /\.cursor\/hooks\.json matches/u);
  assert.match(result.stdout, /\.github\/hooks\/aidd\.json matches/u);
  assert.match(result.stdout, /judge: .*\(PASS \| native hook entries are valid\)/u);
});

test("skill eval detects unlisted writes in a guidance-only project tree", (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "skill-eval-guidance-write-"));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const stub = path.join(tmp, "codex.cjs");
  fs.writeFileSync(stub, [
    'const fs = require("node:fs");',
    'const args = process.argv.slice(2);',
    'fs.mkdirSync(".kilo/plugin", { recursive: true });',
    'fs.writeFileSync(".kilo/plugin/unrequested.js", "export {};\\n");',
    'fs.writeFileSync(args[args.indexOf("-o") + 1], "Use `.kilo/plugin/`; `session.created` is documented.");',
  ].join("\n"));
  const preload = path.join(tmp, "preload.cjs");
  fs.writeFileSync(preload, [
    'const childProcess = require("node:child_process");',
    'const spawn = childProcess.spawn;',
    `childProcess.spawn = (command, args, options) => command === "codex"`,
    `  ? spawn(process.execPath, [${JSON.stringify(stub)}, ...args], options)`,
    '  : spawn(command, args, options);',
    'require("node:module").syncBuiltinESMExports();',
  ].join("\n"));
  const result = spawnSync(process.execPath, [
    "--require", preload,
    path.join(ROOT, "scripts/skill-eval.mjs"),
    "--host=codex",
    "--case=Kilo-only session start gives guidance without files",
  ], { encoding: "utf8" });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /project tree changed:.*\.kilo\//u);
});

test("skill eval reports an executed idempotent rerun separately from its initial generation", (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "skill-eval-idempotence-"));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const stub = path.join(tmp, "codex.cjs");
  fs.writeFileSync(stub, [
    'const fs = require("node:fs");',
    'const path = require("node:path");',
    'const args = process.argv.slice(2);',
    'fs.appendFileSync(process.env.SKILL_EVAL_CALLS, "call\\n");',
    'const target = path.join(process.cwd(), ".kilo/skills/verify-payload");',
    'if (!fs.existsSync(target)) {',
    '  fs.mkdirSync(path.join(target, "actions"), { recursive: true });',
    '  fs.writeFileSync(path.join(target, "SKILL.md"), "---\\nname: verify-payload\\ndescription: verify fixture\\n---\\n");',
    '  fs.writeFileSync(path.join(target, "actions/01-verify.md"), "# Verify\\n");',
    '}',
    'fs.writeFileSync(args[args.indexOf("-o") + 1], "completed");',
  ].join("\n"));
  const preload = path.join(tmp, "preload.cjs");
  fs.writeFileSync(preload, [
    'const childProcess = require("node:child_process");',
    'const spawn = childProcess.spawn;',
    `childProcess.spawn = (command, args, options) => command === "codex"`,
    `  ? spawn(process.execPath, [${JSON.stringify(stub)}, ...args], options)`,
    '  : spawn(command, args, options);',
    'require("node:module").syncBuiltinESMExports();',
  ].join("\n"));
  const calls = path.join(tmp, "calls.txt");
  const result = spawnSync(process.execPath, [
    "--require", preload,
    path.join(ROOT, "scripts/skill-eval.mjs"),
    "--host=codex",
    "--case=Kilo native skill uses one canonical tree",
  ], { encoding: "utf8", env: { ...process.env, SKILL_EVAL_CALLS: calls } });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout, /idempotent rerun left project bytes and mtimes unchanged/u);
  assert.equal(fs.readFileSync(calls, "utf8").trim().split("\n").length, 2);
});
