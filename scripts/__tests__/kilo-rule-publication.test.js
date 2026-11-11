const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");
const skill = path.resolve(__dirname, "../../plugins/aidd-context/skills/05-rule-generate");
const rule = { category: "01-standards", slug: "1-naming", description: "Naming", paths: [], body: "# Naming\n\nUse the sentinel word cobalt.\n" };

const fixtureRoot = path.join(__dirname, "fixtures/context-generation/kilo-config");
const modulePath = process.env.AIDD_KILO_CONFIG_MODULE || path.resolve(__dirname, "../../plugins/aidd-context/skills/05-rule-generate/scripts/kilo-config.cjs");
const instruction = ".kilo/rules/01-standards/1-naming.md";
const canonicalScopedRule = `<!-- aidd_rule:${JSON.stringify({ version: 1, category: rule.category, slug: rule.slug, description: rule.description, paths: ["src/**/*.ts"], targets: ["kilo"] })} -->\n${rule.body}`;

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
        if (entry.isDirectory()) { found.set(`${name}/`, "directory"); walk(full, `${name}/`); }
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

function injected(t, root, source) {
  const preload = path.join(path.dirname(root), `aidd-kilo-inject-${process.pid}-${Math.random().toString(36).slice(2)}.cjs`);
  fs.writeFileSync(preload, source);
  t.after(() => fs.rmSync(preload, { force: true }));
  return { NODE_OPTIONS: `--require=${preload}` };
}

function modes(root, paths) {
  return new Map(paths.map((relative) => [relative, fs.statSync(path.join(root, relative)).mode & 0o7777]));
}

function hashes(root, paths) {
  return new Map(paths.map((relative) => [relative, createHash("sha256").update(fs.readFileSync(path.join(root, relative))).digest("hex")]));
}

function fileSnapshot(filePath) {
  const fd = fs.openSync(filePath, "r");
  try {
    const stat = fs.fstatSync(fd);
    return {
      content: fs.readFileSync(fd),
      dev: stat.dev,
      ino: stat.ino,
      mode: stat.mode & 0o7777,
    };
  } finally {
    fs.closeSync(fd);
  }
}

function temporaryFiles(snapshot) {
  return [...snapshot.keys()].filter((name) => name.endsWith(".tmp"));
}

function publisher(t) {
  const p = project(t);
  p.put("package.json", '{"type":"module"}');
  const installed = path.join(path.dirname(p.root), `aidd-kilo-installed-${process.pid}-${Math.random().toString(36).slice(2)}`);
  fs.cpSync(skill, installed, { recursive: true });
  t.after(() => fs.rmSync(installed, { recursive: true, force: true }));
  const script = path.join(installed, "scripts/write-rule.cjs");
  function run(value = rule, targets = "kilo", extra = [], env = {}) {
    const input = path.join(installed, "input.json");
    fs.writeFileSync(input, JSON.stringify(value));
    const mode = extra.some((item) => ["--input", "--delete", "--publish"].includes(item)) ? extra : [...extra, "--input", input];
    return spawnSync(process.execPath, [script, "--project", p.root, "--tools", targets, ...mode], { encoding: "utf8", cwd: p.root, env: { PATH: "", ...env } });
  }
  return { ...p, run, read: (relative) => fs.readFileSync(path.join(p.root, relative), "utf8") };
}

