const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");

const skill = path.resolve(__dirname, "../../plugins/aidd-context/skills/05-rule-generate");
const ALL = "claude,cursor,copilot,codex,opencode";
const rule = { category: "01-standards", slug: "1-naming", description: "Naming", paths: ["src/**/*.ts", "test/**/*.ts"], body: "# Naming\n\n- Keep names clear.\n\n```md\n<!-- aidd_rules:end -->\n```\n" };

function fixture(t) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "aidd-rule-")));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const project = path.join(dir, "project");
  const installed = path.join(dir, "installed");
  fs.mkdirSync(project);
  fs.cpSync(skill, installed, { recursive: true });
  fs.writeFileSync(path.join(project, "package.json"), '{"type":"module"}');
  const script = path.join(installed, "scripts/write-rule.cjs");
  assert.ok(fs.existsSync(script), "installed skill must contain its standalone script");
  function run(request = rule, tools = ALL, extra = []) {
    const input = path.join(dir, "input.json");
    fs.writeFileSync(input, Buffer.isBuffer(request) ? request : JSON.stringify(request));
    return spawnSync(process.execPath, [script, "--project", project, "--tools", tools, ...(extra.length ? extra : ["--input", input])], { encoding: "utf8", cwd: dir, env: { PATH: "" } });
  }
  function put(name, content) {
    const target = path.join(project, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  function snapshot() {
    const files = {};
    function walk(dir, prefix = "") {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const name = prefix + entry.name;
        if (entry.isDirectory()) walk(path.join(dir, entry.name), name + "/");
        else files[name] = entry.isSymbolicLink() ? fs.readlinkSync(path.join(dir, entry.name)) : fs.readFileSync(path.join(dir, entry.name));
      }
    }
    walk(project);
    return files;
  }
  return { run, put, snapshot, project, dir, read: (name) => fs.readFileSync(path.join(project, name), "utf8") };
}

test("copied installed skill generates native adapters without CLI in an ESM project", (t) => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  const claude = f.read(".claude/rules/01-standards/1-naming.md");
  assert.match(claude, /^---\npaths:\n  - "src\/\*\*\/\*.ts"\n  - "test\/\*\*\/\*.ts"\n---\n/);
  assert.match(f.read(".cursor/rules/01-standards/1-naming.mdc"), /globs: "src\/\*\*\/\*.ts,test\/\*\*\/\*.ts"\nalwaysApply: false/);
  assert.match(f.read(".github/instructions/01-naming.instructions.md"), /applyTo: "src\/\*\*\/\*.ts,test\/\*\*\/\*.ts"/);
  for (const name of [".claude/rules/01-standards/1-naming.md", ".cursor/rules/01-standards/1-naming.mdc", ".github/instructions/01-naming.instructions.md", "AGENTS.md", "aidd_docs/rules/01-standards/1-naming.md"]) assert.ok(f.read(name).includes(rule.body));
  assert.equal(f.read("AGENTS.md").split("# Naming").length, 2);
  assert.ok(!fs.existsSync(path.join(f.project, ".codex/rules")));
  const before = f.snapshot();
  assert.equal(f.run().status, 0);
  assert.deepEqual(f.snapshot(), before);
});

test("update and last deletion restore exact CRLF user and memory bytes", (t) => {
  const f = fixture(t);
  const original = "User\r\n<!-- aidd_project_memory:start -->\r\nMemory\r\n<!-- aidd_project_memory:end -->";
  f.put("AGENTS.md", original);
  assert.equal(f.run().status, 0);
  assert.equal(f.run({ ...rule, body: "- Updated full content.\n", paths: [] }).status, 0);
  assert.ok(!f.read("AGENTS.md").includes("# Naming"));
  assert.match(f.read(".cursor/rules/01-standards/1-naming.mdc"), /alwaysApply: true/);
  assert.equal(f.run(null, ALL, ["--delete", "01-standards/1-naming"]).status, 0);
  assert.equal(f.read("AGENTS.md"), original);
  assert.ok(!fs.existsSync(path.join(f.project, ".claude/rules/01-standards/1-naming.md")));
});

