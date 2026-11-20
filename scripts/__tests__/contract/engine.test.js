const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { describe, it, beforeEach, afterEach } = require("node:test");

const CONTRACT_DIR = path.resolve(__dirname, "../../contract");

/** The generic engine on fixture contracts: findings carry path, line, rule and fix; a broken contract stops the run. */

let dir;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "contract-engine-"));
  fs.writeFileSync(path.join(dir, "run.cjs"), `process.exitCode = require(${JSON.stringify(path.join(CONTRACT_DIR, "engine.cjs"))}).run(process.argv[2], process.argv.slice(3));\n`);
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const write = (file, text) => {
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  fs.writeFileSync(path.join(dir, file), text);
};
const contract = (rules, extra = {}) => write("contract.json", JSON.stringify({ version: 1, kind: "demo", unit: "file", rules, ...extra }));
const validate = (...targets) => {
  const run = spawnSync(process.execPath, [path.join(dir, "run.cjs"), path.join(dir, "contract.json"), ...targets.map((t) => path.join(dir, t))], { encoding: "utf8" });
  return { status: run.status, out: run.stdout, err: run.stderr };
};
const snapshot = () => fs.readdirSync(dir, { recursive: true }).sort().map((f) => `${f}:${fs.statSync(path.join(dir, f)).isFile() ? fs.readFileSync(path.join(dir, f), "utf8") : ""}`);

describe("engine", () => {
  it("exits 0 with no output on a valid artifact", () => {
    contract({ "DEMO-01": { op: "pattern", in: "*.md", line: 1, regex: "^# ", why: "w", fix: "start with a title" } });
    write("a.md", "# Title\n");
    assert.deepEqual(validate("a.md"), { status: 0, out: "", err: "" });
  });

  it("reports path, line, rule, fix and excerpt, and gives the same output twice", () => {
    contract({ "DEMO-01": { op: "forbidden", in: "*.md", regex: "TODO", why: "w", fix: "remove the marker" } });
    write("a.md", "# Title\n\nTODO later\n");
    const first = validate("a.md");
    assert.equal(first.status, 1);
    assert.equal(first.out, `${path.join(dir, "a.md")}:3 DEMO-01 remove the marker "TODO later"\n`);
    assert.deepEqual(validate("a.md"), first);
  });

  it("exits 2 on an unknown op or key", () => {
    contract({ "DEMO-01": { op: "nope", in: "*.md", why: "w", fix: "f" } });
    write("a.md", "x\n");
    const unknownOp = validate("a.md");
    assert.equal(unknownOp.status, 2);
    assert.match(unknownOp.err, /unknown op nope/u);
    contract({ "DEMO-01": { op: "links", in: "*.md", why: "w", fix: "f", extra: 1 } });
    assert.match(validate("a.md").err, /unknown key extra/u);
  });

  it("exits 2 when a rule id does not follow the kind or the contract is not JSON", () => {
    contract({ "OTHER-01": { op: "links", in: "*.md", why: "w", fix: "f" } });
    write("a.md", "x\n");
    assert.match(validate("a.md").err, /must look like DEMO-NN/u);
    write("contract.json", "{");
    assert.equal(validate("a.md").status, 2);
  });

  it("flags a raw template, including a slot in code, and accepts a filled copy", () => {
    write("t.md", "---\nstatus: {{status}}\n---\n\n# Report {{name}}\n\n## Result\n\n```txt\n{{code}}\n```\n");
    contract({ "DEMO-01": { op: "template", in: "r.md", template: "t.md", why: "w", fix: "f" } });
    write("r.md", "---\nstatus: {{status}}\n---\n\n# Report {{name}}\n\n## Result\n\n```txt\n{{code}}\n```\n");
    const raw = validate("r.md");
    assert.equal(raw.status, 1);
    assert.match(raw.out, /DEMO-01 placeholder left/u);
    write("r.md", "---\nstatus: ok\n---\n\n# Report demo\n\n## Result\n\n```txt\nvalue\n```\n");
    assert.deepEqual(validate("r.md"), { status: 0, out: "", err: "" });
    write("r.md", "---\nstatus: ok\n---\n\n# Report demo\n\n```txt\n{{code}}\n```\n");
    assert.match(validate("r.md").out, /section "Result" missing/u);
  });

  it("reports invalid JSON and a schema mismatch with the JSON path", () => {
    write("schema.json", JSON.stringify({ type: "object", required: ["name"], properties: { name: { type: "string" }, n: { type: "integer" } }, additionalProperties: false }));
    contract({ "DEMO-01": { op: "json", in: "*.json", schema: "schema.json", why: "w", fix: "fix {problem}" } });
    write("bad.json", "{");
    assert.match(validate("bad.json").out, /DEMO-01 invalid JSON/u);
    write("m.json", '{\n  "n": "x",\n  "extra": 1\n}\n');
    const out = validate("m.json").out;
    assert.match(out, /\$ misses name/u);
    assert.match(out, /\$\.n must be integer/u);
    assert.match(out, /\$ has unknown key extra/u);
    write("ok.json", '{"name":"a","n":1}\n');
    assert.equal(validate("ok.json").status, 0);
  });

  it("never writes: every file is unchanged after a run, findings or not", () => {
    contract({ "DEMO-01": { op: "forbidden", in: "*.md", regex: "TODO", why: "w", fix: "f" } });
    write("a.md", "TODO\n");
    const before = snapshot();
    validate("a.md");
    assert.deepEqual(snapshot(), before);
  });

  it("exits 2 without a target and on a folder missing its marker", () => {
    contract({ "DEMO-01": { op: "links", in: "**/*.md", why: "w", fix: "f" } }, { unit: "folder", marker: "MAIN.md" });
    fs.mkdirSync(path.join(dir, "unit"));
    assert.equal(validate().status, 2);
    assert.match(validate("unit").err, /MAIN\.md: missing/u);
  });
});
