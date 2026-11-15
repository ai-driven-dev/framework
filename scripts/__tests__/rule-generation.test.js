const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");

const skill = path.resolve(__dirname, "../../plugins/aidd-context/skills/05-rule-generate");
const NATIVE = "claude,cursor,copilot,antigravity";
const rule = { category: "01-standards", slug: "1-naming", description: "Naming", paths: ["src/**/*.ts", "test/**/*.ts"], body: "# Naming\n\n- Keep names clear.\n" };
const SRC = "aidd_docs/rules/01-standards/1-naming.md";
const CLAUDE = ".claude/rules/01-standards/1-naming.md";
const CURSOR = ".cursor/rules/01-standards/1-naming.mdc";
const COPILOT = ".github/instructions/01-naming.instructions.md";
const AGY = ".agents/rules/1-naming.md";
const sha = (t) => createHash("sha256").update(t).digest("hex");
const json = (r) => JSON.parse(r.stdout);
const paths = (files, operation) => files.filter((file) => !operation || file.operation === operation).map((file) => file.path).sort();

function fixture(t) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "aidd-rule-")));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const project = path.join(dir, "project");
  const installed = path.join(dir, "installed");
  fs.mkdirSync(project);
  fs.cpSync(skill, installed, { recursive: true });
  const script = path.join(installed, "scripts/write-rule.cjs");
  assert.ok(fs.existsSync(script), "installed skill must contain its standalone script");
  const exec = (...args) => spawnSync(process.execPath, [script, "--project", project, ...args], { encoding: "utf8", cwd: dir, env: { PATH: "" } });
  function run(request = rule, tools = NATIVE, extra = []) {
    const input = path.join(dir, "input.json");
    fs.writeFileSync(input, Buffer.isBuffer(request) ? request : JSON.stringify(request));
    return exec(...(tools ? ["--tools", tools] : []), ...(extra.length ? extra : ["--input", input]));
  }
  const put = (name, content) => {
    const file = path.join(project, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  };
  function snapshot() {
    const files = {};
    (function walk(d, prefix = "") {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (e.isDirectory()) walk(path.join(d, e.name), `${prefix}${e.name}/`);
        else files[prefix + e.name] = fs.readFileSync(path.join(d, e.name), "utf8");
      }
    })(project);
    return files;
  }
  return { run, put, snapshot, project, dir, exec, read: (n) => fs.readFileSync(path.join(project, n), "utf8"), has: (n) => fs.existsSync(path.join(project, n)) };
}

const input = (f) => ["--input", path.join(f.dir, "input.json")];

test("scoped native copies are pure and byte exact", (t) => {
  const f = fixture(t);
  const r = f.run();
  assert.equal(r.status, 0, r.stdout);
  const g = "src/**/*.ts,test/**/*.ts";
  assert.equal(f.read(CLAUDE), `---\npaths:\n  - "src/**/*.ts"\n  - "test/**/*.ts"\n---\n${rule.body}`);
  assert.equal(f.read(CURSOR), `---\ndescription: "Naming"\nglobs: src/**/*.ts, test/**/*.ts\nalwaysApply: false\n---\n${rule.body}`);
  assert.equal(f.read(COPILOT), `---\napplyTo: "${g}"\n---\n${rule.body}`);
  assert.equal(f.read(AGY), `---\ndescription: "Naming"\ntrigger: glob\nglobs: "${g}"\n---\n${rule.body}`);
  assert.equal(f.read(SRC), `---\ndescription: "Naming"\npaths:\n  - "src/**/*.ts"\n  - "test/**/*.ts"\ntargets: [claude, cursor, copilot, antigravity]\n---\n\n${rule.body}`);
  const before = f.snapshot();
  const again = f.run();
  assert.equal(again.status, 0);
  assert.deepEqual(json(again).files, []);
  assert.deepEqual(f.snapshot(), before);
});

test("all-files native copies are pure and byte exact", (t) => {
  const f = fixture(t);
  assert.equal(f.run({ ...rule, paths: undefined }).status, 0);
  assert.equal(f.read(CLAUDE), rule.body);
  assert.equal(f.read(CURSOR), `---\ndescription: "Naming"\nalwaysApply: true\n---\n${rule.body}`);
  assert.equal(f.read(COPILOT), `---\napplyTo: "**"\n---\n${rule.body}`);
  assert.equal(f.read(AGY), `---\ndescription: "Naming"\ntrigger: always_on\n---\n${rule.body}`);
  assert.equal(f.read(SRC), `---\ndescription: "Naming"\ntargets: [claude, cursor, copilot, antigravity]\n---\n\n${rule.body}`);
});

