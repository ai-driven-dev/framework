const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { UI, LIB, makeTmp, removeTmp, engine, writeProject, put } = require("../fixtures/aidd-ui/project.js");
const { load } = require(path.join(LIB, "project.cjs"));
const { showcaseOf, copiedOf, keptOf, entriesOf, blockedOf, remainingOf, LABELS } = require(path.join(LIB, "showcase.cjs"));

// The sets of variants are chosen inside the showcase: a page per set, in the navigation and the
// review panel beside the records. The pages are judged as text, the command as a subprocess.

let tmp;

beforeEach(() => {
  tmp = makeTmp("aidd-ui-showcase-sets-");
  writeProject(tmp);
});

afterEach(() => removeTmp(tmp));

const SECTIONS = (tone) => `---\nid: brand\nkind: brand\n---\n\n# Brand of ${tone}\n\n## Tone\n\n${tone}.\n\n## Voice\n\nPlain words.\n\n## Colours\n\nSame for all.\n`;
const file = (name, text) => ({ path: name, text });
const variant = (name, tone, files) => ({ name, intent: `Intent of ${name}`, axes: [["Tone", tone], ["Density", "roomy"]], files });
const SET = (overrides = {}) => ({
  id: "layout",
  rows: [],
  axes: ["Tone", "Density"],
  variants: [
    variant("a", "calm", [file("brand.md", SECTIONS("calm").replace("Plain words.", "Quiet words.")), file("preview.html", '<html><head><link rel="stylesheet" href="../tokens.css"></head><body><p>A</p></body></html>')]),
    variant("b", "bold", [file("brand.md", SECTIONS("bold")), file("preview.html", "<html><head></head><body><p>B</p></body></html>")]),
  ],
  problems: [],
  fingerprint: "f1",
  ...overrides,
});
const pagesOf = (sets, options = {}) => showcaseOf({ project: load(tmp), problems: [], tokens: ":root { --accent: #123456; }\n", captures: new Set(), lang: "en", sets, ...options });
const groupOf = (html, group) => html.match(new RegExp(`<section data-group="${group}">[\\s\\S]*?</section>`))?.[0];
const unescaped = (text) => text.replaceAll("&quot;", '"').replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");
const columnsOf = (html) => [...html.matchAll(/<section class="variant" data-variant="([^"]+)">[\s\S]*?<\/section>/g)].map((match) => ({ name: match[1], html: match[0] }));