test("installed writer publishes a Kilo rule and exact instruction, then reruns byte-identically", (t) => {
  const p = publisher(t);
  assert.equal(p.run().status, 0);
  assert.match(p.read(instruction), /Use the sentinel word cobalt/);
  assert.deepEqual(JSON.parse(p.read(".kilo/kilo.jsonc")).instructions, [instruction]);
  assert.match(p.read("aidd_docs/rules/01-standards/1-naming.md"), /Use the sentinel word cobalt/);
  const before = p.snapshot();
  const tracked = [instruction, ".kilo/kilo.jsonc", "aidd_docs/rules/01-standards/1-naming.md"];
  const mtimes = new Map(tracked.map((relative) => [relative, fs.statSync(path.join(p.root, relative)).mtimeMs]));
  assert.equal(p.run().status, 0);
  assert.deepEqual(p.snapshot(), before);
  for (const relative of tracked) assert.equal(fs.statSync(path.join(p.root, relative)).mtimeMs, mtimes.get(relative));
  assert.equal(p.run(null, "kilo", ["--delete", "01-standards/1-naming"]).status, 0);
  assert.equal(fs.existsSync(path.join(p.root, instruction)), false);
  assert.deepEqual(JSON.parse(p.read(".kilo/kilo.jsonc")).instructions, []);
});

test("a legacy .kilocode project keeps new Kilo rule output under canonical .kilo paths", (t) => {
  const p = publisher(t);
  p.put(".kilocode/.gitkeep", "");
  assert.equal(p.run().status, 0);
  assert.match(p.read(instruction), /Use the sentinel word cobalt/);
  assert.deepEqual(
    [...p.snapshot().keys()].filter((name) => name.startsWith(".kilocode/")).sort(),
    [".kilocode/", ".kilocode/.gitkeep"].sort(),
  );
  assert.equal(fs.existsSync(path.join(p.root, ".kilocode/rules")), false);
});

test("Kilo publication preserves JSONC comments, duplicate entries, order and unrelated values", (t) => {
  const p = publisher(t);
  const original = fixture("comments-and-trailing.jsonc");
  p.put(".kilo/kilo.jsonc", original);
  assert.equal(p.run().status, 0);
  assert.equal(p.read(".kilo/kilo.jsonc").replace(JSON.stringify(instruction) + ",", ""), original);
  const before = p.snapshot();
  assert.equal(p.run(null, "kilo", ["--publish"]).status, 0);
  assert.deepEqual(p.snapshot(), before);
});

test("Kilo refuses path-scoped rules before creating any publication", (t) => {
  const p = publisher(t);
  const before = p.snapshot();
  const result = p.run({ ...rule, paths: ["src/**/*.ts", "test/**/*.ts"] });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Kilo does not support enforceable path scoping/);
  assert.deepEqual(p.snapshot(), before);
});

test("mixed Kilo and Claude targets refuse path scope before fan-out", (t) => {
  const p = publisher(t);
  const before = p.snapshot();
  const result = p.run({ ...rule, paths: ["src/**/*.ts"] }, "claude,kilo");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /remove ["']?kilo["']? from targets/);
  assert.deepEqual(p.snapshot(), before);
});

test("plan and publish check refuse path-scoped Kilo output without mutation", (t) => {
  const p = publisher(t);
  const before = p.snapshot();
  const plan = p.run({ ...rule, paths: ["src/**/*.ts"] }, "kilo", ["--plan"]);
  assert.notEqual(plan.status, 0);
  assert.match(plan.stderr, /Kilo does not support enforceable path scoping/);
  assert.deepEqual(p.snapshot(), before);

  p.put("aidd_docs/rules/01-standards/1-naming.md", canonicalScopedRule);
  const publishBefore = p.snapshot();
  const check = p.run(null, "kilo", ["--check", "--publish"]);
  assert.notEqual(check.status, 0);
  assert.match(check.stderr, /Kilo does not support enforceable path scoping/);
  assert.deepEqual(p.snapshot(), publishBefore);
});

test("updating an existing Kilo rule to path scope refuses without mutation", (t) => {
  const p = publisher(t);
  assert.equal(p.run().status, 0);
  const before = p.snapshot();
  const result = p.run({ ...rule, paths: ["src/**/*.ts"] });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Kilo does not support enforceable path scoping/);
  assert.deepEqual(p.snapshot(), before);
});