test("codex index is created, updated, removed and outside text is preserved", (t) => {
  const f = fixture(t);
  const user = "User text\r\nmore\n";
  f.put("AGENTS.md", user);
  assert.equal(f.run(rule, "codex").status, 0);
  const block = (lines) => `<!-- aidd_rules:start -->\nBefore editing a file, read each rule whose scope matches it.\n\n${lines}\n<!-- aidd_rules:end -->\n`;
  const first = "- `src/**/*.ts`, `test/**/*.ts`: [Naming](aidd_docs/rules/01-standards/1-naming.md)";
  assert.equal(f.read("AGENTS.md"), `${user}\n${block(first)}`);
  f.put("AGENTS.md", f.read("AGENTS.md") + "Suffix\n");
  assert.equal(f.run({ ...rule, slug: "1-other", paths: [], body: "# Other\n" }, "codex").status, 0);
  assert.equal(f.read("AGENTS.md"), `${user}\n${block(`${first}\n- all files: [Other](aidd_docs/rules/01-standards/1-other.md)`)}Suffix\n`);
  assert.equal(f.run(null, null, ["--remove", "01-standards/1-other"]).status, 0);
  assert.equal(f.run(null, null, ["--remove", "01-standards/1-naming"]).status, 0);
  assert.equal(f.read("AGENTS.md"), `${user}Suffix\n`);
  assert.ok(!f.has(SRC));
});

test("codex creates AGENTS.md when absent and deletes it when emptied", (t) => {
  const f = fixture(t);
  assert.equal(f.run(rule, "codex").status, 0);
  assert.ok(f.read("AGENTS.md").startsWith("<!-- aidd_rules:start -->\n"));
  assert.equal(f.run(null, null, ["--remove", "01-standards/1-naming"]).status, 0);
  assert.ok(!f.has("AGENTS.md"));
});

test("legacy signed native copy is migrated silently", (t) => {
  const f = fixture(t);
  const text = `---\npaths:\n  - "old/**"\n---\nOld body\n`;
  f.put(CLAUDE, `${text}\n<!-- aidd_rule_output:path=${CLAUDE} sha256=${sha(text)} -->\n`);
  const r = f.run(rule, "claude");
  assert.equal(r.status, 0, r.stdout);
  assert.deepEqual(json(r).conflicts, []);
  assert.ok(f.read(CLAUDE).endsWith(rule.body) && !f.read(CLAUDE).includes("aidd_rule_output"));
});

test("hand-edited copy conflicts without writing, then --force overwrites", (t) => {
  const f = fixture(t);
  f.put(CURSOR, "mine\n");
  const before = f.snapshot();
  const planned = f.run(rule, NATIVE, [...input(f), "--plan"]);
  assert.deepEqual(json(planned).conflicts, [CURSOR]);
  assert.ok(paths(json(planned).files, "update").includes(CURSOR));
  const r = f.run();
  assert.equal(r.status, 1);
  assert.equal(json(r).error.code, "REFUSED");
  assert.ok(json(r).error.message.includes(CURSOR));
  assert.deepEqual(f.snapshot(), before);
  const forced = f.run(rule, NATIVE, [...input(f), "--force"]);
  assert.equal(forced.status, 0, forced.stdout);
  assert.ok(f.read(CURSOR).includes('description: "Naming"'));
  assert.ok(f.has(CLAUDE));
});

test("updating a rule rewrites its own previous copies without conflict", (t) => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  const r = f.run({ ...rule, body: "# Naming\n\n- New.\n" });
  assert.equal(r.status, 0, r.stdout);
  assert.ok(f.read(CLAUDE).endsWith("- New.\n"));
});

