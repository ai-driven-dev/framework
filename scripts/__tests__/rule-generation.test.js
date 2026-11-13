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
    return exec("--tools", tools, ...(extra.length ? extra : ["--input", input]));
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
  assert.equal(r.status, 0, r.stderr);
  const g = "src/**/*.ts,test/**/*.ts";
  assert.equal(f.read(CLAUDE), `---\npaths:\n  - "src/**/*.ts"\n  - "test/**/*.ts"\n---\n${rule.body}`);
  assert.equal(f.read(CURSOR), `---\ndescription: "Naming"\nglobs: "${g}"\nalwaysApply: false\n---\n${rule.body}`);
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
  assert.equal(f.run({ ...rule, slug: "1-other", paths: [], body: "- No title.\n" }, "codex").status, 0);
  assert.equal(f.read("AGENTS.md"), `${user}\n${block(`${first}\n- all files: [1-other](aidd_docs/rules/01-standards/1-other.md)`)}Suffix\n`);
  assert.equal(f.run(null, "codex", ["--delete", "01-standards/1-other"]).status, 0);
  assert.equal(f.run(null, "codex", ["--delete", "01-standards/1-naming"]).status, 0);
  assert.equal(f.read("AGENTS.md"), `${user}Suffix\n`);
  assert.ok(!f.has(SRC));
});

test("codex creates AGENTS.md when absent and deletes it when emptied", (t) => {
  const f = fixture(t);
  assert.equal(f.run(rule, "codex").status, 0);
  assert.ok(f.read("AGENTS.md").startsWith("<!-- aidd_rules:start -->\n"));
  assert.equal(f.run(null, "codex", ["--delete", "01-standards/1-naming"]).status, 0);
  assert.ok(!f.has("AGENTS.md"));
});

test("legacy signed native copy is migrated silently", (t) => {
  const f = fixture(t);
  const text = `---\npaths:\n  - "old/**"\n---\nOld body\n`;
  f.put(CLAUDE, `${text}\n<!-- aidd_rule_output:path=${CLAUDE} sha256=${sha(text)} -->\n`);
  const r = f.run(rule, "claude");
  assert.equal(r.status, 0, r.stderr);
  assert.ok(json(r).legacy.includes(CLAUDE));
  assert.deepEqual(json(r).conflicts, []);
  assert.ok(f.read(CLAUDE).endsWith(rule.body) && !f.read(CLAUDE).includes("aidd_rule_output"));
});

test("hand-edited copy conflicts without writing, then --force overwrites", (t) => {
  const f = fixture(t);
  f.put(CURSOR, "mine\n");
  const before = f.snapshot();
  const r = f.run();
  assert.equal(r.status, 1);
  assert.deepEqual(json(r).conflicts, [CURSOR]);
  assert.deepEqual(f.snapshot(), before);
  const forced = f.run(rule, NATIVE, [...input(f), "--force"]);
  assert.equal(forced.status, 0, forced.stderr);
  assert.ok(f.read(CURSOR).includes('description: "Naming"'));
  assert.ok(f.has(CLAUDE));
});

test("updating a rule rewrites its own previous copies without conflict", (t) => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  const r = f.run({ ...rule, body: "- New.\n" });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(f.read(CLAUDE).endsWith("- New.\n"));
});

test("--plan writes nothing and lists files, conflicts, unsupported and legacy", (t) => {
  const f = fixture(t);
  const before = f.snapshot();
  const r = f.run(rule, NATIVE + ",opencode", ["--plan", ...input(f)]);
  assert.equal(r.status, 0, r.stderr);
  const p = json(r);
  assert.equal(p.plan, true);
  assert.deepEqual(p.files.sort(), [SRC, CLAUDE, CURSOR, COPILOT, AGY].sort());
  assert.deepEqual([p.conflicts, p.legacy], [[], []]);
  assert.equal(p.unsupported.length, 1);
  assert.deepEqual(f.snapshot(), before);
  assert.equal(f.run().status, 0);
  const del = f.run(null, NATIVE, ["--plan", "--delete", "01-standards/1-naming"]);
  assert.equal(del.status, 0);
  assert.ok(json(del).files.includes(CLAUDE) && json(del).files.includes(SRC));
  assert.equal(f.run(null, NATIVE, ["--plan", "--delete", "01-standards/1-absent"]).status, 1);
});