test("removing Kilo while adding path scope for Claude remains supported", (t) => {
  const p = publisher(t);
  assert.equal(p.run().status, 0);
  assert.equal(p.run({ ...rule, paths: ["src/**/*.ts"] }, "claude").status, 0);
  assert.equal(fs.existsSync(path.join(p.root, instruction)), false);
  assert.match(p.read(".claude/rules/01-standards/1-naming.md"), /^---\npaths:/);
});

test("Claude and Cursor retain native path scope without a Kilo publication", (t) => {
  const p = publisher(t);
  assert.equal(p.run({ ...rule, paths: ["src/**/*.ts"] }, "claude,cursor").status, 0);
  assert.match(p.read(".claude/rules/01-standards/1-naming.md"), /^---\npaths:/);
  assert.match(p.read(".cursor/rules/01-standards/1-naming.mdc"), /globs: "src\/\*\*\/\*\.ts"/);
  assert.equal(fs.existsSync(path.join(p.root, instruction)), false);
});

test("ambiguous selection, unsafe last config and unowned Kilo output refuse the whole fan-out", (t) => {
  const p = publisher(t);
  p.put(".kilo/kilo.json", "{}\n");
  p.put("kilo.jsonc", "{}\n");
  let before = p.snapshot();
  const ambiguous = p.run(rule, "claude,kilo");
  assert.notEqual(ambiguous.status, 0);
  assert.match(ambiguous.stderr, /Choose a Kilo config/);
  assert.deepEqual(p.snapshot(), before);
  assert.equal(p.run(rule, "claude,kilo", ["--kilo-config", "kilo.jsonc"]).status, 0);
  p.put("kilo.jsonc", '{"instructions":[null]}');
  before = p.snapshot();
  assert.notEqual(p.run(rule, "claude,kilo").status, 0);
  assert.deepEqual(p.snapshot(), before);
  p.put("kilo.jsonc", "{}\n");
  p.put(instruction, "user owned\n");
  before = p.snapshot();
  assert.notEqual(p.run(rule, "claude,kilo", ["--kilo-config", "kilo.jsonc"]).status, 0);
  assert.deepEqual(p.snapshot(), before);
});

test("existing exact owner is reused without changing duplicate instruction entries", (t) => {
  const p = publisher(t);
  const owned = `{"instructions":["${instruction}","${instruction}",]}`;
  p.put("kilo.jsonc", owned);
  p.put(".kilo/kilo.json", "{}\n");
  assert.equal(p.run().status, 0);
  assert.equal(p.read("kilo.jsonc"), owned);
  assert.equal(p.read(".kilo/kilo.json"), "{}\n");
});