test("--plan writes nothing and lists files to create, update or delete and conflicts", (t) => {
  const f = fixture(t);
  const before = f.snapshot();
  const r = f.run(rule, NATIVE + ",opencode", ["--plan", ...input(f)]);
  assert.equal(r.status, 0, r.stdout);
  const p = json(r);
  assert.deepEqual(Object.keys(p), ["files", "conflicts"]);
  assert.deepEqual(paths(p.files, "create"), [SRC, CLAUDE, CURSOR, COPILOT, AGY, OPENCODE, "opencode.json"].sort());
  assert.deepEqual(p.conflicts, []);
  assert.deepEqual(f.snapshot(), before);
  assert.equal(f.run().status, 0);
  const edit = f.run({ ...rule, body: "# Naming\n\n- Keep names short.\n" }, NATIVE, ["--plan", ...input(f)]);
  assert.deepEqual(paths(json(edit).files, "update"), [SRC, CLAUDE, CURSOR, COPILOT, AGY].sort());
  const del = f.run(null, null, ["--plan", "--remove", "01-standards/1-naming"]);
  assert.equal(del.status, 0);
  assert.deepEqual(paths(json(del).files, "delete"), [SRC, CLAUDE, CURSOR, COPILOT, AGY].sort());
  assert.equal(f.run(null, null, ["--plan", "--remove", "01-standards/1-absent"]).status, 1);
});

test("--publish after a source edit conflicts on stale copies, --force republishes", (t) => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  f.put(SRC, f.read(SRC).replace("Keep names clear", "Edited"));
  assert.equal(f.run(null, NATIVE, ["--publish"]).status, 1);
  assert.ok(!f.read(CLAUDE).includes("Edited"));
  assert.equal(f.run(null, NATIVE, ["--publish", "--force"]).status, 0);
  assert.ok(f.read(CLAUDE).includes("Edited"));
});

test("--remove removes source, copies and index line", (t) => {
  const f = fixture(t);
  assert.equal(f.run(rule, `${NATIVE},codex`).status, 0);
  assert.ok(f.read("AGENTS.md").includes("[Naming]"));
  const r = f.run(null, null, ["--remove", "01-standards/1-naming"]);
  assert.equal(r.status, 0, r.stdout);
  for (const n of [SRC, CLAUDE, CURSOR, COPILOT, AGY, "AGENTS.md"]) assert.ok(!f.has(n), n);
});

test("delete conflicts on an edited copy", (t) => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  f.put(CLAUDE, "edited\n");
  const before = f.snapshot();
  assert.equal(f.run(null, null, ["--remove", "01-standards/1-naming"]).status, 1);
  assert.deepEqual(f.snapshot(), before);
});

test("symlinked directory refuses without escape", (t) => {
  const f = fixture(t);
  const outside = path.join(f.dir, "outside");
  fs.mkdirSync(outside);
  fs.mkdirSync(path.join(f.project, ".claude"));
  fs.symlinkSync(outside, path.join(f.project, ".claude/rules"));
  assert.equal(f.run().status, 1);
  assert.deepEqual(fs.readdirSync(outside), []);
  assert.ok(!f.has("aidd_docs"));
});

test("symlinked project is refused", (t) => {
  const f = fixture(t);
  const link = path.join(f.dir, "link");
  fs.symlinkSync(f.project, link);
  const r = spawnSync(process.execPath, [path.join(f.dir, "installed/scripts/write-rule.cjs"), "--project", link, "--tools", "claude", "--publish"], { encoding: "utf8", env: { PATH: "" } });
  assert.equal(r.status, 1);
});

for (const [label, change] of [
  ["category and slug digit mismatch", { slug: "2-naming" }],
  ["unknown category", { category: "01-nope" }],
  ["traversal slug", { slug: "../escape" }],
  ["comma in path", { paths: ["src/{a,b}.ts"] }],
  ["newline in description", { description: "a\nb" }],
  ["empty body", { body: "  \n" }],
  ["body without a title heading", { body: "Keep names clear.\n" }],
]) test(`${label} refuses before any write`, (t) => {
  const f = fixture(t);
  const before = f.snapshot();
  const r = f.run({ ...rule, ...change });
  assert.equal(r.status, 1);
  assert.equal(json(r).error.code, "REFUSED");
  assert.deepEqual(f.snapshot(), before);
});

test("unknown tool refuses and bad usage exits 2", (t) => {
  const f = fixture(t);
  assert.equal(f.run(rule, "claude,nope").status, 1);
  assert.equal(f.exec("--tools", "claude").status, 2);
  assert.equal(f.exec("--tools", "claude", "--plan").status, 2);
  assert.equal(f.exec("--publish", "--check").status, 2);
});