test("--check --publish is clean, then detects drift without writing", (t) => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  const clean = f.run(null, NATIVE, ["--check", "--publish"]);
  assert.equal(clean.status, 0, clean.stderr);
  assert.deepEqual(json(clean).drift, []);
  f.put(COPILOT, "edited\n");
  const before = f.snapshot();
  const drift = f.run(null, NATIVE, ["--check", "--publish"]);
  assert.equal(drift.status, 1);
  assert.deepEqual(json(drift).drift, [COPILOT]);
  assert.deepEqual(f.snapshot(), before);
  fs.rmSync(path.join(f.project, CLAUDE));
  assert.deepEqual(json(f.run(null, NATIVE, ["--check", "--publish"])).drift.sort(), [CLAUDE, COPILOT].sort());
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

test("--delete removes source, copies and index line", (t) => {
  const f = fixture(t);
  assert.equal(f.run(rule, `${NATIVE},codex`).status, 0);
  assert.ok(f.read("AGENTS.md").includes("[Naming]"));
  const r = f.run(null, "claude", ["--delete", "01-standards/1-naming"]);
  assert.equal(r.status, 0, r.stderr);
  for (const n of [SRC, CLAUDE, CURSOR, COPILOT, AGY, "AGENTS.md"]) assert.ok(!f.has(n), n);
});

test("delete conflicts on an edited copy", (t) => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  f.put(CLAUDE, "edited\n");
  const before = f.snapshot();
  assert.equal(f.run(null, NATIVE, ["--delete", "01-standards/1-naming"]).status, 1);
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
]) test(`${label} refuses before any write`, (t) => {
  const f = fixture(t);
  const before = f.snapshot();
  const r = f.run({ ...rule, ...change });
  assert.equal(r.status, 1);
  assert.ok(r.stderr);
  assert.deepEqual(f.snapshot(), before);
});

test("unknown tool refuses and bad usage exits 2", (t) => {
  const f = fixture(t);
  assert.equal(f.run(rule, "claude,nope").status, 1);
  assert.equal(f.exec("--tools", "claude").status, 2);
  assert.equal(f.exec("--tools", "claude", "--check", "--delete", "01-standards/1-naming").status, 2);
  assert.equal(f.exec("--tools", "claude", "--plan").status, 2);
});

test("legacy aidd_rule header source is converted and listed", (t) => {
  const f = fixture(t);
  const meta = { version: 1, category: "01-standards", slug: "1-naming", description: "Naming", paths: ["src/**"], targets: ["claude"] };
  f.put(SRC, `<!-- aidd_rule:${JSON.stringify(meta)} -->\n${rule.body}`);
  const r = f.run(null, "claude", ["--publish"]);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(json(r).legacy.includes(SRC));
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
  assert.equal(r.status, 0, r.stderr);
  assert.ok(json(r).legacy.includes("AGENTS.md"));
  assert.equal(f.read("AGENTS.md"), "User\n\n<!-- aidd_rules:start -->\nBefore editing a file, read each rule whose scope matches it.\n\n- all files: [Naming](aidd_docs/rules/01-standards/1-naming.md)\n<!-- aidd_rules:end -->\nTail\n");
  // an edited legacy block is a conflict
  f.put("AGENTS.md", `<!-- aidd_rules:start sha256=${h} separator=0 -->\n${payload}<!-- aidd_rules:end -->\n`);
  const before = f.snapshot();
  const bad = f.run(null, "codex", ["--publish"]);
  assert.equal(bad.status, 1);
  assert.deepEqual(json(bad).conflicts, ["AGENTS.md"]);
  assert.deepEqual(f.snapshot(), before);
});

test("opencode instructions entry is reported missing, then present", (t) => {
  const f = fixture(t);
  const r = f.run(rule, "opencode");
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(json(r).unsupported, [{ tool: "opencode", missing: "aidd_docs/rules/*/*.md", file: "opencode.json" }]);
  assert.ok(!f.has("opencode.json") && !f.has("AGENTS.md"));
  f.put("opencode.json", '{"instructions":["aidd_docs/rules/*/*.md"]}');
  const before = f.snapshot();
  const ok = f.run(rule, "opencode");
  assert.deepEqual(json(ok).unsupported, []);
  assert.deepEqual(f.snapshot(), before);
});

test("antigravity output over 24000 bytes refuses", (t) => {
  const f = fixture(t);
  const before = f.snapshot();
  assert.equal(f.run({ ...rule, body: "x".repeat(24000) }, "antigravity").status, 1);
  assert.deepEqual(f.snapshot(), before);
});
