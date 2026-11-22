const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { findings: apply } = require("./helpers.js");

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
  return apply(path.join(dir, "contract.json"), path.join(dir, file));
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

  it("forbidden skips fences and inline code", () => {
    const rule = { op: "forbidden", regex: "BAD" };
    assert.deepEqual(findings(rule, "ok `BAD`\n```\nBAD\n```\n"), []);
    assert.deepEqual(lines(findings(rule, "ok\nBAD\n")), [2]);
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

  it("equals to folder compares a field to the unit folder name, quotes ignored", () => {
    const rule = { op: "equals", field: "name", to: "folder" };
    const name = path.basename(dir);
    assert.deepEqual(findings(rule, `---\nname: ${name}\n---\n`), []);
    assert.deepEqual(findings(rule, `---\nname: "${name}"\n---\n`), []);
    assert.deepEqual(lines(findings(rule, "---\nname: other\n---\n")), [2]);
    assert.deepEqual(lines(findings(rule, "---\ndescription: x\n---\n")), [1]);
  });

  it("pattern any passes when one line matches", () => {
    const rule = { op: "pattern", regex: "^## Run", any: true };
    assert.deepEqual(findings(rule, "# T\n\n## Run 1\n"), []);
    assert.deepEqual(lines(findings(rule, "# T\n\n```\n## Run 1\n```\n")), [1]);
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

  it("links inside flags a link leaving the unit folder, existing or not", () => {
    fs.mkdirSync(path.join(dir, "sub"));
    fs.writeFileSync(path.join(dir, "sub/b.md"), "");
    const rule = { op: "links", inside: true };
    assert.deepEqual(findings(rule, "[b](sub/b.md) [up](./sub/../sub/b.md) [web](https://x.y) [here](#top)\n"), []);
    assert.deepEqual(lines(findings(rule, "ok\n[out](../x.md)\n")), [2]);
    assert.deepEqual(lines(findings(rule, "[abs](/etc/hosts)\n")), [1]);
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

  it("template reads a front matter value the same bare, single- or double-quoted", () => {
    fs.writeFileSync(path.join(dir, "t.md"), "---\ntype: story\nstatus: proposed\n---\n\n# T\n");
    const rule = { op: "template", template: "t.md", values: { status: ["proposed", "done"] } };
    for (const quote of ["", "'", '"']) assert.deepEqual(findings(rule, `---\ntype: ${quote}story${quote}\nstatus: ${quote}done${quote}\n---\n\n# T\n`), []);
  });

  it("template names the value a missing front matter key takes", () => {
    fs.writeFileSync(path.join(dir, "t.md"), '---\ntype: story\nstatus: proposed\ntitle: "{{x}}"\n---\n\n# T\n');
    const rule = { op: "template", template: "t.md", values: { status: ["proposed", "done"] } };
    const messages = findings(rule, "---\n---\n\n# T\n").map((f) => f.message);
    assert.ok(messages.some((m) => /key "type" missing, set it to "story"/u.test(m)));
    assert.ok(messages.some((m) => /key "status" missing, one of proposed, done/u.test(m)));
    assert.ok(messages.some((m) => /key "title" missing, fill it/u.test(m)));
  });

  it("template accepts any value for a front matter key the template leaves bare", () => {
    fs.writeFileSync(path.join(dir, "t.md"), "---\nmodel:\n---\n\n# T\n");
    const rule = { op: "template", template: "t.md" };
    assert.deepEqual(findings(rule, "---\nmodel: sonnet\n---\n\n# T\n"), []);
  });

  describe("template heading tree", () => {
    const tree = "# T {{x}}\n\n## Round {{n}}\n\n### A\n\n### B\n\n| h1 | h2 |\n| -- | -- |\n";
    const rule = { op: "template", template: "t.md" };
    const round = (body) => `## Round 1\n\n${body}\n`;
    const ok = "### A\n\n### B\n\n| h1 | h2 |\n| -- | -- |\n";
    beforeEach(() => fs.writeFileSync(path.join(dir, "t.md"), tree));

    it("accepts two rounds, each A then B", () => {
      assert.deepEqual(findings(rule, `# T demo\n\n${round(ok)}\n${round(ok).replace("Round 1", "Round 2")}`), []);
    });

    it("names an unknown child", () => {
      const hit = findings(rule, `# T demo\n\n${round(ok + "\n### C\n")}`);
      assert.equal(hit.length, 1);
      assert.match(hit[0].message, /"C" is not in the template/u);
    });

    it("names a child out of order", () => {
      const hit = findings(rule, "# T demo\n\n## Round 1\n\n### B\n\n| h1 | h2 |\n| -- | -- |\n\n### A\n");
      assert.equal(hit.length, 1);
      assert.match(hit[0].message, /"A" is out of order/u);
    });

    it("reports a missing child unless it is optional", () => {
      const doc = "# T demo\n\n## Round 1\n\n### A\n\n| h1 | h2 |\n| -- | -- |\n";
      assert.match(findings(rule, doc)[0].message, /"B" missing under "Round 1"/u);
      assert.deepEqual(findings({ ...rule, optional: ["B"] }, doc), []);
    });

    it("shows a missing slotted heading as a fill-in", () => {
      const hit = findings(rule, "# T demo\n");
      assert.match(hit[0].message, /^section "## Round <n>" missing: write it with <n> filled in$/u);
    });

    it("attributes a table after a second title to no heading", () => {
      const bad = ok.replace("h2", "zz");
      const hit = findings(rule, `# T demo\n\n${round(bad)}\n# T demo\n\n| h1 | h2 |\n| -- | -- |\n`);
      assert.equal(hit.length, 2);
      assert.ok(hit.some((f) => /one title only/u.test(f.message)));
      assert.ok(hit.some((f) => /table header differs/u.test(f.message)));
    });

    it("omits a bare optional name under every parent that holds it", () => {
      fs.writeFileSync(path.join(dir, "t.md"), "# T {{x}}\n\n## P1\n\n### X\n\n## P2\n\n### X\n");
      const doc = "# T demo\n\n## P1\n\n## P2\n";
      assert.equal(findings(rule, doc).length, 2);
      assert.deepEqual(findings({ ...rule, optional: ["X"] }, doc), []);
    });

    it("flags a second title", () => {
      const hit = findings(rule, `# T demo\n\n${round(ok)}\n# T demo\n`);
      assert.equal(hit.length, 1);
      assert.match(hit[0].message, /one title only/u);
    });

    it("ignores headings in a fence or a comment", () => {
      const doc = `# T demo\n\n${round(ok)}\n\`\`\`\n### C\n\`\`\`\n`;
      assert.deepEqual(findings(rule, doc), []);
      assert.match(findings(rule, `${doc}<!--\n### C\n-->\n`)[0].message, /comment left/u);
      assert.equal(findings(rule, `${doc}<!--\n### C\n-->\n`).length, 1);
    });

    it("checks the table header of every round", () => {
      const bad = ok.replace("h2", "zz");
      const hit = findings(rule, `# T demo\n\n${round(ok)}\n${round(bad).replace("Round 1", "Round 2")}`);
      assert.equal(hit.length, 1);
      assert.match(hit[0].message, /table header differs/u);
      assert.equal(hit[0].line, 17);
    });
  });

  it("json validates against a schema", () => {
    fs.writeFileSync(path.join(dir, "s.json"), JSON.stringify({ type: "object", required: ["a"] }));
    const rule = { op: "json", schema: "s.json", fix: "{problem}" };
    assert.deepEqual(findings(rule, '{"a":1}', "d.json"), []);
    assert.equal(findings(rule, "{}", "d.json").length, 1);
  });

  it("json reads anyOf, oneOf, allOf, not, propertyNames, $ref, enum, bounds and uri", () => {
    const schema = {
      $defs: { word: { type: "string", pattern: "^[a-z]+$" } },
      properties: {
        any: { anyOf: [{ type: "string" }, { type: "integer" }] },
        one: { oneOf: [{ type: "string" }, { type: "string", minLength: 3 }] },
        all: { allOf: [{ type: "string", pattern: "^a" }, { type: "string", pattern: "z$" }] },
        no: { not: { const: "x" } },
        keys: { propertyNames: { pattern: "^k" } },
        ref: { $ref: "#/$defs/word" },
        pick: { enum: ["a", 2] },
        size: { type: "string", minLength: 2, maxLength: 3 },
        count: { type: "number", minimum: 1, maximum: 5, exclusiveMinimum: 1 },
        list: { type: "array", minItems: 1, maxItems: 2, uniqueItems: true },
        home: { type: "string", format: "uri" },
      },
    };
    fs.writeFileSync(path.join(dir, "s.json"), JSON.stringify(schema));
    const rule = { op: "json", schema: "s.json", fix: "{problem}" };
    const ok = { any: 1, one: "ab", all: "az", no: "y", keys: { k1: 1 }, ref: "abc", pick: 2, size: "ab", count: 2, list: [1], home: "https://x.test" };
    assert.deepEqual(findings(rule, JSON.stringify(ok), "d.json"), []);
    const bad = { any: true, one: "abc", all: "a", no: "x", keys: { j: 1 }, ref: "A", pick: "b", size: "a", count: 1, list: [1, 1], home: "nope" };
    for (const [key, value] of Object.entries(bad)) assert.equal(findings(rule, JSON.stringify({ ...ok, [key]: value }), "d.json").length, 1, key);
  });

  it("json refuses at load a schema keyword outside the subset", () => {
    for (const schema of [{ if: {} }, { patternProperties: {} }, { properties: { a: { format: "date" } } }, { $ref: "#/$defs/none" }, { $ref: "other.json" }, { pattern: "\\-(" }]) {
      fs.writeFileSync(path.join(dir, "s.json"), JSON.stringify(schema));
      assert.throws(() => findings({ op: "json", schema: "s.json", fix: "{problem}" }, "{}", "d.json"), /s\.json/u);
    }
  });

  it("custom runs the named check of the contract's custom folder", () => {
    fs.mkdirSync(path.join(dir, "custom"));
    fs.writeFileSync(path.join(dir, "custom", "always.cjs"), "module.exports = () => [{ line: 2, offending: 'x' }];\n");
    assert.deepEqual(lines(findings({ op: "custom", check: "always" }, "a\n")), [2]);
  });
});