describe("aidd-ui showcase sets", () => {
  describe("the navigation", () => {
    it("opens with a group to choose, one link per set, on every page", () => {
      const pages = pagesOf([SET(), SET({ id: "palette" })]);
      for (const html of Object.values(pages)) {
        const group = groupOf(html, "choose");
        assert.ok(group, "a group to choose");
        assert.ok(html.indexOf('data-group="choose"') < html.indexOf('data-group="system"'), "first of the groups");
        assert.deepEqual([...group.matchAll(/href="([^"]+)"/g)].map((match) => match[1]), ["_set-layout.html", "_set-palette.html"]);
        assert.match(group, new RegExp(`<h2>${LABELS.en.choose}</h2>`));
      }
    });

    it("marks the set the page stands on, and no group without sets", () => {
      const pages = pagesOf([SET()]);
      assert.match(groupOf(pages["_set-layout.html"], "choose"), /<a href="_set-layout.html" aria-current="page">/);
      assert.doesNotMatch(groupOf(pages["index.html"], "choose"), /aria-current/);
      assert.equal(groupOf(pagesOf([])["index.html"], "choose"), undefined);
    });

    it("says it in French on a French page", () => {
      assert.match(groupOf(pagesOf([SET()], { lang: "fr" })["index.html"], "choose"), /<h2>À choisir<\/h2>/);
    });
  });

  describe("the page of a set", () => {
    it("is written under a name of its own, so a set named like a record never overwrites its page", () => {
      const pages = pagesOf([SET({ id: "brand" })]);
      assert.ok(pages["brand.html"] && pages["_set-brand.html"]);
      assert.notEqual(pages["brand.html"], pages["_set-brand.html"]);
      assert.match(pages["_set-brand.html"], /<section class="variant" data-variant="a">/);
      assert.doesNotMatch(pages["brand.html"], /<section class="variant" data-variant="a">/);
    });

    it("shows one column per variant: its name, its intent and its axes", () => {
      const columns = columnsOf(pagesOf([SET()])["_set-layout.html"]);
      assert.deepEqual(columns.map((column) => column.name), ["a", "b"]);
      assert.match(columns[0].html, /<h2>a<\/h2>/);
      assert.match(columns[0].html, /Intent of a/);
      assert.match(columns[1].html, /<th>Tone<\/th><td>bold<\/td>/);
      assert.match(columns[1].html, /<th>Density<\/th><td>roomy<\/td>/);
    });

    it("shows each html of a variant in a desktop frame of 1280 and a mobile frame of 390, with the tokens inline", () => {
      const [a] = columnsOf(pagesOf([SET()])["_set-layout.html"]);
      const frames = [...a.html.matchAll(/<div class="fit" data-size="(\w+)" data-width="(\d+)" data-height="(\d+)"[^>]*><iframe[^>]*srcdoc="([^"]*)"/g)];
      assert.deepEqual(frames.map((frame) => [frame[1], frame[2], frame[3]]), [["desktop", "1280", "800"], ["mobile", "390", "844"]]);
      for (const frame of frames) {
        assert.match(unescaped(frame[4]), /--accent: #123456/);
        assert.match(unescaped(frame[4]), /<p>A<\/p>/);
      }
    });

    it("scales the frames to their column with a script, and offers no toggle between sizes", () => {
      const html = pagesOf([SET()])["_set-layout.html"];
      assert.match(html, /scale\(/);
      assert.doesNotMatch(html, /1 up|2 up|shift/i);
    });

    it("shows of a markdown path every variant shares only the sections that differ, and names the others once", () => {
      const html = pagesOf([SET()])["_set-layout.html"];
      const [a, b] = columnsOf(html);
      assert.match(a.html, /Quiet words\./);
      assert.match(b.html, /Plain words\./);
      assert.match(a.html, /calm\./);
      for (const column of [a, b]) assert.doesNotMatch(column.html, /Same for all/);
      const same = [...html.matchAll(/<p class="same"[^>]*>([\s\S]*?)<\/p>/g)].map((match) => match[1]);
      assert.equal(same.length, 1);
      assert.match(same[0], /Identique dans toutes|Same in all/);
      assert.match(same[0], /Colours/);
      assert.doesNotMatch(same[0], /Voice|Tone/);
    });

    it("shows a path that only some variants have as it is, and says nothing of it", () => {
      const set = SET();
      set.variants[1].files.push(file("only-b.md", "# Only B\n\n## Same\n\nShown.\n"));
      const html = pagesOf([set])["_set-layout.html"];
      assert.match(columnsOf(html)[1].html, /Only B/);
      assert.equal([...html.matchAll(/<p class="same"/g)].length, 1);
    });

    it("shows the problems of a set in place of its frames", () => {
      const html = pagesOf([SET({ problems: [{ rule: "D4", severity: "error", file: "x/variants.md", message: "variants share every axis value", fix: "make them differ" }] })])["_set-layout.html"];
      assert.match(html, /<li data-rule="D4"><b>D4<\/b> variants share every axis value/);
      assert.match(html, /make them differ/);
      assert.doesNotMatch(html, /<iframe/);
      assert.doesNotMatch(html, /<section class="variant"/);
    });

    it("escapes what the variants say", () => {
      const set = SET();
      set.variants[0].intent = "<b>loud</b>";
      assert.doesNotMatch(pagesOf([set])["_set-layout.html"], /<b>loud<\/b>/);
    });
  });

  describe("the words", () => {
    it("are the same keys in both languages, plain in French", () => {
      for (const key of ["choose", "desktop", "mobile", "same", "keep", "discard"]) assert.ok(LABELS.en[key] && LABELS.fr[key], key);
      assert.equal(LABELS.fr.choose, "À choisir");
      assert.deepEqual([LABELS.fr.desktop, LABELS.fr.mobile, LABELS.fr.keep, LABELS.fr.revise, LABELS.fr.discard], ["Ordinateur", "Mobile", "Garder", "À revoir", "Écarter"]);
      assert.equal(LABELS.fr.same, "Identique dans toutes : {sections}");
      assert.deepEqual(Object.keys(LABELS.fr).sort(), Object.keys(LABELS.en).sort());
    });
  });

  describe("the swatches", () => {
    const cellsOf = (axes) => {
      const set = SET();
      set.variants[0].axes = axes;
      return [...columnsOf(pagesOf([set])["_set-layout.html"])[0].html.matchAll(/<td>([\s\S]*?)<\/td>/g)].map((match) => match[1]);
    };

    it("turns each colour of an axis cell into a swatch and its code, the rest stays text", () => {
      const [cell] = cellsOf([["Colours", "ink #1A2b3C on #fff0e6, plain"]]);
      assert.equal((cell.match(/class="swatch"/g) ?? []).length, 2);
      assert.match(cell, /<i class="swatch" style="background: #1A2b3C"><\/i><code>#1A2b3C<\/code>/);
      assert.match(cell, /<i class="swatch" style="background: #fff0e6"><\/i><code>#fff0e6<\/code>/);
      assert.match(cell, /^ink .* on .*, plain$/);
    });

    it("leaves a cell without colour as escaped text", () => {
      assert.deepEqual(cellsOf([["Tone", "<b>calm</b> #12345"]]), ["&lt;b&gt;calm&lt;/b&gt; #12345"]);
    });
  });

  describe("the drawer", () => {
    const drawerOf = (html) => html.match(/<aside class="drawer"[\s\S]*?<\/aside>/)[0];
    const groupOfSets = (html) => drawerOf(html).match(/<section class="choices" data-group="choose">[\s\S]*?<\/section>/)?.[0];

    it("holds a group to choose, one row per variant with its three verdicts and a comment, on every page", () => {
      for (const html of Object.values(pagesOf([SET()]))) {
        const group = groupOfSets(html);
        assert.ok(group, "a group in the drawer");
        assert.match(group, new RegExp(`<h3>${LABELS.en.choose}</h3>`));
        assert.match(group, /<details class="choice" data-set="layout" data-fingerprint="f1" open>/);
        const rows = [...group.matchAll(/<li class="pvariant" data-variant="([^"]+)">([\s\S]*?)<\/li>/g)];
        assert.deepEqual(rows.map((row) => row[1]), ["a", "b"]);
        for (const [, , row] of rows) {
          assert.deepEqual([...row.matchAll(/class="vote" data-verdict="(\w+)"[^>]*>([^<]+)</g)].map((match) => [match[1], match[2]]), [["keep", "Keep"], ["revise", "Revise"], ["discard", "Discard"]]);
          assert.match(row, /<textarea class="comment"[^>]* hidden>/);
        }
      }
    });

    it("keeps the sets out of what the records read, and the group out of a page without sets", () => {
      const drawer = drawerOf(pagesOf([SET()])["index.html"]);
      assert.doesNotMatch(groupOfSets(pagesOf([SET()])["index.html"]), /class="item"|data-record=|class="pstate"/);
      assert.equal(groupOfSets(pagesOf([])["index.html"]), undefined);
      assert.ok(drawer.includes('class="drawer-body"'));
    });

    it("says the group in French, and carries the pure functions of the copy in every script", () => {
      assert.match(groupOfSets(pagesOf([SET()], { lang: "fr" })["index.html"]), /<h3>À choisir<\/h3>/);
      for (const html of Object.values(pagesOf([SET()]))) {
        const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
        assert.doesNotThrow(() => new Function(script));
        for (const fn of [copiedOf, keptOf, entriesOf, blockedOf, remainingOf]) assert.ok(script.includes(fn.toString()), fn.name);
      }
    });
  });

  describe("the copy of a set", () => {
    const LONE = '```json\n{\n  "set": "layout",\n  "variants": [\n    {\n      "name": "a",\n      "verdict": "revise",\n      "comment": "calm"\n    },\n    {\n      "name": "b",\n      "verdict": null,\n      "comment": ""\n    }\n  ]\n}\n```\n';
    const decided = { set: "layout", variants: [{ name: "a", verdict: "revise", comment: " calm " }, { name: "b", verdict: null, comment: "" }] };
    const home = { record: "home", version: "1", verdicts: [{ state: "default", verdict: "ok", comment: "" }] };

    it("copies a set alone as the comparison page copied it: one object, undecided variants null", () => {
      assert.equal(copiedOf([decided]), LONE);
    });

    it("copies nothing for a set whose variants are all undecided", () => {
      assert.equal(copiedOf([{ set: "layout", variants: [{ name: "a", verdict: null, comment: "" }] }]), "");
    });

    it("copies records and sets together as a list, in the order given", () => {
      const copy = copiedOf([home, decided]);
      assert.deepEqual(JSON.parse(copy.replace(/^```json\n|\n```\n$/g, "")), [{ record: "home", version: 1, verdicts: [{ state: "default", verdict: "ok", comment: "" }] }, { set: "layout", variants: [{ name: "a", verdict: "revise", comment: "calm" }, { name: "b", verdict: null, comment: "" }] }]);
    });

    const model = { records: [{ key: "home@1", record: "home", version: "1", states: [{ state: "default", settled: false }, { state: "loading", settled: true }] }], sets: [{ key: "set:layout@f1", set: "layout", variants: ["a", "b"] }] };

    it("builds the entries from the choices, a variant with none being null", () => {
      const entries = entriesOf(model, { "home@1": { default: { verdict: "ok" } }, "set:layout@f1": { a: { verdict: "keep", comment: "" } } });
      assert.deepEqual(entries, [
        { record: "home", version: "1", verdicts: [{ state: "default", verdict: "ok", comment: "" }] },
        { set: "layout", variants: [{ name: "a", verdict: "keep", comment: "" }, { name: "b", verdict: null, comment: "" }] },
      ]);
    });

    it("never marks a variant when the rest is marked OK", () => {
      assert.deepEqual(remainingOf(model, {}), [{ key: "home@1", state: "default" }]);
      assert.deepEqual(remainingOf({ records: [], sets: model.sets }, {}), []);
    });

    it("blocks the copy on a variant to revise without a comment, as on a state", () => {
      const revise = (comment) => [{ set: "layout", variants: [{ name: "a", verdict: "revise", comment }, { name: "b", verdict: "keep", comment: "" }] }];
      assert.equal(blockedOf(revise("  ")), true);
      assert.equal(blockedOf(revise("bolder")), false);
      assert.equal(blockedOf([{ set: "layout", variants: [{ name: "a", verdict: "discard", comment: "" }] }]), false);
      assert.equal(blockedOf([{ record: "home", version: "1", verdicts: [{ state: "default", verdict: "revise", comment: "" }] }]), true);
    });

    it("keeps the choices of a set at its fingerprint only", () => {
      assert.deepEqual(keptOf({ "set:layout@f1": { a: { verdict: "keep" } }, "set:layout@f0": { a: { verdict: "keep" } } }, ["set:layout@f1"]), { "set:layout@f1": { a: { verdict: "keep" } } });
    });
  });

  describe("the command", () => {
    const writeSet = (rows) => {
      put(tmp, `${UI}/drafts/layout/variants.md`, `# Variants\n\n${rows.join("\n")}\n`);
      put(tmp, `${UI}/drafts/layout/a/preview.html`, "<p>a</p>");
      put(tmp, `${UI}/drafts/layout/b/preview.html`, "<p>b</p>");
    };
    const VALID = ["| Variant | Intent | Tone |", "| --- | --- | --- |", "| a | Calm | calm |", "| b | Bold | bold |"];

    it("writes the page of a valid set and exits 0", () => {
      writeSet(VALID);
      const run = engine("showcase", "--root", tmp);
      assert.deepEqual([run.status, run.stderr], [0, ""]);
      assert.ok(fs.existsSync(path.join(tmp, UI, "showcase/_set-layout.html")));
    });

    it("writes every page, prints the problems of a set that has some, and exits 1", () => {
      writeSet(["| Variant | Intent | Tone |", "| --- | --- | --- |", "| a | Calm | calm |", "| b | Bold | CALM |"]);
      const run = engine("showcase", "--root", tmp);
      assert.equal(run.status, 1, run.stdout + run.stderr);
      assert.match(run.stdout, / D4 /);
      assert.ok(fs.existsSync(path.join(tmp, UI, "showcase/index.html")));
      assert.match(fs.readFileSync(path.join(tmp, UI, "showcase/_set-layout.html"), "utf8"), /data-rule="D4"/);
    });
  });
});