test("writer refuses deletion with two exact owners and leaves rules, configs and directories intact", (t) => {
  const p = publisher(t);
  p.put(".kilo/kilo.json", `{"instructions":["${instruction}"]}\n`);
  assert.equal(p.run().status, 0);
  p.put("kilo.jsonc", `{"instructions":["${instruction}"]}\n`);
  const before = p.snapshot();
  const result = p.run(null, "kilo", ["--kilo-config", ".kilo/kilo.json", "--delete", "01-standards/1-naming"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Multiple Kilo configs own/);
  assert.deepEqual(p.snapshot(), before);
  assert.equal(fs.existsSync(path.join(p.root, instruction)), true);
});

test("writer refuses removal of duplicate exact entries without mutation", (t) => {
  const p = publisher(t);
  assert.equal(p.run().status, 0);
  p.put(".kilo/kilo.jsonc", `{"instructions":["${instruction}","${instruction}",]}`);
  const before = p.snapshot();
  const result = p.run(null, "kilo", ["--delete", "01-standards/1-naming"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Duplicate exact instruction entries/);
  assert.deepEqual(p.snapshot(), before);
});

test("partially written temporary file and newly created directories are cleaned", (t) => {
  const p = publisher(t);
  const before = p.snapshot();
  const env = injected(t, p.root, "const fs=require('node:fs');const write=fs.writeFileSync;let failed=false;fs.writeFileSync=function(file,data,...args){if(!failed&&typeof file==='number'){failed=true;write.call(this,file,data.slice(0,8),...args);throw new Error('injected partial temporary write')}return write.call(this,file,data,...args)};");
  const result = p.run(rule, "claude,kilo", [], env);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /injected partial temporary write/);
  assert.deepEqual(p.snapshot(), before);
});

test("late failure restores existing file bytes and modes", { skip: process.platform === "win32" }, (t) => {
  const p = publisher(t);
  p.put(".kilo/kilo.jsonc", "{}\n");
  assert.equal(p.run(rule, "codex,kilo").status, 0);
  p.put(".kilo/kilo.jsonc", "{}\n");
  fs.chmodSync(path.join(p.root, ".kilo/kilo.jsonc"), 0o600);
  fs.chmodSync(path.join(p.root, instruction), 0o600);
  const tracked = [".kilo/kilo.jsonc", instruction, "aidd_docs/rules/01-standards/1-naming.md", "AGENTS.md"];
  const before = p.snapshot();
  const beforeModes = modes(p.root, tracked);
  const beforeHashes = hashes(p.root, tracked);
  const env = injected(t, p.root, "const fs=require('node:fs');const rename=fs.renameSync;fs.renameSync=function(from,to){if(to.endsWith('/AGENTS.md'))throw new Error('injected late shared failure');return rename.apply(this,arguments)};");
  const result = p.run({ ...rule, body: "# Naming\n\nChanged body.\n" }, "codex,kilo", [], env);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /injected late shared failure/);
  assert.deepEqual(p.snapshot(), before);
  assert.deepEqual(modes(p.root, tracked), beforeModes);
  assert.deepEqual(hashes(p.root, tracked), beforeHashes);
  assert.deepEqual(temporaryFiles(p.snapshot()), []);
});

test("successful config replacement preserves private mode", { skip: process.platform === "win32" }, (t) => {
  const p = publisher(t);
  p.put(".kilo/kilo.jsonc", "{}\n");
  fs.chmodSync(path.join(p.root, ".kilo/kilo.jsonc"), 0o600);
  assert.equal(p.run().status, 0);
  assert.equal(fs.statSync(path.join(p.root, ".kilo/kilo.jsonc")).mode & 0o7777, 0o600);
});

for (const change of ["modified", "disappeared"]) {
  test(`writer refuses config ${change} after inspection without publishing`, (t) => {
    const p = publisher(t);
    p.put(".kilo/kilo.jsonc", "{}\n");
    const config = path.join(p.root, ".kilo/kilo.jsonc");
    const env = {
      ...injected(t, p.root, "const fs=require('node:fs');const read=fs.readFileSync;let changed=false;fs.readFileSync=function(file,...args){const data=read.call(this,file,...args);if(!changed&&typeof file==='number'){changed=true;if(process.env.AIDD_TEST_CONFIG_CHANGE==='modified')fs.writeFileSync(process.env.AIDD_TEST_CONFIG,'{\"other\":true}\\n');else fs.rmSync(process.env.AIDD_TEST_CONFIG)}return data};"),
      AIDD_TEST_CONFIG: config,
      AIDD_TEST_CONFIG_CHANGE: change,
    };
    const result = p.run(rule, "claude,kilo", [], env);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /changed after inspection/);
    assert.equal(fs.existsSync(path.join(p.root, instruction)), false);
    assert.equal(fs.existsSync(path.join(p.root, "aidd_docs")), false);
    assert.equal(fs.existsSync(config), change === "modified");
    if (change === "modified") assert.equal(p.read(".kilo/kilo.jsonc"), '{"other":true}\n');
    assert.equal([...p.snapshot().keys()].some((name) => name.endsWith(".tmp")), false);
  });
}