test("canonical body edits publish explicitly with target ownership intact", (t) => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  const source = "aidd_docs/rules/01-standards/1-naming.md";
  f.put(source, f.read(source).replace(rule.body, "- Manual source edit.\n"));
  assert.equal(f.run(null, ALL, ["--publish"]).status, 0);
  assert.match(f.read("AGENTS.md"), /Manual source edit/);
  assert.match(f.read(".claude/rules/01-standards/1-naming.md"), /Manual source edit/);
});

test("deterministic sources and shared deduplication across separately selected hosts", (t) => {
  const f = fixture(t);
  assert.equal(f.run({ ...rule, slug: "1-z-last", body: "- Last.\n" }, "codex").status, 0);
  assert.equal(f.run({ ...rule, slug: "1-a-first", body: "- First.\n" }, "opencode").status, 0);
  const agents = f.read("AGENTS.md");
  assert.ok(agents.indexOf("- First.") < agents.indexOf("- Last."));
  assert.equal(f.run(null, "codex,opencode", ["--publish"]).status, 0);
  assert.equal(f.read("AGENTS.md"), agents);
});

test("target changes remove stale native and shared text without activating unselected tools", (t) => {
  const f = fixture(t);
  f.put("AGENTS.md", "User\r\n");
  assert.equal(f.run().status, 0);
  assert.equal(f.run({ ...rule, body: "- Native only.\n" }, "claude").status, 0);
  assert.equal(f.read("AGENTS.md"), "User\r\n");
  assert.ok(!fs.existsSync(path.join(f.project, ".cursor/rules/01-standards/1-naming.mdc")));
  assert.ok(!fs.existsSync(path.join(f.project, ".github/instructions/01-naming.instructions.md")));
  assert.equal(f.run(null, "claude", ["--publish"]).status, 0);
  assert.match(f.read(".claude/rules/01-standards/1-naming.md"), /Native only/);
});

test("native-only generation leaves shared context and legacy sources untouched", (t) => {
  const f = fixture(t);
  f.put(".opencode/rules/01-standards/1-old.md", "legacy");
  f.put(".codex/rules/01-standards/1-old.md", "legacy codex");
  assert.equal(f.run({ ...rule, paths: [] }, "claude,cursor,copilot").status, 0);
  assert.ok(!fs.existsSync(path.join(f.project, "AGENTS.md")));
  assert.equal(f.read(".opencode/rules/01-standards/1-old.md"), "legacy");
  assert.equal(f.read(".codex/rules/01-standards/1-old.md"), "legacy codex");
  assert.ok(f.read(".claude/rules/01-standards/1-naming.md").startsWith(rule.body));
  assert.match(f.read(".github/instructions/01-naming.instructions.md"), /applyTo: "\*\*"/);
});

test("empty publication creates no AGENTS and malformed canonical metadata refuses", (t) => {
  const f = fixture(t);
  assert.equal(f.run(null, "codex,opencode", ["--publish"]).status, 0);
  assert.ok(!fs.existsSync(path.join(f.project, "AGENTS.md")));
  assert.equal(f.run().status, 0);
  const source = "aidd_docs/rules/01-standards/1-naming.md";
  f.put(source, f.read(source).replace('"version":1', '"version":2'));
  const before = f.snapshot();
  const result = f.run(null, ALL, ["--publish"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unsupported canonical metadata version/);
  assert.deepEqual(f.snapshot(), before);
});

test("CRLF body and user suffix, including fenced markers, remain byte exact", (t) => {
  const f = fixture(t);
  const user = "```md\r\n<!-- aidd_rules:end -->\r\n```\r\nUser";
  f.put("AGENTS.md", user);
  const body = "# Body\r\n\r\n~~~html\r\n<!-- aidd_rules:end -->\r\n~~~\r\n- Preserve.\r\n";
  assert.equal(f.run({ ...rule, body }, "codex,opencode").status, 0);
  f.put("AGENTS.md", f.read("AGENTS.md") + "Suffix\r\n");
  assert.equal(f.run(null, "codex,opencode", ["--publish"]).status, 0);
  assert.ok(f.read("AGENTS.md").includes(body));
  assert.equal(f.run(null, "codex,opencode", ["--delete", "01-standards/1-naming"]).status, 0);
  assert.equal(f.read("AGENTS.md"), user + "Suffix\r\n");
});

test("unsigned native prior canonical rendering proves ownership without replacing user files", (t) => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  const native = ".claude/rules/01-standards/1-naming.md";
  f.put(native, f.read(native).replace(/\n<!-- aidd_rule_output:[^\n]+ -->\n$/, ""));
  assert.equal(f.run({ ...rule, body: "- Updated.\n" }).status, 0);
  assert.match(f.read(native), /Updated/);
});

