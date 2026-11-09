const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { UI, PATHS, LIB, makeTmp, removeTmp, filesUnder, engine, validate, writeProject } = require("../fixtures/aidd-ui/project.js");

const { feedbackOf } = require(path.join(LIB, "page.cjs"));

// A set of variants is driven as a subprocess, as the skill calls it: `compare` checks it and
// writes its page, `keep` makes one of its variants the design system's own file.

const DRAFTS = `${UI}/drafts`;
const PAGE = `${DRAFTS}/brand/compare.html`;
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

const compare = (id = "brand") => {
  const run = engine("compare", id, "--root", tmp);
  return { code: run.status, out: run.stdout, err: run.stderr };
};
const keep = (id, variant) => {
  const run = engine("keep", id, variant, "--root", tmp);
  return { code: run.status, out: run.stdout, err: run.stderr };
};
const snapshot = () => filesUnder(tmp).map((file) => [file, fs.readFileSync(file, "utf8")]);

/** `compare` refused the set for each of `rules`, writing nothing. */
function assertFlags(rules, id = "brand") {
  const before = snapshot();
  const run = compare(id);
  assert.equal(run.code, 1, run.out + run.err);
  for (const rule of rules) assert.match(run.out, new RegExp(` ${rule}( |$)`, "m"), `${rule} in ${run.out}`);
  assert.deepEqual(snapshot(), before);
  return run.out;
}