test("writer detects config mutation during staging and removes staged outputs", (t) => {
  const p = publisher(t);
  p.put(".kilo/kilo.jsonc", "{}\n");
  const config = path.join(p.root, ".kilo/kilo.jsonc");
  const env = {
    ...injected(t, p.root, "const fs=require('node:fs');const open=fs.openSync;let changed=false;fs.openSync=function(file,...args){const fd=open.call(this,file,...args);if(!changed&&typeof file==='string'&&file.endsWith('.tmp')){changed=true;fs.writeFileSync(process.env.AIDD_TEST_CONFIG,'{\"external\":true}\\n')}return fd};"),
    AIDD_TEST_CONFIG: config,
  };
  const result = p.run(rule, "claude,kilo", [], env);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Kilo config changed during publication/);
  assert.equal(p.read(".kilo/kilo.jsonc"), '{"external":true}\n');
  assert.deepEqual([...p.snapshot().keys()].sort(), [".kilo/", ".kilo/kilo.jsonc", "package.json"]);
});

test("late config rename failure restores canonical and native outputs", (t) => {
  const p = publisher(t);
  p.put(".kilo/kilo.jsonc", "{}\n");
  const before = p.snapshot();
  const preload = path.join(path.dirname(p.root), `aidd-kilo-fail-${process.pid}-${Math.random().toString(36).slice(2)}.cjs`);
  const expectedConfig = path.resolve(p.root, ".kilo/kilo.jsonc");
  fs.writeFileSync(preload, `const fs=require('node:fs');const path=require('node:path');const expected=${JSON.stringify(expectedConfig)};const original=fs.renameSync;fs.renameSync=function(from,to){if(path.resolve(to)===expected)throw new Error('injected config rename failure');return original.apply(this,arguments)};`);
  t.after(() => fs.rmSync(preload, { force: true }));
  const result = p.run(rule, "claude,kilo", [], { NODE_OPTIONS: `--require=${preload}` });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /injected config rename failure/);
  assert.deepEqual(p.snapshot(), before);
});

test("hardlinked Kilo config and rule outputs are replaced without mutating their external links", { skip: process.platform === "win32" }, (t) => {
  const p = publisher(t);
  p.put(".kilo/kilo.jsonc", '{"other":true}\n');
  const config = path.join(p.root, ".kilo/kilo.jsonc");
  const outsideConfig = path.join(path.dirname(p.root), `aidd-kilo-config-hardlink-${process.pid}-${Math.random().toString(36).slice(2)}.jsonc`);
  fs.linkSync(config, outsideConfig);
  t.after(() => fs.rmSync(outsideConfig, { force: true }));
  const externalConfig = fileSnapshot(outsideConfig);

  assert.equal(p.run().status, 0);
  const externalConfigAfter = fileSnapshot(outsideConfig);
  assert.deepEqual(externalConfigAfter.content, externalConfig.content);
  assert.equal(externalConfigAfter.mode, externalConfig.mode);
  assert.equal(externalConfigAfter.dev, externalConfig.dev);
  assert.equal(externalConfigAfter.ino, externalConfig.ino);

  const native = path.join(p.root, instruction);
  const outsideNative = path.join(path.dirname(p.root), `aidd-kilo-rule-hardlink-${process.pid}-${Math.random().toString(36).slice(2)}.md`);
  fs.linkSync(native, outsideNative);
  t.after(() => fs.rmSync(outsideNative, { force: true }));
  const externalNative = fileSnapshot(outsideNative);

  assert.equal(p.run({ ...rule, body: "# Naming\n\nChanged after hardlink.\n" }).status, 0);
  const externalNativeAfter = fileSnapshot(outsideNative);
  assert.deepEqual(externalNativeAfter.content, externalNative.content);
  assert.equal(externalNativeAfter.mode, externalNative.mode);
  assert.equal(externalNativeAfter.dev, externalNative.dev);
  assert.equal(externalNativeAfter.ino, externalNative.ino);
  assert.match(p.read(instruction), /Changed after hardlink/);
  assert.deepEqual(temporaryFiles(p.snapshot()), []);
});