test("a signed native output copied from another rule is not same-rule ownership", (t) => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  assert.equal(f.run({ ...rule, slug: "1-other", body: "- Other rule.\n" }).status, 0);
  f.put(".claude/rules/01-standards/1-naming.md", f.read(".claude/rules/01-standards/1-other.md"));
  const before = f.snapshot();
  assert.notEqual(f.run({ ...rule, body: "- Update.\n" }).status, 0);
  assert.deepEqual(f.snapshot(), before);
});

for (const [label, change] of [
  ["traversal", { slug: "../escape" }],
  ["unknown metadata", { surprise: true }],
  ["comma glob ambiguity", { paths: ["src/{a,b}.ts"] }],
  ["scope marker injection", { description: "<!-- aidd_rules:end -->" }],
  ["reserved body marker", { body: "<!-- aidd_rules:end -->\n" }],
  ["frontmatter fence hides a marker", { body: "---\ndescription: |\n  ```\n---\n<!-- aidd_rules:end -->\n```\n" }],
  ["unclosed fence", { body: "```md\nexample\n" }],
]) test(`${label} refuses before any mutation`, (t) => {
  const f = fixture(t);
  f.put("AGENTS.md", "user\r\n");
  const before = f.snapshot();
  assert.notEqual(f.run({ ...rule, ...change }).status, 0);
  assert.deepEqual(f.snapshot(), before);
});

for (const kind of ["edited", "duplicate", "incomplete", "legacy"]) test(`${kind} shared contribution refuses before any mutation`, (t) => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  let agents = f.read("AGENTS.md");
  if (kind === "edited") agents = agents.replace("# Naming", "# Tampered");
  if (kind === "duplicate") agents += agents;
  if (kind === "incomplete") agents = agents.replace(/^<!-- aidd_rules:end -->\n/m, "");
  if (kind === "legacy") agents += "<!-- aidd_opencode_rules:start -->\nlegacy\n<!-- aidd_opencode_rules:end -->\n";
  f.put("AGENTS.md", agents);
  const before = f.snapshot();
  assert.notEqual(f.run({ ...rule, body: "- New.\n" }).status, 0);
  assert.deepEqual(f.snapshot(), before);
});

test("differing existing native output and edited generated native output refuse", (t) => {
  const f = fixture(t);
  const native = ".github/instructions/01-naming.instructions.md";
  f.put(native, "user rule\n");
  let before = f.snapshot();
  assert.notEqual(f.run().status, 0);
  assert.deepEqual(f.snapshot(), before);
  fs.rmSync(path.join(f.project, native));
  assert.equal(f.run().status, 0);
  f.put(native, f.read(native).replace("# Naming", "# Edited"));
  before = f.snapshot();
  assert.notEqual(f.run(null, ALL, ["--delete", "01-standards/1-naming"]).status, 0);
  assert.deepEqual(f.snapshot(), before);
});

for (const target of ["aidd_docs/rules", ".claude/rules", "AGENTS.md"]) test(`symlink ${target} refuses without escape`, (t) => {
  const f = fixture(t);
  const outside = path.join(f.dir, "outside");
  if (target === "AGENTS.md") fs.writeFileSync(outside, "external");
  else fs.mkdirSync(outside);
  fs.mkdirSync(path.dirname(path.join(f.project, target)), { recursive: true });
  fs.symlinkSync(outside, path.join(f.project, target));
  const before = f.snapshot();
  assert.notEqual(f.run().status, 0);
  assert.deepEqual(f.snapshot(), before);
});

