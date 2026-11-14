const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { UI, PATHS, LIB, makeTmp, removeTmp, filesUnder, engine, validate, writeProject } = require("../fixtures/aidd-ui/project.js");

// A set of variants is driven as a subprocess, as the skill calls it: `showcase` checks it and
// writes its page, `keep` makes one of its variants the design system's own file.

const DRAFTS = `${UI}/drafts`;
const HEADER = ["Variant", "Intent", "Tone", "Density"];
const ROWS = [
  ["a", "Calm and plain for analysts", "calm", "roomy"],
  ["b", "Bold and direct for newcomers", "bold", "roomy"],
  ["c", "Dense and quiet for experts", "calm", "tight"],
];

let tmp;

beforeEach(() => {
  tmp = makeTmp("aidd-ui-drafts-");
  writeProject(tmp);
});

afterEach(() => removeTmp(tmp));

const cell = (value) => ` ${value} `;
const tableOf = (header, rows) => [header, header.map(() => "---"), ...rows].map((each) => `|${each.map(cell).join("|")}|`).join("\n");
const put = (name, content) => {
  fs.mkdirSync(path.dirname(path.join(tmp, name)), { recursive: true });
  fs.writeFileSync(path.join(tmp, name), content);
};
const read = (name) => fs.readFileSync(path.join(tmp, name), "utf8");
const exists = (name) => fs.existsSync(path.join(tmp, name));
const brandOf = (tone) => read(PATHS.BRAND).replace("Plain and calm.", `${tone}.`);

/** A set `id` with `rows` declared and, for each variant, `files(name)` written in its folder. */
function writeSet(id, { header = HEADER, rows = ROWS, files = (name) => ({ "brand.md": brandOf(`Tone of ${name}`), "preview.html": `<p>${name}</p>\n` }) } = {}) {
  put(`${DRAFTS}/${id}/variants.md`, `# Variants\n\n${tableOf(header, rows)}\n`);
  for (const [name] of rows) for (const [file, content] of Object.entries(files(name))) put(`${DRAFTS}/${id}/${name}/${file}`, content);
}

const showcase = () => {
  const run = engine("showcase", "--root", tmp);
  return { code: run.status, out: run.stdout, err: run.stderr };
};
const keep = (id, variant) => {
  const run = engine("keep", id, variant, "--root", tmp);
  return { code: run.status, out: run.stdout, err: run.stderr };
};
const snapshot = () => filesUnder(tmp).map((file) => [file, fs.readFileSync(file, "utf8")]);

/** `showcase` printed the problems of the set for each of `rules`, exited 1, and showed them on the set's page. */
function assertFlags(rules, id = "brand") {
  const run = showcase();
  assert.equal(run.code, 1, run.out + run.err);
  const page = read(`${UI}/showcase/_set-${id}.html`);
  for (const rule of rules) {
    assert.match(run.out, new RegExp(` ${rule}( |$)`, "m"), `${rule} in ${run.out}`);
    assert.match(page, new RegExp(`data-rule="${rule}"`), `${rule} on the page`);
  }
  return run.out;
}

