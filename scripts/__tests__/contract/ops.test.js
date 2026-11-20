const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { loadContract, check } = require("../../contract/engine.cjs");

/** Each op has one fixture that passes and one that fails; findings come back as rule ids with lines. */

let dir;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "contract-ops-"));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

/** Findings of one rule applied to one file's text. */
function findings(rule, text, file = "a.md") {
  fs.writeFileSync(path.join(dir, file), text);
  fs.writeFileSync(path.join(dir, "contract.json"), JSON.stringify({ version: 1, kind: "demo", unit: "file", rules: { "DEMO-01": { in: file, why: "w", fix: "f {actual}", ...rule } } }));
  return check(loadContract(path.join(dir, "contract.json")), path.join(dir, file));
}
const lines = (list) => list.map((f) => f.line);

describe("ops", () => {
  it("max chars measures a field", () => {
    const rule = { op: "max", measure: "chars", field: "description", max: 5 };
    assert.deepEqual(findings(rule, "---\ndescription: abc\n---\n"), []);
    const hit = findings(rule, "---\ndescription: abcdefgh\n---\n");
    assert.deepEqual(lines(hit), [2]);
    assert.match(hit[0].message, /f 8/u);
  });

  it("max lines counts the file", () => {
    const rule = { op: "max", measure: "lines", max: 3 };
    assert.deepEqual(findings(rule, "a\nb\n"), []);
    assert.deepEqual(lines(findings(rule, "a\nb\nc\nd\n")), [4]);
  });

  it("max files counts the siblings", () => {
    const rule = { op: "max", measure: "files", max: 3 };
    assert.deepEqual(findings(rule, "a\n"), []);
    for (const name of ["x", "y", "z"]) fs.writeFileSync(path.join(dir, name), "");
    assert.equal(findings(rule, "a\n").length, 1);
  });

  it("max refuses an unknown measure", () => {
    assert.throws(() => findings({ op: "max", measure: "words", max: 1 }, "a\n"), /measure must be/u);
  });

  it("required needs a field", () => {
    const rule = { op: "required", field: "description" };
    assert.deepEqual(findings(rule, "---\ndescription: x\n---\n"), []);
    assert.deepEqual(lines(findings(rule, "---\nname: x\n---\n")), [1]);
  });

  it("pattern matches a field or a line", () => {
    assert.deepEqual(findings({ op: "pattern", line: 1, regex: "^# " }, "# T\n"), []);
    assert.deepEqual(lines(findings({ op: "pattern", line: 1, regex: "^# " }, "T\n")), [1]);
  });

  it("forbidden skips fences and inline code unless the scope is raw", () => {
    const rule = { op: "forbidden", regex: "BAD" };
    assert.deepEqual(findings(rule, "ok `BAD`\n```\nBAD\n```\n"), []);
    assert.deepEqual(lines(findings(rule, "ok\nBAD\n")), [2]);
    assert.deepEqual(lines(findings({ ...rule, scope: "raw" }, "ok\n```\nBAD\n```\n")), [3]);
    assert.deepEqual(lines(findings({ ...rule, scope: "nofence" }, "BAD\n```\nBAD\n```\n")), [1]);
  });

  it("sections restricts names, order and required ones", () => {
    const rule = { op: "sections", allowed: ["A", "B"], order: true, required: ["A"] };
    assert.deepEqual(findings(rule, "## A\n\n## B\n"), []);
    assert.equal(findings(rule, "## B\n\n## A\n").length, 1);
    assert.equal(findings(rule, "## C\n").length, 2);
  });

  it("equals compares a field to a value or the file basename", () => {
    assert.deepEqual(findings({ op: "equals", field: "name", to: "a" }, "---\nname: a\n---\n"), []);
    assert.deepEqual(lines(findings({ op: "equals", field: "name", to: "basename" }, "---\nname: z\n---\n")), [2]);
  });

  it("oneSentence flags two clauses in a list item", () => {
    const rule = { op: "oneSentence", sections: ["S"] };
    assert.deepEqual(findings(rule, "## S\n\n- One thing.\n"), []);
    assert.deepEqual(lines(findings(rule, "## S\n\n- One. Two.\n")), [3]);
  });

  it("flatList flags a nested item", () => {
    const rule = { op: "flatList", sections: ["S"] };
    assert.deepEqual(findings(rule, "## S\n\n- one\n"), []);
    assert.deepEqual(lines(findings(rule, "## S\n\n- one\n  - two\n")), [4]);
  });

  it("links flags a missing target", () => {
    fs.writeFileSync(path.join(dir, "b.md"), "");
    assert.deepEqual(findings({ op: "links" }, "[b](b.md) [web](https://x.y)\n"), []);
    assert.deepEqual(lines(findings({ op: "links" }, "[c](c.md)\n")), [1]);
  });

  it("template flags an unfilled slot and accepts a filled copy", () => {
    fs.writeFileSync(path.join(dir, "t.md"), "# T {{x}}\n\n## S\n");
    const rule = { op: "template", template: "t.md" };
    assert.deepEqual(findings(rule, "# T demo\n\n## S\n"), []);
    assert.equal(findings(rule, "# T {{x}}\n\n## S\n").length, 1);
  });

  it("template flags a slot left in the front matter, and lets a declared key be absent", () => {
    fs.writeFileSync(path.join(dir, "t.md"), '---\ntitle: "{{x}}"\nnote: "{{y}}"\n---\n\n# T\n');
    const rule = { op: "template", template: "t.md", optional: ["note"] };
    assert.deepEqual(findings(rule, '---\ntitle: "demo"\n---\n\n# T\n'), []);
    assert.match(findings(rule, '---\ntitle: "{{x}}"\n---\n\n# T\n')[0].message, /front matter "title": placeholder left/u);
    assert.match(findings({ op: "template", template: "t.md" }, '---\ntitle: "demo"\n---\n\n# T\n')[0].message, /key "note" missing/u);
  });

  it("json validates against a schema", () => {
    fs.writeFileSync(path.join(dir, "s.json"), JSON.stringify({ type: "object", required: ["a"] }));
    const rule = { op: "json", schema: "s.json", fix: "{problem}" };
    assert.deepEqual(findings(rule, '{"a":1}', "d.json"), []);
    assert.equal(findings(rule, "{}", "d.json").length, 1);
  });

  it("custom runs the named check of the contract's checks folder", () => {
    fs.mkdirSync(path.join(dir, "checks"));
    fs.writeFileSync(path.join(dir, "checks", "always.cjs"), "module.exports = () => [{ line: 2, offending: 'x' }];\n");
    assert.deepEqual(lines(findings({ op: "custom", check: "always" }, "a\n")), [2]);
  });
});