test("Codex override and local 32 KiB limit refuse prospective writes", (t) => {
  const f = fixture(t);
  f.put("AGENTS.override.md", "override");
  let before = f.snapshot();
  assert.notEqual(f.run().status, 0);
  assert.deepEqual(f.snapshot(), before);
  fs.rmSync(path.join(f.project, "AGENTS.override.md"));
  before = f.snapshot();
  assert.notEqual(f.run({ ...rule, body: "x".repeat(32768) }).status, 0);
  assert.deepEqual(f.snapshot(), before);
});

test("invalid UTF-8 user context refuses without replacing bytes", (t) => {
  const f = fixture(t);
  const original = Buffer.from([0x55, 0xff, 0x0a]);
  f.put("AGENTS.md", original);
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /UTF-8/);
  assert.deepEqual(fs.readFileSync(path.join(f.project, "AGENTS.md")), original);
  assert.ok(!fs.existsSync(path.join(f.project, "aidd_docs/rules")));
});

for (const [prefix, from, to] of [["User\n", "0", "1"], ["User", "1", "0"]]) {
  for (const operation of ["update", "publish", "delete"]) test(`edited separator ${from}→${to} refuses ${operation} without byte changes`, (t) => {
    const f = fixture(t);
    f.put("AGENTS.md", prefix);
    assert.equal(f.run().status, 0);
    const agents = f.read("AGENTS.md");
    assert.match(agents, new RegExp(`separator=${from} -->`));
    f.put("AGENTS.md", agents.replace(`separator=${from} -->`, `separator=${to} -->`));
    const before = f.snapshot();
    const extra = operation === "update" ? [] : operation === "publish" ? ["--publish"] : ["--delete", "01-standards/1-naming"];
    const result = f.run({ ...rule, body: "- Updated.\n" }, ALL, extra);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Edited AIDD rule contribution/);
    assert.deepEqual(f.snapshot(), before);
  });
}

test("invalid UTF-8 staged JSON refuses before changing any project bytes", (t) => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  const before = f.snapshot();
  const input = Buffer.from(JSON.stringify({ ...rule, body: "" }));
  const position = input.indexOf('"body":"') + '"body":"'.length;
  const invalid = Buffer.concat([input.subarray(0, position), Buffer.from([0xff]), input.subarray(position)]);
  const result = f.run(invalid);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid UTF-8/);
  assert.deepEqual(f.snapshot(), before);
});

for (const surrogate of ["\ud800", "\udfff"]) {
  for (const field of ["body", "description", "paths"]) test(`unpaired ${surrogate.charCodeAt(0).toString(16)} in ${field} refuses without byte changes`, (t) => {
    const f = fixture(t);
    assert.equal(f.run().status, 0);
    const before = f.snapshot();
    const value = `invalid-${surrogate}`;
    const result = f.run({ ...rule, [field]: field === "paths" ? [value] : value });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /UTF-8|Unicode/);
    assert.deepEqual(f.snapshot(), before);
  });
}

test("valid Unicode pairs and CRLF body survive installed generation and publication", (t) => {
  const f = fixture(t);
  const body = "# Unicode 🐙\r\n\r\n- Preserve é and \ud83d\ude00 and �.\r\n";
  const request = { ...rule, body, description: "Unicode 🐙", paths: ["src/😀/**/*.ts"] };
  assert.equal(f.run(request).status, 0);
  for (const name of ["aidd_docs/rules/01-standards/1-naming.md", "AGENTS.md", ".claude/rules/01-standards/1-naming.md", ".cursor/rules/01-standards/1-naming.mdc", ".github/instructions/01-naming.instructions.md"]) {
    assert.ok(f.read(name).includes(body));
    assert.ok(f.read(name).includes("Unicode 🐙"));
    assert.ok(f.read(name).includes("src/😀/**/*.ts"));
  }
  const before = f.snapshot();
  assert.equal(f.run(null, ALL, ["--publish"]).status, 0);
  assert.deepEqual(f.snapshot(), before);
});