test("a missing project and an unreadable input refuse", (t) => {
  const f = fixture(t);
  const script = path.join(f.dir, "installed/scripts/write-rule.cjs");
  const missing = spawnSync(process.execPath, [script, "--project", path.join(f.dir, "absent"), "--publish"], { encoding: "utf8", env: { PATH: "" } });
  assert.equal(missing.status, 1, missing.stdout);
  assert.equal(json(missing).error.code, "REFUSED");
  const unreadable = f.exec("--tools", "claude", "--input", path.join(f.dir, "absent.json"));
  assert.equal(unreadable.status, 1, unreadable.stdout);
  assert.equal(json(unreadable).error.code, "REFUSED");
});

test("legacy aidd_rule header source is converted", (t) => {
  const f = fixture(t);
  const meta = { version: 1, category: "01-standards", slug: "1-naming", description: "Naming", paths: ["src/**"], targets: ["claude"] };
  f.put(SRC, `<!-- aidd_rule:${JSON.stringify(meta)} -->\n${rule.body}`);
  const r = f.run(null, "claude", ["--publish"]);
  assert.equal(r.status, 0, r.stdout);
  assert.equal(f.read(SRC), `---\ndescription: "Naming"\npaths:\n  - "src/**"\ntargets: [claude]\n---\n\n${rule.body}`);
  assert.equal(f.read(CLAUDE), `---\npaths:\n  - "src/**"\n---\n${rule.body}`);
});

test("legacy inline AGENTS block is converted to the index", (t) => {
  const f = fixture(t);
  const meta = { version: 1, category: "01-standards", slug: "1-naming", description: "Naming", paths: [], targets: ["codex"] };
  f.put(SRC, `<!-- aidd_rule:${JSON.stringify(meta)} -->\n${rule.body}`);
  const payload = `## Naming\nApplies to: all files.\n\n${rule.body}`;
  const h = sha(`separator=1\n${payload}`);
  f.put("AGENTS.md", `User\n\n<!-- aidd_rules:start sha256=${h} separator=1 -->\n${payload}<!-- aidd_rules:end -->\nTail\n`);
  const r = f.run(null, "codex", ["--publish"]);
  assert.equal(r.status, 0, r.stdout);
  assert.equal(f.read("AGENTS.md"), "User\n\n<!-- aidd_rules:start -->\nBefore editing a file, read each rule whose scope matches it.\n\n- all files: [Naming](aidd_docs/rules/01-standards/1-naming.md)\n<!-- aidd_rules:end -->\nTail\n");
  // an edited legacy block is refused, even with --force
  f.put("AGENTS.md", `<!-- aidd_rules:start sha256=${h} separator=0 -->\n${payload}<!-- aidd_rules:end -->\n`);
  const before = f.snapshot();
  for (const extra of [["--publish"], ["--publish", "--force"]]) {
    const bad = f.run(null, null, extra);
    assert.equal(bad.status, 1, bad.stdout);
    assert.equal(json(bad).error.code, "REFUSED");
  }
  assert.deepEqual(f.snapshot(), before);
});

test("publish keeps each rule's own hosts unless --tools adds some", (t) => {
  const f = fixture(t);
  assert.equal(f.run(rule, "claude").status, 0);
  assert.equal(f.run({ ...rule, slug: "1-other" }, "cursor,codex").status, 0);
  const before = f.snapshot();
  assert.deepEqual(json(f.run(null, null, ["--plan", "--publish"])).files, []);
  assert.equal(f.run(null, null, ["--publish"]).status, 0);
  assert.deepEqual(f.snapshot(), before);
  const added = f.run(null, "copilot", ["--plan", "--publish"]);
  assert.ok(paths(json(added).files).includes(COPILOT));
  assert.deepEqual(f.snapshot(), before);
});

test("a file where a directory is expected blocks before any write", (t) => {
  const f = fixture(t);
  f.put(".cursor", "a file where a directory must be\n");
  const before = f.snapshot();
  const r = f.run();
  assert.equal(r.status, 3, r.stdout);
  assert.equal(json(r).error.code, "ENOTDIR");
  assert.ok(json(r).error.message.includes(CURSOR));
  assert.deepEqual(f.snapshot(), before);
});

const KILO = ".kilo/rules/01-standards-1-naming.md";
const OPENCODE = ".opencode/rules/01-standards-1-naming.md";
const scopeLine = "Applies to files matching `src/**/*.ts`, `test/**/*.ts`.\n\n";

