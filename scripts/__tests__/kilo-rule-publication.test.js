const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");

const fixtureRoot = path.join(__dirname, "fixtures/context-generation/kilo-config");
const modulePath = process.env.AIDD_KILO_CONFIG_MODULE || path.resolve(__dirname, "../../plugins/aidd-context/skills/05-rule-generate/scripts/kilo-config.cjs");
const instruction = ".kilo/rules/01-standards/1-naming.md";

function project(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "aidd-kilo-config-")));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  function put(relative, data) {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, data);
  }
  function snapshot() {
    const found = new Map();
    function walk(dir, prefix = "") {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const name = prefix + entry.name;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, `${name}/`);
        else found.set(name, entry.isSymbolicLink() ? fs.readlinkSync(full) : fs.readFileSync(full));
      }
    }
    walk(root);
    return found;
  }
  return { root, put, snapshot };
}

function fixture(name) { return fs.readFileSync(path.join(fixtureRoot, name), "utf8"); }
function api() { return require(modulePath); }

test("no config proposes .kilo/kilo.jsonc without creating it", (t) => {
  const p = project(t);
  const before = p.snapshot();
  const choice = api().inspectProject(p.root, instruction);
  assert.equal(choice.selectedPath, ".kilo/kilo.jsonc");
  assert.equal(choice.needsChoice, false);
  assert.deepEqual(p.snapshot(), before);
});

test("each sole project config is selected, regardless of format or location", (t) => {
  for (const relative of [".kilo/kilo.json", ".kilo/kilo.jsonc", "kilo.json", "kilo.jsonc"]) {
    const p = project(t);
    p.put(relative, "{}\n");
    assert.equal(api().inspectProject(p.root, instruction).selectedPath, relative);
  }
});

test("one exact owner wins across four configs; nested, glob and comment witnesses do not", (t) => {
  const p = project(t);
  p.put(".kilo/kilo.jsonc", fixture("comments-and-trailing.jsonc"));
  p.put(".kilo/kilo.json", '{"instructions":[".kilo/rules/*.md"]}\n');
  p.put("kilo.json", `{"instructions":["${instruction}"]}\n`);
  p.put("kilo.jsonc", `{// "${instruction}"\n "instructions":[]}`);
  const choice = api().inspectProject(p.root, instruction);
  assert.equal(choice.selectedPath, "kilo.json");
  assert.equal(choice.needsChoice, false);
  assert.deepEqual(choice.candidates.map((item) => item.path), [".kilo/kilo.json", ".kilo/kilo.jsonc", "kilo.json", "kilo.jsonc"]);
});

test("multiple configs without an owner require choice; cancellation and explicit choice never write", (t) => {
  const p = project(t);
  p.put(".kilo/kilo.json", "{}\n");
  p.put("kilo.jsonc", "{}\n");
  const before = p.snapshot();
  const undecided = api().inspectProject(p.root, instruction);
  assert.equal(undecided.selectedPath, null);
  assert.equal(undecided.needsChoice, true);
  assert.equal(api().inspectProject(p.root, instruction, null).selectedPath, null);
  assert.equal(api().inspectProject(p.root, instruction, "kilo.jsonc").selectedPath, "kilo.jsonc");
  assert.deepEqual(p.snapshot(), before);
});

test("two exact owners remain ambiguous until explicit selection", (t) => {
  const p = project(t);
  for (const name of [".kilo/kilo.json", "kilo.jsonc"]) p.put(name, `{"instructions":["${instruction}"]}`);
  assert.equal(api().inspectProject(p.root, instruction).needsChoice, true);
  assert.equal(api().inspectProject(p.root, instruction, "kilo.jsonc").selectedPath, "kilo.jsonc");
});

test("JSONC insertion preserves every original byte, duplicate and order", () => {
  const original = fixture("comments-and-trailing.jsonc");
  const edited = api().prepareInstructionEdit(original, instruction);
  assert.equal(edited.changed, true);
  assert.equal(edited.content.replace(JSON.stringify(instruction) + ",", ""), original);
  assert.match(edited.content, /"docs\/first\.md",[\s\S]*"docs\/first\.md"/);
  const second = api().prepareInstructionEdit(edited.content, instruction);
  assert.deepEqual(second, { content: edited.content, changed: false });
});

test("escaped instructions key is reused, and absent key is inserted without serializing unrelated text", () => {
  const escaped = fixture("escaped-key.jsonc");
  const reused = api().prepareInstructionEdit(escaped, instruction);
  assert.equal(reused.content.replace(JSON.stringify(instruction), ""), escaped.replace('"docs/old.md"', '"docs/old.md",'));
  assert.equal((reused.content.match(/instructions|instruct\\u0069ons/g) || []).length, 1);
  const absent = "{\r\n  // untouched\r\n  \"other\": 1,\r\n}\r\n";
  const added = api().prepareInstructionEdit(absent, instruction);
  assert.equal(added.changed, true);
  assert.ok(added.content.includes("// untouched\r\n"));
  assert.ok(added.content.includes(`"instructions": ["${instruction}"]`));
});

test("existing exact entry is byte-identical even when duplicated", () => {
  const original = `{"instructions":["${instruction}","${instruction}",]}`;
  assert.deepEqual(api().prepareInstructionEdit(original, instruction), { content: original, changed: false });
});

test("JSONC handles empty arrays, scalar comments and CRLF without changing unrelated bytes", () => {
  for (const original of [
    '{"instructions":[]}',
    '{"instructions":["docs/old.md"/* retained */]}',
    '{\r\n "other": 1/* retained */,\r\n "instructions": [\r\n ]\r\n}\r\n',
  ]) {
    const result = api().prepareInstructionEdit(original, instruction);
    assert.equal(result.changed, true);
    assert.equal(api().prepareInstructionEdit(result.content, instruction).changed, false);
    assert.ok(result.content.includes(JSON.stringify(instruction)));
    if (original.includes("\r\n")) assert.ok(result.content.includes("\r\n"));
    if (original.includes("/* retained */")) assert.ok(result.content.includes("/* retained */"));
  }
});