describe("aidd-ui drafts", () => {
  describe("D0 the project skips them", () => {
    it("validates as before with a draft of an unknown kind beside the records", () => {
      put(`${DRAFTS}/brand/a/brand.md`, "---\nid: brand\nkind: nothing-known\n---\n\n# Draft\n");
      assert.deepEqual(validate(tmp), { code: 0, out: ["VALID"], err: "" });
    });
  });

  describe("D1 to D5, through showcase", () => {
    it("shows a valid set on a page of its own, exits 0, and the drafts stay out of the validation", () => {
      writeSet("brand");
      const run = showcase();
      assert.deepEqual([run.code, run.err], [0, ""]);
      assert.deepEqual(ROWS.filter(([name]) => !read(`${UI}/showcase/_set-brand.html`).includes(`data-variant="${name}"`)), []);
      assert.equal(read(`${DRAFTS}/.gitignore`), "*\n");
      assert.deepEqual(validate(tmp), { code: 0, out: ["VALID"], err: "" });
    });

    it("D1 flags a set of one variant", () => {
      writeSet("brand", { rows: ROWS.slice(0, 1) });
      assertFlags(["D1"]);
    });

    it("D2 flags a variant without an intent, naming it", () => {
      writeSet("brand", { rows: [ROWS[0], ["b", "", "bold", "roomy"], ROWS[2]] });
      assert.match(assertFlags(["D2"]), / D2 "b"/);
    });

    it("D3 flags a table without an axis column, then an empty axis cell", () => {
      writeSet("brand", { header: ["Variant", "Intent"], rows: ROWS.map(([name, intent]) => [name, intent]) });
      assertFlags(["D3"]);
      writeSet("brand", { rows: [ROWS[0], ["b", ROWS[1][1], "", "roomy"], ROWS[2]] });
      assert.match(assertFlags(["D3"]), / D3 "b"/);
    });

    it("D4 flags two variants with the same axis values, case and spacing aside", () => {
      writeSet("brand", { rows: [ROWS[0], ["b", ROWS[1][1], "  CALM ", "Roomy"], ROWS[2]] });
      assert.match(assertFlags(["D4"]), / D4 "a, b"/);
    });

    it("D5 flags a variant without a folder, then one with an empty folder", () => {
      writeSet("brand");
      fs.rmSync(path.join(tmp, DRAFTS, "brand/b"), { recursive: true });
      assert.match(assertFlags(["D5"]), / D5 "b"/);
      fs.mkdirSync(path.join(tmp, DRAFTS, "brand/b"));
      assert.match(assertFlags(["D5"]), / D5 "b"/);
    });

    it("D5 flags a table without a Variant column, and a variant named like a path, naming the row", () => {
      writeSet("brand", { header: ["Direction", "Intent", "Tone"], rows: ROWS.map(([name, intent, tone]) => [name, intent, tone]) });
      const run = showcase();
      assert.deepEqual([run.code, run.err], [1, ""]);
      assert.match(run.out, / D5 "undefined"/);
      writeSet("brand", { rows: ROWS.slice(0, 1) });
      put(`${DRAFTS}/brand/variants.md`, `${tableOf(HEADER, [ROWS[0], ["..", ROWS[1][1], "bold", "roomy"]])}\n`);
      assert.match(assertFlags(["D5"]), / D5 "\.\."/);
    });

    it("is no command any more: compare exits 2 as an unknown command and writes nothing", () => {
      writeSet("brand");
      const before = snapshot();
      const run = engine("compare", "brand", "--root", tmp);
      assert.deepEqual([run.status, run.stdout], [2, ""]);
      assert.match(run.stderr, /^usage: node aidd-ui.cjs help/);
      assert.doesNotMatch(run.stderr, /compare/);
      assert.deepEqual(snapshot(), before);
    });
  });

  describe("keep", () => {
    it("makes the variant the design system's file, drops every other, and leaves the set's ignore file", () => {
      writeSet("brand");
      showcase();
      const run = keep("brand", "b");
      assert.deepEqual([run.code, run.err], [0, ""]);
      assert.deepEqual(JSON.parse(run.out), { kept: "b", written: [`${UI}/brand.md`] });
      assert.equal(read(PATHS.BRAND), brandOf("Tone of b"));
      assert.equal(exists(`${UI}/preview.html`), false);
      assert.equal(exists(`${DRAFTS}/brand`), false);
      assert.equal(read(`${DRAFTS}/.gitignore`), "*\n");
      assert.deepEqual(validate(tmp), { code: 0, out: ["VALID"], err: "" });
    });

    it("keeps the version of the record it replaces, never the variant's", () => {
      writeSet("brand");
      fs.writeFileSync(path.join(tmp, PATHS.BRAND), read(PATHS.BRAND).replace("version: 1", "version: 3"));
      const run = keep("brand", "b");
      assert.deepEqual([run.code, run.err], [0, ""]);
      assert.equal(read(PATHS.BRAND), brandOf("Tone of b").replace("version: 1", "version: 3"));
    });

    it("keeps the variant's own version for a record the design system does not hold yet", () => {
      writeSet("button", { rows: ROWS.slice(0, 2), files: (name) => ({ "components/x.md": "---\nid: x\nversion: 4\n---\n", "preview.html": "<p>p</p>\n" }) });
      keep("button", "b");
      assert.equal(read(`${UI}/components/x.md`), "---\nid: x\nversion: 4\n---\n");
    });

    it("removes every round of the set with the kept variant", () => {
      writeSet("brand", { header: [...HEADER, "Round", "Parent"], rows: [[...ROWS[0], "1", ""], [...ROWS[1], "1", ""], [...ROWS[2], "2", "a"]] });
      const run = keep("brand", "c");
      assert.deepEqual([run.code, run.err], [0, ""]);
      assert.equal(read(PATHS.BRAND), brandOf("Tone of c"));
      assert.equal(exists(`${DRAFTS}/brand`), false);
    });

    it("lands each file where the variant's folder mirrors it", () => {
      writeSet("button", { rows: ROWS.slice(0, 2), files: (name) => ({ "components/x.md": `md ${name}\n`, "components/x.html": `<p>${name}</p>\n`, "preview.html": "<p>p</p>\n" }) });
      const run = keep("button", "b");
      assert.deepEqual(JSON.parse(run.out).written, [`${UI}/components/x.html`, `${UI}/components/x.md`]);
      assert.equal(read(`${UI}/components/x.md`), "md b\n");
      assert.equal(read(`${UI}/components/x.html`), "<p>b</p>\n");
    });

    it("refuses a name that leaves the drafts folder, nothing written", () => {
      writeSet("brand");
      const before = snapshot();
      const run = keep("../drafts/brand", "b");
      assert.deepEqual([run.code, run.out], [2, ""]);
      assert.deepEqual(snapshot(), before);
    });

    it("refuses a variant named like a path, whatever the folder it reaches, nothing written", () => {
      writeSet("brand", { rows: ROWS.slice(0, 1) });
      put(`${DRAFTS}/brand/variants.md`, `${tableOf(HEADER, [ROWS[0], ["..", ROWS[1][1], "bold", "roomy"]])}\n`);
      put(`${DRAFTS}/.gitignore`, "*\n");
      const before = snapshot();
      const run = keep("brand", "..");
      assert.deepEqual([run.code, run.out, run.err.startsWith("aidd-ui: ")], [2, "", true]);
      assert.deepEqual(snapshot(), before);
      assert.equal(exists(`${UI}/.gitignore`), false);
    });

    it("refuses an unknown variant, nothing written", () => {
      writeSet("brand");
      const before = snapshot();
      const run = keep("brand", "z");
      assert.deepEqual([run.code, run.out, run.err.startsWith("aidd-ui: ")], [2, "", true]);
      assert.deepEqual(snapshot(), before);
    });

    it("refuses a set that has a problem, nothing written", () => {
      writeSet("brand", { rows: [ROWS[0], ["b", "", "bold", "roomy"], ROWS[2]] });
      const before = snapshot();
      const run = keep("brand", "b");
      assert.deepEqual([run.code, run.out, run.err.startsWith("aidd-ui: ")], [2, "", true]);
      assert.deepEqual(snapshot(), before);
      assert.equal(exists(`${DRAFTS}/brand/b/brand.md`), true);
    });

    it("exits 2 with its usage when the variant is not named", () => {
      const run = engine("keep", "brand", "--root", tmp);
      assert.deepEqual([run.status, run.stderr], [2, "usage: node aidd-ui.cjs keep <set> <variant> [--root <dir>]\n"]);
    });
  });

  describe("setsOf", () => {
    const { setsOf } = require(path.join(LIB, "drafts.cjs"));

    it("lists no set when the project has no drafts", () => {
      assert.deepEqual(setsOf(tmp), []);
    });

    it("lists each set with its rows, axes, shown variants, problems and a fingerprint of what it shows", () => {
      writeSet("brand");
      writeSet("layout", { rows: ROWS.slice(0, 1) });
      const sets = setsOf(tmp);
      assert.deepEqual(sets.map((set) => set.id), ["brand", "layout"]);
      const [brand, layout] = sets;
      assert.deepEqual(brand.axes, ["Tone", "Density"]);
      assert.deepEqual(brand.rows.map((row) => row.Variant), ["a", "b", "c"]);
      assert.deepEqual(brand.variants.map(({ name, intent, axes }) => [name, intent, axes]), ROWS.map(([name, intent, tone, density]) => [name, intent, [["Tone", tone], ["Density", density]]]));
      assert.deepEqual(brand.variants[0].files.map((file) => file.path), ["brand.md", "preview.html"]);
      assert.deepEqual(brand.problems, []);
      assert.match(brand.fingerprint, /^[0-9a-f]{64}$/);
      assert.deepEqual(layout.problems.map((problem) => problem.rule), ["D1"]);
    });

    it("changes the fingerprint when a variant's file changes, and only then", () => {
      writeSet("brand");
      const before = setsOf(tmp)[0].fingerprint;
      assert.equal(setsOf(tmp)[0].fingerprint, before);
      put(`${DRAFTS}/brand/a/preview.html`, "<p>changed</p>\n");
      assert.notEqual(setsOf(tmp)[0].fingerprint, before);
    });

    it("reads a Round and a Parent column as the rounds of a set, never as axes", () => {
      writeSet("brand", { header: [...HEADER, "Round", "Parent"], rows: [[...ROWS[0], "1", ""], [...ROWS[1], "1", ""], [...ROWS[2], "2", "a"]] });
      const [set] = setsOf(tmp);
      assert.deepEqual(set.axes, ["Tone", "Density"]);
      assert.deepEqual(set.variants.map((variant) => [variant.name, variant.round, variant.parent]), [["a", 1, null], ["b", 1, null], ["c", 2, "a"]]);
      assert.deepEqual(set.variants[2].axes.map(([axis]) => axis), ["Tone", "Density"]);
      assert.deepEqual(set.problems, []);
    });

    it("puts every variant of a set without a Round column in round 1", () => {
      writeSet("brand");
      assert.deepEqual(setsOf(tmp)[0].variants.map((variant) => [variant.round, variant.parent]), [[1, null], [1, null], [1, null]]);
    });

    it("keeps a set whose variant is named like a path, with its problem and no files", () => {
      writeSet("brand", { rows: [ROWS[0], ["../x", ROWS[1][1], "bold", "roomy"], ROWS[2]] });
      const [set] = setsOf(tmp);
      assert.ok(set.problems.some((problem) => problem.rule === "D5"));
      assert.deepEqual(set.variants[1].files, []);
    });

    it("skips a folder that holds no variants.md and a folder that is no set name", () => {
      put(`${DRAFTS}/empty/a/preview.html`, "<p>a</p>");
      put(`${DRAFTS}/Not A Name/variants.md`, "# x\n");
      assert.deepEqual(setsOf(tmp), []);
    });
  });

  describe("showcase and the drafts folder", () => {
    const showcase = () => engine("showcase", "--root", tmp);

    it("writes drafts/.gitignore when drafts exist, so a draft never reaches the history", () => {
      writeSet("brand");
      assert.equal(showcase().status, 0);
      assert.equal(read(`${DRAFTS}/.gitignore`), "*\n");
    });

    it("writes no drafts folder when the project holds none", () => {
      assert.equal(showcase().status, 0);
      assert.equal(exists(DRAFTS), false);
    });
  });
});