test("kilo gets rule copies and creates kilo.jsonc with its entry", (t) => {
  const f = fixture(t);
  assert.equal(f.run(rule, "kilo").status, 0);
  assert.equal(f.read(KILO), scopeLine + rule.body);
  assert.equal(f.read("kilo.jsonc"), '{\n  "instructions": [".kilo/rules/*.md"]\n}\n');
  assert.ok(!f.has("AGENTS.md"));
  assert.equal(f.run({ ...rule, slug: "1-other", paths: [] }, "kilo").status, 0);
  assert.equal(f.read(".kilo/rules/01-standards-1-other.md"), rule.body);
  const before = f.snapshot();
  const again = f.run(rule, "kilo");
  assert.equal(again.status, 0);
  assert.deepEqual(json(again).files, []);
  assert.deepEqual(f.snapshot(), before);
});

test("opencode appends its entry to an existing config and keeps the rest", (t) => {
  const f = fixture(t);
  f.put("opencode.json", '{"$schema":"x"}\n');
  assert.equal(f.run(rule, "opencode").status, 0);
  assert.equal(f.read(OPENCODE), scopeLine + rule.body);
  assert.deepEqual(JSON.parse(f.read("opencode.json")), { $schema: "x", instructions: [".opencode/rules/*.md"] });
  assert.ok(!f.has("AGENTS.md"));
});

test("kilo appends its entry to a config under .kilo", (t) => {
  const f = fixture(t);
  f.put(".kilo/kilo.json", '{"$schema":"x"}\n');
  assert.equal(f.run(rule, "kilo").status, 0);
  assert.deepEqual(JSON.parse(f.read(".kilo/kilo.json")), { $schema: "x", instructions: [".kilo/rules/*.md"] });
  assert.ok(!f.has("kilo.jsonc"));
});

test("an entry already in a commented config leaves it byte identical", (t) => {
  const f = fixture(t);
  const config = '// c\n{"instructions": [".opencode/rules/*.md"]}\n';
  f.put("opencode.jsonc", config);
  assert.equal(f.run(rule, "opencode").status, 0);
  assert.equal(f.read("opencode.jsonc"), config);
  assert.ok(!f.has("opencode.json"));
});

test("a commented config without the entry refuses and names the text to add", (t) => {
  const f = fixture(t);
  f.put("opencode.jsonc", "// c\n{}\n");
  const before = f.snapshot();
  const r = f.run(rule, "opencode");
  assert.equal(r.status, 1);
  assert.equal(json(r).error.code, "REFUSED");
  assert.ok(json(r).error.message.includes(".opencode/rules/*.md"));
  assert.deepEqual(f.snapshot(), before);
});

test("several opencode configs without the entry refuse and write nothing", (t) => {
  const f = fixture(t);
  f.put("opencode.json", "{}\n");
  f.put("opencode.jsonc", "{}\n");
  const before = f.snapshot();
  const r = f.run(rule, "opencode");
  assert.equal(r.status, 1);
  assert.ok(json(r).error.message.includes("opencode.json and opencode.jsonc"));
  assert.deepEqual(f.snapshot(), before);
});

test("an instructions value that is not an array refuses", (t) => {
  const f = fixture(t);
  f.put("opencode.json", '{"instructions":"x"}\n');
  const before = f.snapshot();
  const r = f.run(rule, "opencode");
  assert.equal(r.status, 1);
  assert.equal(json(r).error.code, "REFUSED");
  assert.ok(json(r).error.message.includes(".opencode/rules/*.md"));
  assert.deepEqual(f.snapshot(), before);
});

test("a publish plan restores each removed host config entry", (t) => {
  const f = fixture(t);
  assert.equal(f.run(rule, "kilo,opencode").status, 0);
  assert.deepEqual(json(f.run(null, null, ["--plan", "--publish"])).files, []);
  f.put("opencode.json", "{}\n");
  f.put("kilo.jsonc", "{}\n");
  assert.deepEqual(paths(json(f.run(null, null, ["--plan", "--publish"])).files, "update"), ["kilo.jsonc", "opencode.json"]);
});

test("removing the last rule keeps the config entry", (t) => {
  const f = fixture(t);
  assert.equal(f.run(rule, "opencode").status, 0);
  assert.equal(f.run(null, null, ["--remove", "01-standards/1-naming"]).status, 0);
  assert.ok(!f.has(OPENCODE));
  assert.ok(f.read("opencode.json").includes(".opencode/rules/*.md"));
});