test("copied CommonJS module runs in an ESM project without the CLI or checkout", (t) => {
  const p = project(t);
  p.put("package.json", '{"type":"module"}');
  const installed = path.join(p.root, "installed", "kilo-config.cjs");
  fs.mkdirSync(path.dirname(installed));
  fs.copyFileSync(modulePath, installed);
  const program = `const m=require(${JSON.stringify(installed)}); process.stdout.write(JSON.stringify(m.inspectProject(${JSON.stringify(p.root)}, ${JSON.stringify(instruction)})))`;
  const before = p.snapshot();
  const result = spawnSync(process.execPath, ["-e", program], { cwd: p.root, encoding: "utf8", env: { PATH: "" } });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout, JSON.stringify({ status: result.status, stdout: result.stdout, stderr: result.stderr, error: result.error?.message }));
  assert.equal(JSON.parse(result.stdout).selectedPath, ".kilo/kilo.jsonc");
  assert.deepEqual(p.snapshot(), before);
});

test("malformed, duplicate and non-string instructions refuse before any project write", (t) => {
  const p = project(t);
  for (const name of ["invalid-duplicate-key.jsonc", "invalid-element.jsonc", "invalid-unclosed.jsonc"]) {
    p.put("kilo.jsonc", fixture(name));
    const before = p.snapshot();
    assert.throws(() => api().inspectProject(p.root, instruction));
    assert.deepEqual(p.snapshot(), before);
    assert.throws(() => api().prepareInstructionEdit(fixture(name), instruction));
  }
  for (const text of ['{"instructions":false}', '{"instructions":{}}', '{"instructions":[null]}']) {
    assert.throws(() => api().prepareInstructionEdit(text, instruction));
  }
  assert.throws(() => api().prepareInstructionEdit('{"note":"\ud800"}', instruction), /UTF-8/);
  assert.throws(() => api().prepareInstructionEdit('{\u00a0"instructions":[]}', instruction), /JSONC/);
});

test("all existing configs are validated, even when another uniquely owns the entry", (t) => {
  const p = project(t);
  p.put(".kilo/kilo.json", `{"instructions":["${instruction}"]}`);
  p.put("kilo.jsonc", fixture("invalid-element.jsonc"));
  const before = p.snapshot();
  assert.throws(() => api().inspectProject(p.root, instruction));
  assert.deepEqual(p.snapshot(), before);
});

test("unsafe candidates, invalid UTF-8 and vanished choices refuse without changing bytes", (t) => {
  const p = project(t);
  p.put("kilo.jsonc", Buffer.from([0x7b, 0xff, 0x7d]));
  assert.throws(() => api().inspectProject(p.root, instruction));
  p.put("kilo.jsonc", "{}\n");
  assert.throws(() => api().inspectProject(p.root, instruction, ".kilo/kilo.jsonc"));
  assert.throws(() => api().inspectProject(p.root, "../escape.md"));
  const outside = path.join(path.dirname(p.root), "outside-kilo-config.jsonc");
  p.put(".kilo/kilo.jsonc", "{}\n");
  fs.rmSync(path.join(p.root, ".kilo/kilo.jsonc"));
  fs.symlinkSync(outside, path.join(p.root, ".kilo/kilo.jsonc"));
  const before = p.snapshot();
  assert.throws(() => api().inspectProject(p.root, instruction));
  assert.deepEqual(p.snapshot(), before);
});

for (const replacement of ["file", "parent"]) {
  test(`config read refuses a ${replacement} substitution after open without reading the outside witness`, (t) => {
    const p = project(t);
    p.put(".kilo/kilo.jsonc", '{"instructions":[]}\n');
    const outside = path.join(path.dirname(p.root), `aidd-kilo-outside-${process.pid}.jsonc`);
    fs.writeFileSync(outside, '{"instructions":["outside"]}\n');
    t.after(() => fs.rmSync(outside, { force: true }));
    const target = path.join(p.root, ".kilo/kilo.jsonc");
    const parent = path.dirname(target);
    const held = `${target}.held`;
    const outsideDir = path.join(path.dirname(p.root), `aidd-kilo-outside-dir-${process.pid}`);
    fs.mkdirSync(outsideDir, { recursive: true });
    fs.writeFileSync(path.join(outsideDir, "kilo.jsonc"), '{"instructions":["outside-parent"]}\n');
    t.after(() => fs.rmSync(outsideDir, { recursive: true, force: true }));
    const originalOpen = fs.openSync;
    try {
      fs.openSync = function (candidate, ...args) {
        const fd = originalOpen.call(this, candidate, ...args);
        if (candidate === target) {
          fs.renameSync(replacement === "file" ? target : parent, replacement === "file" ? held : `${parent}.held`);
          fs.symlinkSync(replacement === "file" ? outside : outsideDir, replacement === "file" ? target : parent, replacement === "parent" ? "dir" : undefined);
        }
        return fd;
      };
      assert.throws(() => api().inspectProject(p.root, instruction), /safely read|changed|Symlink/u);
    } finally {
      fs.openSync = originalOpen;
    }
    assert.equal(fs.readFileSync(outside, "utf8"), '{"instructions":["outside"]}\n');
    assert.equal(fs.readFileSync(path.join(outsideDir, "kilo.jsonc"), "utf8"), '{"instructions":["outside-parent"]}\n');
  });
}