describe("aidd-ui drafts", () => {
  describe("D0 the project skips them", () => {
    it("validates as before with a draft of an unknown kind beside the records", () => {
      put(`${DRAFTS}/brand/a/brand.md`, "---\nid: brand\nkind: nothing-known\n---\n\n# Draft\n");
      assert.deepEqual(validate(tmp), { code: 0, out: ["VALID"], err: "" });
    });
  });

  describe("compare", () => {
    it("checks a valid set, prints each variant's name and intent in the table's order, and ignores the drafts", () => {
      writeSet("brand");
      const run = compare();
      assert.deepEqual([run.code, run.err], [0, ""]);
      assert.deepEqual(JSON.parse(run.out).variants, ROWS.map(([name, intent]) => ({ name, intent })));
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

    it("refuses a set without variants.md, nothing written", () => {
      const before = snapshot();
      const run = compare("brand");
      assert.deepEqual([run.code, run.out, run.err.startsWith("aidd-ui: ")], [2, "", true]);
      assert.deepEqual(snapshot(), before);
    });

    it("refuses a project without aidd_docs/ui, nothing written", () => {
      fs.rmSync(path.join(tmp, UI), { recursive: true });
      const run = compare("brand");
      assert.deepEqual([run.code, run.out, run.err.startsWith("aidd-ui: ")], [2, "", true]);
      assert.equal(exists(UI), false);
    });

    it("D5 flags a table without a Variant column, and a variant named like a path, naming the row", () => {
      writeSet("brand", { header: ["Direction", "Intent", "Tone"], rows: ROWS.map(([name, intent, tone]) => [name, intent, tone]) });
      const run = compare();
      assert.deepEqual([run.code, run.err], [1, ""]);
      assert.match(run.out, / D5 "undefined"/);
      writeSet("brand", { rows: ROWS.slice(0, 1) });
      put(`${DRAFTS}/brand/variants.md`, `${tableOf(HEADER, [ROWS[0], ["..", ROWS[1][1], "bold", "roomy"]])}\n`);
      assert.match(assertFlags(["D5"]), / D5 "\.\."/);
    });

    it("exits 2 with its usage when the set is not named", () => {
      const run = engine("compare", "--root", tmp);
      assert.deepEqual([run.status, run.stderr], [2, "usage: node aidd-ui.cjs compare <set> [--root <dir>]\n"]);
    });
  });

  describe("keep", () => {
    it("makes the variant the design system's file, drops every other, and leaves the set's ignore file", () => {
      writeSet("brand");
      compare();
      const run = keep("brand", "b");
      assert.deepEqual([run.code, run.err], [0, ""]);
      assert.deepEqual(JSON.parse(run.out), { kept: "b", written: [`${UI}/brand.md`] });
      assert.equal(read(PATHS.BRAND), brandOf("Tone of b"));
      assert.equal(exists(`${UI}/preview.html`), false);
      assert.equal(exists(`${DRAFTS}/brand`), false);
      assert.equal(read(`${DRAFTS}/.gitignore`), "*\n");
      assert.deepEqual(validate(tmp), { code: 0, out: ["VALID"], err: "" });
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

  describe("the comparison page", () => {
    const page = () => read(PAGE);
    const render = (title, states) => read(PATHS.BUTTON_RENDER).replace("<title>button</title>", `<title>${title}</title>`).replace(/<button class="ui"[\s\S]*<\/button>/, states.map((state) => `<button class="ui" data-state="${state}">${title}</button>`).join("\n"));
    const optionsOf = (id) => [...(page().match(new RegExp(`<select id="${id}">([\\s\\S]*?)</select>`))?.[1] ?? "").matchAll(/<option value="([^"]*)"/g)].map((match) => match[1]);
    const componentSet = (states = ["default", "hover"]) => writeSet("button", { rows: ROWS.slice(0, 2), files: (name) => ({ "components/x.html": render(name, states) }) });

    it("is written beside the set by compare, and named in its output", () => {
      writeSet("brand");
      assert.equal(JSON.parse(compare().out).page, PAGE);
      assert.equal(exists(PAGE), true);
    });

    it("holds each variant's name, intent, axis values and text, and each html file in a frame of its own", () => {
      writeSet("brand");
      compare();
      for (const [name, intent, tone, density] of ROWS) for (const text of [`data-name="${name}"`, intent, `<dd>${tone}</dd>`, `<dd>${density}</dd>`, `Tone of ${name}`]) assert.ok(page().includes(text), text);
      assert.equal(page().match(/<iframe /g).length, ROWS.length);
      assert.equal(page().match(/ srcdoc="/g).length, ROWS.length);
    });

    it("asks for nothing outside itself: no link, no source, no address", () => {
      writeSet("brand");
      compare();
      assert.doesNotMatch(page(), /\b(?:src|href)=["']|https?:\/\//);
    });

    it("takes the tokens of the design system in line, and lists its themes", () => {
      componentSet();
      compare("button");
      const text = read(`${DRAFTS}/button/compare.html`);
      assert.ok(text.includes("--space-md: 1rem"));
      assert.equal(text.includes("../tokens.css"), false);
      const themes = [...text.match(/<select id="theme">([\s\S]*?)<\/select>/)[1].matchAll(/<option value="([^"]*)"/g)].map((match) => match[1]);
      assert.deepEqual(themes, ["light", "dark"]);
    });

    it("lists no theme without a design system file", () => {
      fs.rmSync(path.join(tmp, PATHS.SYSTEM));
      writeSet("brand");
      compare();
      assert.equal(page().includes('id="theme"'), false);
    });

    it("lists the states its renders carry, once and sorted", () => {
      componentSet(["hover", "default"]);
      compare("button");
      const text = read(`${DRAFTS}/button/compare.html`);
      const states = [...text.match(/<select id="state">([\s\S]*?)<\/select>/)[1].matchAll(/<option value="([^"]*)"/g)].map((match) => match[1]);
      assert.deepEqual(states, ["", "default", "hover"]);
    });

    it("lists the variants in the order of variants.md", () => {
      writeSet("brand", { rows: [ROWS[1], ROWS[0], ROWS[2]] });
      compare();
      assert.deepEqual([...page().matchAll(/<section class="variant" data-name="(\w+)"/g)].map((match) => match[1]), ["b", "a", "c"]);
    });

    it("is the same bytes on a second run", () => {
      writeSet("brand");
      compare();
      const first = page();
      compare();
      assert.equal(page(), first);
    });

    it("builds the feedback of a rated, discarded and commented state, a missing rating being null", () => {
      const state = {
        draft: "brand",
        variants: [
          { name: "a", rating: "4", discarded: false, comment: "calm" },
          { name: "b", rating: "", discarded: true, comment: "" },
        ],
      };
      assert.deepEqual(feedbackOf(state), {
        draft: "brand",
        variants: [
          { name: "a", rating: 4, discarded: false, comment: "calm" },
          { name: "b", rating: null, discarded: true, comment: "" },
        ],
      });
    });

    it("carries feedbackOf as the module has it", () => {
      writeSet("brand");
      compare();
      assert.ok(page().includes(feedbackOf.toString()));
    });

    it("saves to a file only where the browser can, and copies everywhere", () => {
      writeSet("brand");
      compare();
      const guard = page().indexOf('if (typeof window.showSaveFilePicker === "function")');
      assert.ok(guard >= 0, "the guard");
      assert.ok(page().indexOf("window.showSaveFilePicker({") > guard, "the call lies behind it");
      assert.equal(page().match(/showSaveFilePicker\(/g).length, 1);
      assert.match(page(), /<button id="save" hidden>/);
      assert.match(page(), /<button id="copy">/);
      assert.match(page(), /<textarea id="feedback" readonly/);
    });

    it("opens no connection", () => {
      writeSet("brand");
      compare();
      assert.doesNotMatch(page(), /fetch|XMLHttpRequest|WebSocket/);
    });
  });
});