test("an old AGENTS.md index line of an opencode-only rule is dropped on publish", (t) => {
  const f = fixture(t);
  f.put(SRC, `---\ndescription: "Naming"\ntargets: [opencode]\n---\n\n${rule.body}`);
  f.put("AGENTS.md", "User\n\n<!-- aidd_rules:start -->\nBefore editing a file, read each rule whose scope matches it.\n\n- all files: [Naming](aidd_docs/rules/01-standards/1-naming.md)\n<!-- aidd_rules:end -->\n");
  assert.equal(f.run(null, null, ["--publish"]).status, 0);
  assert.equal(f.read("AGENTS.md"), "User\n");
  assert.equal(f.read(OPENCODE), rule.body);
});

test("antigravity output over 24000 bytes refuses", (t) => {
  const f = fixture(t);
  const before = f.snapshot();
  assert.equal(f.run({ ...rule, body: `# X\n${"x".repeat(24000)}` }, "antigravity").status, 1);
  assert.deepEqual(f.snapshot(), before);
});

const asRoot = process.getuid && process.getuid() === 0;
const noModes = asRoot ? "root ignores permissions" : process.platform === "win32" && "Windows ignores directory modes";

function runLocked(dirs, action) {
  for (const dir of dirs) fs.chmodSync(dir, 0o555);
  try {
    return action();
  } finally {
    for (const dir of dirs) fs.chmodSync(dir, 0o755);
  }
}

test("unwritable target blocks everything before any write", { skip: noModes }, (t) => {
  const f = fixture(t);
  const locked = path.join(f.project, ".cursor");
  fs.mkdirSync(locked);
  const before = f.snapshot();
  const r = runLocked([locked], () => f.run());
  assert.equal(r.status, 3);
  const { error } = json(r);
  assert.match(error.code, /^(EACCES|EPERM)$/);
  assert.ok(error.message.includes(CURSOR), error.message);
  assert.deepEqual(f.snapshot(), before);
  assert.ok(!f.has("aidd_docs"));
});

test("every blocked path is reported, not just the first", { skip: noModes }, (t) => {
  const f = fixture(t);
  const locked = [".cursor", ".agents"].map((name) => path.join(f.project, name));
  for (const dir of locked) fs.mkdirSync(dir);
  const r = runLocked(locked, () => f.run());
  assert.equal(r.status, 3);
  for (const name of [AGY, CURSOR]) assert.ok(json(r).error.message.includes(name), name);
  assert.ok(!f.has(SRC) && !f.has(CLAUDE));
});

test("unwritable parent blocks a delete before any removal", { skip: noModes }, (t) => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  const before = f.snapshot();
  const r = runLocked([path.join(f.project, path.dirname(CLAUDE))], () => f.run(null, null, ["--remove", "01-standards/1-naming"]));
  assert.equal(r.status, 3);
  assert.ok(json(r).error.message.includes(CLAUDE));
  assert.deepEqual(f.snapshot(), before);
});

test("a copy it cannot read exits 3", { skip: noModes }, (t) => {
  const f = fixture(t);
  assert.equal(f.run(rule, "claude").status, 0);
  const copy = path.join(f.project, CLAUDE);
  fs.chmodSync(copy, 0o000);
  const r = f.run(rule, "claude", [...input(f), "--plan"]);
  fs.chmodSync(copy, 0o644);
  assert.equal(r.status, 3, r.stdout);
  assert.match(json(r).error.code, /^(EACCES|EPERM)$/);
});

test("every non-zero exit prints parseable JSON on stdout", (t) => {
  const f = fixture(t);
  const usage = f.exec("--tools", "claude");
  assert.equal(usage.status, 2);
  assert.equal(json(usage).error.code, "USAGE");
  const refusal = f.run(rule, "claude,nope");
  assert.equal(refusal.status, 1);
  assert.equal(json(refusal).error.code, "REFUSED");
  const malformed = f.run(Buffer.from("{not json"), "claude");
  assert.equal(malformed.status, 1);
  assert.equal(json(malformed).error.code, "REFUSED");
});

test("an untrusted AGENTS.md block blocks only the codex index, never a copy host", (t) => {
  const f = fixture(t);
  const agents = "<!-- aidd_rules:start -->\nhand edit\n<!-- aidd_rules:start -->\n";
  f.put("AGENTS.md", agents);
  const r = f.run(rule, "claude");
  assert.equal(r.status, 0, r.stdout);
  assert.equal(f.read("AGENTS.md"), agents);
  assert.equal(f.run(rule, "codex").status, 1);
});