test("Kilo rejects a non-regular config without writing", (t) => {
  const p = publisher(t);
  fs.mkdirSync(path.join(p.root, "kilo.jsonc"), { recursive: true });
  const before = p.snapshot();
  const result = p.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Cannot safely read|invalid config path|directory|regular/u);
  assert.deepEqual(p.snapshot(), before);
  assert.deepEqual(temporaryFiles(p.snapshot()), []);
});

test("Kilo rejects a non-regular rule output without writing", (t) => {
  const p = publisher(t);
  p.put(".kilo/kilo.jsonc", "{}\n");
  fs.mkdirSync(path.join(p.root, ".kilo/rules/01-standards/1-naming.md"), { recursive: true });
  const before = p.snapshot();
  const result = p.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /EISDIR|directory|regular|read/u);
  assert.deepEqual(p.snapshot(), before);
  assert.deepEqual(temporaryFiles(p.snapshot()), []);
});

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

const configPaths = [".kilo/kilo.json", ".kilo/kilo.jsonc", "kilo.json", "kilo.jsonc"];
const subsets = (values, size, start = 0, prefix = [], result = []) => {
  if (prefix.length === size) return result.push([...prefix]), result;
  for (let index = start; index <= values.length - (size - prefix.length); index++) {
    prefix.push(values[index]);
    subsets(values, size, index + 1, prefix, result);
    prefix.pop();
  }
  return result;
};

for (const owner of configPaths) {
  test(`one exact owner wins across all four configs when it is ${owner}`, (t) => {
    const p = project(t);
    for (const relative of configPaths) {
      p.put(relative, relative === owner ? `{"instructions":["${instruction}"]}\n` : "{}\n");
    }
    const before = p.snapshot();
    const choice = api().inspectProject(p.root, instruction);
    assert.equal(choice.selectedPath, owner);
    assert.equal(choice.needsChoice, false);
    assert.equal(choice.multipleOwners, undefined);
    assert.deepEqual(choice.candidates.map((item) => item.path), configPaths);
    assert.deepEqual(p.snapshot(), before);
  });
}

for (const size of [2, 3, 4]) {
  for (const present of subsets(configPaths, size)) {
    test(`configs without an owner require explicit choice for ${present.join(", ")}`, (t) => {
      const p = project(t);
      for (const relative of present) p.put(relative, "{}\n");
      const before = p.snapshot();
      const undecided = api().inspectProject(p.root, instruction);
      assert.equal(undecided.selectedPath, null);
      assert.equal(undecided.needsChoice, true);
      assert.equal(undecided.multipleOwners, false);
      assert.deepEqual(p.snapshot(), before);

      const chosen = api().inspectProject(p.root, instruction, present[0]);
      assert.equal(chosen.selectedPath, present[0]);
      assert.equal(chosen.needsChoice, false);
      assert.deepEqual(p.snapshot(), before);

      assert.throws(() => api().inspectProject(p.root, instruction, "missing-kilo.jsonc"), /Chosen Kilo config is absent/u);
      assert.deepEqual(p.snapshot(), before);
    });
  }
}

for (const owners of subsets(configPaths, 2)) {
  test(`multiple owners remain ambiguous until explicit choice: ${owners.join(", ")}`, (t) => {
    const p = project(t);
    for (const relative of configPaths) {
      p.put(relative, owners.includes(relative) ? `{"instructions":["${instruction}"]}\n` : "{}\n");
    }
    const before = p.snapshot();
    const undecided = api().inspectProject(p.root, instruction);
    assert.equal(undecided.selectedPath, null);
    assert.equal(undecided.needsChoice, true);
    assert.equal(undecided.multipleOwners, true);
    assert.deepEqual(p.snapshot(), before);

    const chosen = api().inspectProject(p.root, instruction, owners[1]);
    assert.equal(chosen.selectedPath, owners[1]);
    assert.equal(chosen.needsChoice, false);
    assert.deepEqual(p.snapshot(), before);
  });
}

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
