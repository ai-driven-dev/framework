const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { UI, LIB, makeTmp, removeTmp, engine, writeProject, put, record } = require("../fixtures/aidd-ui/project.js");
const { load } = require(path.join(LIB, "project.cjs"));
const { showcaseOf, copiedOf, keptOf, entriesOf, blockedOf, remainingOf, pickedOf, LABELS } = require(path.join(LIB, "showcase.cjs"));

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
const pagesOf = (sets, options = {}) => showcaseOf({ project: load(tmp), tokens: ":root { --accent: #123456; }\n", captures: new Set(), lang: "en", sets, ...options });
const groupOf = (html, group) => html.match(new RegExp(`<section data-group="${group}">[\\s\\S]*?</section>`))?.[0];
const unescaped = (text) => text.replaceAll("&quot;", '"').replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");
const columnsOf = (html) => [...html.matchAll(/<section class="variant" data-variant="([^"]+)">[\s\S]*?<\/section>/g)].map((match) => ({ name: match[1], html: match[0] }));

describe("aidd-ui showcase sets", () => {
  describe("the navigation", () => {
    it("lists the sets as a group to choose inside their step, one link per set, on every page", () => {
      const pages = pagesOf([SET(), SET({ id: "palette" })]);
      for (const html of Object.values(pages)) {
        const group = groupOf(html, "choose");
        assert.ok(group, "a group to choose");
        const identity = html.match(/<li data-step="identity"[\s\S]*?<\/details><\/li>/)[0];
        assert.ok(identity.includes(group), "inside the step of its files");
        assert.deepEqual([...group.matchAll(/href="([^"]+)"/g)].map((match) => match[1]), ["_set-layout.html", "_set-palette.html"]);
        assert.match(group, new RegExp(`<h3>${LABELS.en.choose}</h3>`));
      }
    });

    it("puts a set in the step of its first file, and opens that step on the page of the set", () => {
      const set = SET({ id: "shapes", variants: SET().variants.map((each) => ({ ...each, files: [file("wireframes/x.md", "x"), ...each.files] })) });
      const pages = pagesOf([set]);
      assert.match(pages["index.html"].match(/<li data-step="screens"[\s\S]*?<\/details><\/li>/)[0], /data-set="shapes"/);
      assert.match(pages["_set-shapes.html"], /<li data-step="screens" data-todo="2"><details open>/);
    });

    it("marks the set the page stands on, and no group without sets", () => {
      const pages = pagesOf([SET()]);
      assert.match(groupOf(pages["_set-layout.html"], "choose"), /<a href="_set-layout.html" aria-current="page">/);
      assert.doesNotMatch(groupOf(pages["index.html"], "choose"), /aria-current/);
      assert.equal(groupOf(pagesOf([])["index.html"], "choose"), undefined);
    });

    it("says it in French on a French page", () => {
      assert.match(groupOf(pagesOf([SET()], { lang: "fr" })["index.html"], "choose"), /<h3>Variantes<\/h3>/);
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
      assert.match(columns[0].html, /<h2>A<\/h2>/);
      assert.match(columns[0].html, /Intent of a/);
      assert.match(columns[1].html, /<th>Tone<\/th><td><button[^>]*>bold<span class="take-cta">Take<\/span><\/button><\/td>/);
      assert.match(columns[1].html, /<th>Density <small class="same-tag">same<\/small><\/th><td><span class="value">roomy<\/span><\/td>/);
    });

    it("shows each html of a variant in one mobile frame of 390, with the tokens inline", () => {
      const [a] = columnsOf(pagesOf([SET()])["_set-layout.html"]);
      const frames = [...a.html.matchAll(/<div class="fit" data-size="(\w+)" data-width="(\d+)" data-height="(\d+)"[^>]*><iframe[^>]*srcdoc="([^"]*)"/g)];
      assert.deepEqual(frames.map((frame) => [frame[1], frame[2], frame[3]]), [["mobile", "390", "844"]]);
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

    it("gives each row of a round the height of its tallest twin, the heads and each axis row alike", () => {
      const { SCRIPT } = require(path.join(LIB, "variants.cjs"));
      const part = (height) => ({ offsetHeight: height, style: {} });
      const column = (head, rows) => ({ querySelector: () => head, querySelectorAll: () => rows });
      const heads = [part(80), part(120)];
      const rows = [[part(20), part(60)], [part(50), part(30)]];
      const round = { querySelectorAll: () => [column(heads[0], rows[0]), column(heads[1], rows[1])] };
      const all = (selector) => (selector === ".variants" ? [round] : []);
      new Function("document", "window", SCRIPT)({ querySelectorAll: all, querySelector: () => null, getElementById: () => null }, { addEventListener() {} });
      assert.deepEqual(heads.map((each) => each.style.minHeight), ["120px", "120px"]);
      assert.deepEqual(rows.map((each) => each.map((row) => row.style.minHeight)), [["50px", "60px"], ["50px", "60px"]]);
    });

    describe("the names it shows", () => {
      const home = () => put(tmp, `${UI}/screens/home.md`, record(["id: home", "kind: screen", "status: proposed", "version: 1", "wireframe: home", "states: [default]"], "# L\u2019\u00e9cran d\u2019accueil"));
      const NAME = "L\u2019\u00e9cran d\u2019accueil";

      it("titles a set by the title of the record it is about, on its page, in the navigation, in the panel and on the home page", () => {
        home();
        const pages = pagesOf([SET({ id: "home" })]);
        assert.match(pages["_set-home.html"], new RegExp(`<h1>${NAME}</h1>`));
        assert.match(pages["_set-home.html"], new RegExp(`<title>${NAME}`));
        assert.match(groupOf(pages["_set-home.html"], "choose"), new RegExp(`aria-current="page">${NAME}</a>`));
        assert.match(pages["index.html"], new RegExp(`<summary><span>${NAME}</span><span class="picked"`));
        assert.match(pages["index.html"], new RegExp(`<a href="_set-home.html">${NAME}</a>`));
      });

      it("falls back to the id as words for a set about no record", () => {
        const pages = pagesOf([SET({ id: "new-tool" })]);
        assert.match(pages["_set-new-tool.html"], /<h1>New tool<\/h1>/);
        assert.match(groupOf(pages["index.html"], "choose"), />New tool<\/a>/);
      });

      it("never shows the path of a file: a document by its own heading, a render by the heading of the record beside it", () => {
        const withRender = (name) => variant(name, name, [file("swatches.md", SECTIONS(name)), file("swatches.html", "<html><head></head><body><p>x</p></body></html>")]);
        const html = pagesOf([SET({ variants: [withRender("a"), withRender("b")] })])["_set-layout.html"];
        assert.doesNotMatch(html.replace(/data-[a-z-]+="[^"]*"|srcdoc="[^"]*"|title="[^"]*"/g, ""), /swatches\.(md|html)/);
        const [a] = columnsOf(html);
        assert.match(a.html, /<h3>Brand of a<\/h3>/);
        assert.match(a.html, /<div class="file rendering"[^>]*><h3>Brand of a<\/h3>/);
      });
    });

    it("titles the set page with its name as words", () => {
      assert.match(pagesOf([SET({ id: "brand-colours" })])["_set-brand-colours.html"], /<h1>Brand colours<\/h1>/);
    });

    it("leaves room under the content for the floating review button on a set page", () => {
      const style = require(path.join(LIB, "variants.cjs")).STYLE;
      assert.match(style, /main\.wide \{[^}]*padding-bottom/);
    });

    it("sizes the frame to the render it holds and centres it in a column wider than the render", () => {
      const { SCRIPT } = require(path.join(LIB, "variants.cjs"));
      const box = (width, height) => ({ dataset: { width: String(width), height: String(height) }, parentElement: { clientWidth: 500 }, clientWidth: 500, firstElementChild: { style: {} }, style: {} });
      const frames = [box(390, 844), box(1280, 800)];
      new Function("document", "window", SCRIPT)({ querySelectorAll: (selector) => (selector === ".fit" ? frames : []), querySelector: () => ({}), getElementById: () => null }, { addEventListener() {} });
      assert.equal(frames[0].style.width, "392px", "the mobile frame is its own width, not the column's");
      assert.equal(frames[0].firstElementChild.style.transform, "scale(1)");
      assert.equal(frames[1].firstElementChild.style.transform, "scale(0.390625)");
      assert.match(unescaped(pagesOf([SET()])["_set-layout.html"]), /\.fit \{[^}]*margin-inline: auto/);
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

  describe("the variants on the project's screens", () => {
    const dressed = (axes, files) => SET({ variants: [{ ...variant("a", "calm", files ?? []), axes }, variant("b", "bold", [file("preview.html", "<html><body><p>B</p></body></html>")])] });
    const framesOf = (set) => [...columnsOf(pagesOf([set])["_set-layout.html"])[0].html.matchAll(/srcdoc="([^"]*)"/g)].map((match) => unescaped(match[1]));

    it("dresses a wireframe of the project in the colours and the font a variant gives, in place of its preview", () => {
      const frames = framesOf(dressed([["Palette", "nuit #0b0f14, texte #e8eef3, accent #7fd4f2"], ["Chiffres", "monospace télémétrie"]], [file("preview.html", "<html><body><p>PREVIEW</p></body></html>")]));
      assert.equal(frames.length, 1, "one frame for the variant");
      for (const frame of frames) {
        assert.match(frame, /Results, default/, "the wireframe's own text");
        assert.match(frame, /#0b0f14/);
        assert.match(frame, /#7fd4f2/);
        assert.match(frame, /monospace/);
        assert.doesNotMatch(frame, /PREVIEW/);
      }
    });

    it("falls back to the preview of a variant that gives no readable colour", () => {
      const frames = framesOf(dressed([["Palette", "nuit profonde, accent bleu glacier"]], [file("preview.html", "<html><body><p>PREVIEW</p></body></html>")]));
      for (const frame of frames) {
        assert.match(frame, /PREVIEW/);
        assert.doesNotMatch(frame, /Results, default/);
      }
    });

    describe("the sizes", () => {
      const PALETTE = ["Palette", "#FFF8E7, #1F1A17, #E4572E"];
      const sized = (cell) => dressed([PALETTE, ["Taille", cell]]);
      const two = (a, b) => SET({ variants: [sized(a).variants[0], { ...sized(b).variants[0], name: "b" }] });
      const bodySize = (set, at) => [...columnsOf(pagesOf([set])["_set-layout.html"])[at].html.matchAll(/srcdoc="([^"]*)"/g)].map((match) => /body \{[^}]*font-size: ([\d.]+)px/.exec(unescaped(match[1]))?.[1]);

      it("reads the sizes of a cell in order: text, headings, buttons", () => {
        const [frame] = framesOf(sized("texte 21 px, titres 38 px, boutons 60 px"));
        assert.match(frame, /body \{[^}]*font-size: 21px/);
        assert.match(frame, /h1, h2 \{[^}]*font-size: 38px/);
        assert.match(frame, /button \{[^}]*min-height: 60px/);
      });

      it("reads the buttons as optional", () => {
        const [frame] = framesOf(sized("texte 16 px, titres 28 px"));
        assert.match(frame, /font-size: 28px/);
        assert.doesNotMatch(frame, /min-height/);
      });

      it("gives two variants that differ only by that cell different dressed frames", () => {
        const set = two("texte 16 px, titres 28 px", "texte 21 px, titres 38 px");
        assert.deepEqual([bodySize(set, 0), bodySize(set, 1)], [["16"], ["21"]]);
      });

      it("sets nothing from a cell with fewer than two sizes", () => {
        const [frame] = framesOf(sized("texte 16 px"));
        assert.doesNotMatch(frame, /font-size|min-height/);
      });
    });

    it("says above the frames what the preview shows, in the page language, only when wireframes are dressed", () => {
      const page = (set, lang) => pagesOf([set], { lang })["_set-layout.html"];
      const note = (html) => html.match(/<p class="preview-note">([^<]*)<\/p>/)?.[1];
      const look = dressed([["Palette", "#0b0f14 #e8eef3 #7fd4f2"]]);
      assert.equal(note(page(look, "fr")), LABELS.fr.preview);
      assert.equal(note(page(look, "en")), LABELS.en.preview);
      assert.equal(LABELS.fr.preview, "Les aperçus montrent les couleurs, les lettres et les tailles. La mise en page reste celle des maquettes.");
      assert.ok(page(look, "en").indexOf('class="preview-note"') < page(look, "en").indexOf('class="variants"'), "above the frames");
      assert.equal(note(page(dressed([["Palette", "nuit profonde"]]), "fr")), undefined, "the preview fallback says nothing");
    });

    describe("one screen per column", () => {
      const look = () => dressed([["Palette", "#0b0f14 #e8eef3 #7fd4f2"]]);
      const page = (set = look()) => pagesOf([set])["_set-layout.html"];
      const OTHER = "<!doctype html><html><head></head><body><section data-state=\"default\"><p>Other, default</p></section><section data-state=\"error\"><p>Other, error</p></section></body></html>";

      it("holds one mobile frame per variant, of the first state of the screen only", () => {
        const [column] = columnsOf(page());
        assert.equal((column.html.match(/<iframe/g) ?? []).length, 1, "one frame");
        assert.doesNotMatch(column.html, /data-size="desktop"/);
        assert.match(column.html, /data-size="mobile"/);
        const [frame] = framesOf(look());
        assert.match(frame, /\[data-state\]:not\(\[data-state="default"\]\):not\(\[data-state\] \[data-state\]\) \{ display: none !important; \}/);
        assert.match(frame, /Results, default/);
      });

      it("opens a dressed screen on its own first state, hiding no state of a component inside it", () => {
        put(tmp, `${UI}/wireframes/search-flow.html`, "<html><head></head><body><section data-state=\"empty\"><div data-state=\"default\">C</div></section><section data-state=\"error\">E</section></body></html>");
        const [frame] = framesOf(look());
        assert.match(frame, /\[data-state\]:not\(\[data-state="empty"\]\):not\(\[data-state\] \[data-state\]\) \{ display: none !important; \}/);
      });

      it("opens a dressed screen on its default even when another state comes first", () => {
        put(tmp, `${UI}/wireframes/search-flow.html`, "<html><head></head><body><section data-state=\"empty\">E</section><section data-state=\"default\">D</section></body></html>");
        const [frame] = framesOf(look());
        assert.match(frame, /\[data-state\]:not\(\[data-state="default"\]\)/);
      });

      it("opens on the first state of a screen that has no default", () => {
        put(tmp, `${UI}/wireframes/search-flow.html`, "<html><head></head><body><section data-state=\"results\">R</section><section data-state=\"error\">E</section></body></html>");
        const [frame] = framesOf(look());
        assert.match(frame, /\[data-state\]:not\(\[data-state="results"\]\)/);
      });

      it("lists the dressed wireframes in one select above the columns and holds each screen's document for the switch", () => {
        put(tmp, `${UI}/wireframes/other.html`, OTHER);
        const html = page();
        const select = html.match(/<select id="screen-pick"[^>]*>([\s\S]*?)<\/select>/);
        assert.ok(select, "a select of the screens");
        assert.deepEqual([...select[1].matchAll(/<option value="([^"]+)"/g)].map((match) => match[1]), ["other.html", "search-flow.html"]);
        assert.ok(html.indexOf('id="screen-pick"') < html.indexOf('class="variants"'), "above the columns");
        const [column] = columnsOf(html);
        assert.deepEqual([...column.html.matchAll(/<template class="screen-doc" data-path="([^"]+)"/g)].map((match) => match[1]), ["other.html", "search-flow.html"]);
        assert.match(html, /getElementById\("screen-pick"\)/);
      });

      it("names each screen in the select by its record's title, its file name as words when it has none", () => {
        put(tmp, `${UI}/wireframes/other.html`, OTHER);
        const select = page().match(/<select id="screen-pick"[^>]*>([\s\S]*?)<\/select>/)[1];
        assert.deepEqual([...select.matchAll(/<option [^>]*>([^<]*)<\/option>/g)].map((match) => match[1]), ["Other", "Search flow"]);
      });

      it("lets an axis cell grow to its content, over the shell's fixed button height", () => {
        const take = require(path.join(LIB, "variants.cjs")).STYLE.match(/\.take \{[^}]*\}/)[0];
        assert.match(take, /height: auto/);
      });

      it("has no select when the preview is the fallback", () => {
        assert.doesNotMatch(page(dressed([["Palette", "nuit profonde"]], [file("preview.html", "<html><body>P</body></html>")])), /id="screen-pick"/);
      });
    });

    it("keeps the structure of the wireframe as written", () => {
      const [frame] = framesOf(dressed([["Palette", "#0b0f14 #e8eef3 #7fd4f2"]]));
      assert.match(frame, /<div data-zone="query">Query<\/div>/);
    });
  });

  describe("the review drawer", () => {
    const startOf = (html) => /<aside class="drawer" id="review"([^>]*)>/.exec(html)[1];

    it("starts closed on every page, whatever it was left at, and only the button opens it", () => {
      const pages = pagesOf([SET()]);
      for (const name of ["_set-layout.html", "index.html", "home.html"]) {
        assert.doesNotMatch(startOf(pages[name]), /data-start/, name);
        assert.doesNotMatch(pages[name], /STORE \+ "-open"/, `${name} reads no memory of an open drawer`);
        assert.match(startOf(pages[name]), / hidden$/, name);
      }
    });
  });

  describe("the name of a variant", () => {
    it("reads as words in its column title, the slug kept in the data, the drawer and the choice", () => {
      const set = SET();
      set.variants[0].name = "affiche-de-quartier";
      const html = pagesOf([set])["_set-layout.html"];
      assert.match(html, /<section class="variant" data-variant="affiche-de-quartier"><header class="column-head"><h2>Affiche de quartier<\/h2>/);
      assert.match(html, /data-variant="affiche-de-quartier" aria-pressed="false"/);
      assert.match(html, /<li class="pvariant" data-variant="affiche-de-quartier" data-label="Affiche de quartier"><span class="pick">Affiche de quartier<\/span>/);
    });
  });

  describe("the full text of a variant", () => {
    it("sits in a details closed by default, labelled in the language, each markdown file inside it", () => {
      for (const lang of ["en", "fr"]) {
        const [column] = columnsOf(pagesOf([SET()], { lang })["_set-layout.html"]);
        const details = column.html.match(/<details class="fulltext"([^>]*)><summary>([^<]*)<\/summary>([\s\S]*?)<\/details>/);
        assert.ok(details, "a details of the full text");
        assert.doesNotMatch(details[1], /open/);
        assert.equal(details[2], LABELS[lang].full);
        assert.match(details[3], /<div class="file" data-path="brand\.md">/);
        assert.doesNotMatch(column.html.replace(details[0], ""), /data-path="brand\.md"/, "nowhere else");
      }
      assert.deepEqual([LABELS.en.full, LABELS.fr.full], ["Full text", "Texte complet de la piste"]);
    });
  });

  describe("the large view of a screen", () => {
    const look = () => SET({ variants: [{ ...variant("a", "calm", []), axes: [["Palette", "#0b0f14 #e8eef3 #7fd4f2"]] }, { ...variant("b", "bold", []), axes: [["Palette", "#ffffff #111111 #cc0000"]] }] });

    it("opens from a button of each column in a dialog with previous and next, in the language", () => {
      for (const lang of ["en", "fr"]) {
        const html = pagesOf([look()], { lang })["_set-layout.html"];
        const dialog = html.match(/<dialog id="large"[^>]*>([\s\S]*?)<\/dialog>/);
        assert.ok(dialog, "the dialog");
        assert.match(dialog[1], new RegExp(`<button type="button" data-step="-1"[^>]*>${LABELS[lang].previousVariant}</button>`));
        assert.match(dialog[1], new RegExp(`<button type="button" data-step="1"[^>]*>${LABELS[lang].nextVariant}</button>`));
        assert.match(dialog[1], /<iframe/);
        assert.deepEqual(columnsOf(html).map((column) => column.html.match(new RegExp(`<button type="button" class="large" data-variant="[^"]+">${LABELS[lang].large}</button>`))?.length), [1, 1]);
      }
      assert.deepEqual([LABELS.en.large, LABELS.fr.large], ["View large", "Voir en grand"]);
    });

    it("gives the dialog its script: modal, desktop width, scaled to the window, stepping across the columns of the round", () => {
      const html = pagesOf([look()])["_set-layout.html"];
      assert.match(html, /showModal\(\)/);
      assert.match(html, /1280/);
    });

    it("has neither dialog nor button when no variant has a screen or a render", () => {
      const set = SET({ variants: [variant("a", "calm", [file("brand.md", SECTIONS("calm"))]), variant("b", "bold", [file("brand.md", SECTIONS("bold"))])] });
      const html = pagesOf([set])["_set-layout.html"];
      assert.doesNotMatch(html, /<dialog/);
      assert.doesNotMatch(html, /class="large"/);
    });
  });

  describe("the comparison of renders", () => {
    const { SCRIPT } = require(path.join(LIB, "variants.cjs"));
    const states = (names) => `<html><head></head><body>${names.map((name) => `<section data-state="${name}"><p>shows ${name}</p></section>`).join("")}</body></html>`;
    const compared = (a, b) => SET({ variants: [variant("a", "calm", [file("preview.html", a)]), variant("b", "bold", [file("preview.html", b)])] });
    const barOf = (html) => html.match(/<div class="compare tabs"[^>]*>[\s\S]*?<\/div><\/div>/)?.[0];
    const stateButtons = (bar) => [...bar.matchAll(/<button type="button" class="tab" data-show-state="([^"]*)" aria-pressed="(\w+)">([^<]*)<\/button>/g)].map((match) => [match[1], match[2], match[3]]);
    const sizeButtons = (bar) => [...bar.matchAll(/<button type="button" class="tab" data-show-size="(\w+)" data-width="(\d+)" aria-pressed="(\w+)">([^<]*)<\/button>/g)].map((match) => [match[1], match[2], match[3], match[4]]);

    it("puts one bar above the columns, its state tabs the union of the states of the renders in first-seen order, the first selected", () => {
      const html = pagesOf([compared(states(["default", "empty", "loading"]), states(["default", "error", "empty"]))], { lang: "en" })["_set-layout.html"];
      assert.equal([...html.matchAll(/class="compare tabs"/g)].length, 1);
      assert.ok(html.indexOf('class="compare tabs"') < html.indexOf('class="variants"'), "above the columns");
      assert.deepEqual(stateButtons(barOf(html)), [["default", "true", "default"], ["empty", "false", "empty"], ["loading", "false", "loading"], ["error", "false", "error"]]);
    });

    it("puts the default state first and selected, the others as first seen", () => {
      const html = pagesOf([compared(states(["empty", "default", "error"]), states(["loading", "empty"]))], { lang: "en" })["_set-layout.html"];
      assert.deepEqual(stateButtons(barOf(html)), [["default", "true", "default"], ["empty", "false", "empty"], ["error", "false", "error"], ["loading", "false", "loading"]]);
      const apart = pagesOf([compared(states(["empty"]), states(["error", "default"]))], { lang: "en" })["_set-layout.html"];
      assert.deepEqual(stateButtons(barOf(apart)).map((tab) => tab[0]), ["default", "empty", "error"]);
      const without = pagesOf([compared(states(["empty", "error"]), states(["error"]))], { lang: "en" })["_set-layout.html"];
      assert.deepEqual(stateButtons(barOf(without)), [["empty", "true", "empty"], ["error", "false", "error"]]);
    });

    it("lists only the states of the screen itself, never those of the components inside it", () => {
      const nested = `<html><head></head><body><section data-state="default"><div data-state="empty"><p>photo</p></div></section><section data-state="error"><label data-state="error">champ</label><div data-state="loading"></div></section></body></html>`;
      const html = pagesOf([compared(nested, nested)], { lang: "en" })["_set-layout.html"];
      assert.deepEqual(stateButtons(barOf(html)).map((tab) => tab[0]), ["default", "error"]);
      assert.match(html, /class="file rendering"[^>]*data-states="default error"/);
    });

    it("names a state in the language of the page, as the record pages do", () => {
      const html = pagesOf([compared(states(["default", "error"]), states(["default"]))], { lang: "fr" })["_set-layout.html"];
      assert.deepEqual(stateButtons(barOf(html)).map((tab) => tab[2]), ["par défaut", "erreur"]);
    });

    it("offers the sizes as Mobile then Ordinateur, mobile selected, in the language", () => {
      for (const lang of ["en", "fr"]) {
        const html = pagesOf([compared(states(["default"]), states(["default"]))], { lang })["_set-layout.html"];
        assert.deepEqual(sizeButtons(barOf(html)), [["mobile", "390", "true", LABELS[lang].mobile], ["desktop", "1280", "false", LABELS[lang].desktop]]);
      }
    });

    it("hides the state tabs when the renders show a single state or none, and keeps the sizes", () => {
      const one = barOf(pagesOf([compared(states(["default"]), "<html><body><p>B</p></body></html>")])["_set-layout.html"]);
      const none = barOf(pagesOf([SET()])["_set-layout.html"]);
      for (const bar of [one, none]) {
        assert.deepEqual(stateButtons(bar), []);
        assert.equal(sizeButtons(bar).length, 2);
      }
    });

    it("has no bar when no variant has a render", () => {
      const set = SET({ variants: [variant("a", "calm", [file("brand.md", SECTIONS("calm"))]), variant("b", "bold", [file("brand.md", SECTIONS("bold"))])] });
      assert.doesNotMatch(pagesOf([set])["_set-layout.html"], /class="compare tabs"/);
    });

    it("renders each html once, in a mobile frame, whole, with the states it holds named for the script", () => {
      const html = pagesOf([compared(states(["default", "empty"]), "<html><body><p>B</p></body></html>")])["_set-layout.html"];
      const [a, b] = columnsOf(html);
      assert.equal([...a.html.matchAll(/<div class="fit"/g)].length, 1);
      assert.match(a.html, /<div class="fit" data-size="mobile" data-width="390"/);
      assert.doesNotMatch(a.html, /data-size="desktop"/);
      assert.match(unescaped(a.html), /shows default[\s\S]*shows empty/);
      assert.match(a.html, /class="file rendering"[^>]*data-states="default empty"/);
      assert.doesNotMatch(b.html, /data-states/);
    });

    it("says of a render that lacks the chosen state that it has none, in a note kept hidden until then", () => {
      for (const lang of ["en", "fr"]) {
        const [a] = columnsOf(pagesOf([compared(states(["default"]), states(["default", "error"]))], { lang })["_set-layout.html"]);
        assert.match(a.html, new RegExp(`<p class="no-state" hidden>${LABELS[lang].noState}</p>`));
      }
    });

    it("has a size label and a missing-state label in both languages", () => {
      assert.deepEqual([LABELS.en.size, LABELS.fr.size], ["Size", "Taille"]);
      assert.ok(LABELS.en.noState && LABELS.fr.noState);
    });

    it("gives a render column the button to open it large, with the dialog", () => {
      const html = pagesOf([compared(states(["default"]), states(["default"]))])["_set-layout.html"];
      assert.match(html, /<dialog id="large"/);
      assert.deepEqual(columnsOf(html).map((column) => [...column.html.matchAll(/<button type="button" class="large"/g)].length), [1, 1]);
    });

    describe("the script", () => {
      const listener = () => {
        const handlers = {};
        return { handlers, addEventListener: (type, handler) => { handlers[type] = handler; } };
      };
      const button = (dataset, group) => ({ ...listener(), dataset, attributes: {}, parentElement: group, setAttribute(name, value) { this.attributes[name] = value; } });
      const rig = ({ rendered }) => {
        const group = (items) => ({ children: items });
        const stateGroup = group([]);
        const sizeGroup = group([]);
        const tabs = ["default", "empty"].map((name) => button({ showState: name }, stateGroup));
        const sizes = [button({ showSize: "mobile", width: "390" }, sizeGroup), button({ showSize: "desktop", width: "1280" }, sizeGroup)];
        stateGroup.children.push(...tabs);
        sizeGroup.children.push(...sizes);
        const holders = rendered.map(({ listed, height }) => {
          const doc = { style: null, getElementById: () => doc.style, createElement: () => ({}), head: { append(style) { doc.style = style; } }, documentElement: { getBoundingClientRect: () => ({ height }) } };
          const frame = { ...listener(), style: {}, contentDocument: doc };
          const box = { dataset: { width: "390", height: "844" }, parentElement: { clientWidth: 500 }, clientWidth: 500, firstElementChild: frame, style: {}, hidden: false };
          const note = { hidden: true };
          return { dataset: listed ? { states: listed } : {}, box, note, frame, doc, querySelector: (selector) => (selector === ".fit" ? box : note) };
        });
        const round = { querySelectorAll: (selector) => (selector === ".rendering" ? holders : selector === ".rendering iframe" ? holders.map((holder) => holder.frame) : []) };
        const bar = { dataset: { state: "default", width: "390" }, nextElementSibling: round, querySelectorAll: () => [...tabs, ...sizes] };
        const boxes = holders.map((holder) => holder.box);
        const all = (selector) => (selector === ".compare" ? [bar] : selector === ".fit" ? boxes : []);
        new Function("document", "window", SCRIPT)({ querySelectorAll: all, querySelector: () => null, getElementById: () => null }, { addEventListener() {} });
        return { bar, tabs, sizes, holders };
      };

      it("shows the first state, then only the state a tab selects, in every frame", () => {
        const { tabs, holders } = rig({ rendered: [{ listed: "default empty", height: 600 }, { listed: "default empty", height: 300 }] });
        for (const holder of holders) assert.match(holder.doc.style.textContent, /\[data-state\]:not\(\[data-state="default"\]\):not\(\[data-state\] \[data-state\]\) \{ display: none !important; \}/);
        tabs[1].handlers.click();
        for (const holder of holders) assert.match(holder.doc.style.textContent, /:not\(\[data-state="empty"\]\)/);
        assert.deepEqual(tabs.map((tab) => tab.attributes["aria-pressed"]), ["false", "true"]);
      });

      it("shows a render without states whole, and says so of a render that lacks the chosen state", () => {
        const { tabs, holders } = rig({ rendered: [{ listed: "", height: 600 }, { listed: "default", height: 300 }] });
        tabs[1].handlers.click();
        assert.equal(holders[0].doc.style.textContent, '[data-state]:not([data-state="empty"]):not([data-state] [data-state]) { display: none !important; }');
        assert.deepEqual([holders[0].box.hidden, holders[0].note.hidden], [false, true]);
        assert.deepEqual([holders[1].box.hidden, holders[1].note.hidden], [true, false]);
        tabs[0].handlers.click();
        assert.deepEqual([holders[1].box.hidden, holders[1].note.hidden], [false, true]);
      });

      it("opens a render large at desktop width showing the state selected in the bar", () => {
        const doc = { style: null, getElementById: () => doc.style, createElement: () => ({}), head: { append(style) { doc.style = style; } } };
        const shown = { style: {}, srcdoc: "", contentDocument: doc };
        const dialog = { dataset: { width: "1280", height: "800" }, showModal() { this.opened = true; }, querySelector: (selector) => (selector === "iframe" ? shown : { style: {} }), querySelectorAll: () => [] };
        const bar = { classList: { contains: (name) => name === "compare" }, dataset: { state: "empty" } };
        const column = { querySelector: (selector) => (selector === ".rendering iframe" ? { srcdoc: "RENDER" } : selector === "h2" ? { textContent: "A" } : null), closest: () => ({ previousElementSibling: bar, querySelectorAll: () => [column] }) };
        const opener = { ...listener(), closest: () => column };
        const elements = { large: dialog, "large-title": {}, "large-close": listener() };
        const all = (selector) => (selector === "button.large" ? [opener] : []);
        new Function("document", "window", SCRIPT)({ querySelectorAll: all, querySelector: () => null, getElementById: (id) => elements[id] ?? null }, { addEventListener() {}, innerWidth: 1000, innerHeight: 800 });
        opener.handlers.click();
        assert.equal(shown.srcdoc, "RENDER");
        assert.equal(shown.style.width, "1280px");
        assert.equal(dialog.opened, true);
        shown.onload();
        assert.match(doc.style.textContent, /:not\(\[data-state="empty"\]\)/);
      });

      it("fits each frame to the height of its content times the scale, never upscaled, again when the size changes", () => {
        const { sizes, holders } = rig({ rendered: [{ listed: "default", height: 600 }] });
        const [{ box, frame }] = holders;
        assert.equal(frame.style.height, "600px");
        assert.equal(box.firstElementChild.style.transform, "scale(1)");
        assert.equal(box.style.height, "600px");
        sizes[1].handlers.click();
        assert.equal(box.dataset.width, "1280");
        assert.equal(frame.style.width, "1280px");
        assert.equal(frame.style.transform, "scale(0.390625)");
        assert.equal(box.style.height, String(Math.ceil(600 * 0.390625)) + "px");
        assert.deepEqual(sizes.map((size) => size.attributes["aria-pressed"]), ["false", "true"]);
      });
    });
  });

  describe("the rows that do not differ", () => {
    const rowsOf = (html) => [...html.matchAll(/<tr([^>]*)><th>([\s\S]*?)<\/th>/g)].map((match) => ({ same: /data-same/.test(match[1]), head: match[2] }));
    const two = (a, b) => SET({ variants: [{ ...variant("a", "calm", []), axes: [["Tone", a[0]], ["Density", a[1]]] }, { ...variant("b", "bold", []), axes: [["Tone", b[0]], ["Density", b[1]]] }] });

    it("marks a row identical in every variant of the round with data-same and a word, and leaves the others alone", () => {
      for (const lang of ["en", "fr"]) {
        const html = pagesOf([two(["calm", "roomy"], ["bold", " Roomy "])], { lang })["_set-layout.html"];
        for (const column of columnsOf(html)) {
          const [tone, density] = rowsOf(column.html);
          assert.equal(tone.same, false);
          assert.doesNotMatch(tone.head, /same-tag/);
          assert.equal(density.same, true);
          assert.match(density.head, new RegExp(`<small class="same-tag">${LABELS[lang].identical}</small>`));
        }
      }
      assert.deepEqual([LABELS.en.identical, LABELS.fr.identical], ["same", "identique"]);
    });

    it("offers no take button on a row identical in every variant, only its value", () => {
      const html = pagesOf([two(["calm", "roomy"], ["bold", " Roomy "])])["_set-layout.html"];
      for (const column of columnsOf(html)) {
        const [tone, density] = [...column.html.matchAll(/<tr[^>]*>[\s\S]*?<\/tr>/g)].map((match) => match[0]);
        assert.match(tone, /class="take"/);
        assert.doesNotMatch(density, /<button/);
        assert.match(density, /<span class="value">/);
      }
    });

    it("says on each take button, in the language, what a click does", () => {
      for (const lang of ["en", "fr"]) {
        const [column] = columnsOf(pagesOf([two(["calm", "roomy"], ["bold", "tight"])], { lang })["_set-layout.html"]);
        const takes = [...column.html.matchAll(/<button type="button" class="take"[^>]*>[\s\S]*?<\/button>/g)].map((match) => match[0]);
        assert.equal(takes.length, 2);
        for (const take of takes) assert.match(take, new RegExp(`<span class="take-cta">${LABELS[lang].take}</span></button>$`));
      }
      assert.deepEqual([LABELS.en.take, LABELS.fr.take], ["Take", "Prendre"]);
    });

    it("shows no caption over a frame, and no file title that only repeats the title of the page", () => {
      const set = SET();
      for (const each of set.variants) each.files = [file("layout.html", "<html><head></head><body>L</body></html>"), file("preview.html", "<html><head></head><body>P</body></html>")];
      const html = pagesOf([set])["_set-layout.html"];
      assert.doesNotMatch(html, /<figcaption/);
      const [column] = columnsOf(html);
      assert.doesNotMatch(column.html, /<h3>Layout<\/h3>/);
      assert.match(column.html, /<h3>Preview<\/h3>/);
    });

    it("compares within the round of the column, not across rounds", () => {
      const set = two(["calm", "roomy"], ["bold", "tight"]);
      set.variants.push({ ...variant("c", "calm", []), round: 2, axes: [["Tone", "calm"], ["Density", "roomy"]] }, { ...variant("d", "calm", []), round: 2, axes: [["Tone", "calm"], ["Density", "wide"]] });
      const columns = columnsOf(pagesOf([set])["_set-layout.html"]);
      assert.deepEqual(columns.map((column) => rowsOf(column.html).map((row) => row.same)), [[false, false], [false, false], [true, false], [true, false]]);
    });
  });

  describe("the words", () => {
    it("are the same keys in both languages, plain in French", () => {
      for (const key of ["choose", "desktop", "mobile", "same", "keep", "discard"]) assert.ok(LABELS.en[key] && LABELS.fr[key], key);
      assert.equal(LABELS.fr.choose, "Variantes");
      assert.deepEqual([LABELS.fr.desktop, LABELS.fr.mobile, LABELS.fr.keep, LABELS.fr.revise, LABELS.fr.discard], ["Ordinateur", "Mobile", "Garder", "À revoir", "Écarter"]);
      assert.equal(LABELS.fr.same, "Identique dans toutes : {sections}");
      assert.deepEqual(Object.keys(LABELS.fr).sort(), Object.keys(LABELS.en).sort());
    });
  });

  describe("the swatches", () => {
    const cellsOf = (axes) => {
      const set = SET();
      set.variants[0].axes = axes;
      return [...columnsOf(pagesOf([set])["_set-layout.html"])[0].html.matchAll(/<td><button[^>]*>([\s\S]*?)<\/button><\/td>/g)].map((match) => match[1]);
    };

    it("turns each colour of an axis cell into a swatch and its code, the rest stays text", () => {
      const [cell] = cellsOf([["Colours", "ink #1A2b3C on #fff0e6, plain"]]);
      assert.equal((cell.match(/class="swatch"/g) ?? []).length, 2);
      assert.match(cell, /<i class="swatch" style="background: #1A2b3C"><\/i><code>#1A2b3C<\/code>/);
      assert.match(cell, /<i class="swatch" style="background: #fff0e6"><\/i><code>#fff0e6<\/code>/);
      assert.match(cell, /^ink .* on .*, plain<span class="sample"/);
    });

    it("drops the bare commas between swatches, keeps the words", () => {
      const [cell] = cellsOf([["Colours", "#111111, #222222 ; #333333"]]);
      assert.match(cell, /<\/span><span class="tone">[^]*<\/span><span class="tone">/);
      assert.doesNotMatch(cell.replace(/<span class="sample"[^]*$/, ""), /<\/span>[,; ]+<span/);
    });

    it("dims only the name of an identical row, never its swatches", () => {
      const style = require(path.join(LIB, "variants.cjs")).STYLE;
      assert.match(style, /\.axes tr\[data-same\] th \{[^}]*opacity/);
      assert.doesNotMatch(style, /\.axes tr\[data-same\] \{[^}]*opacity/);
    });

    it("leaves a cell without colour as escaped text", () => {
      assert.deepEqual(cellsOf([["Tone", "<b>calm</b> #12345"]]), ["&lt;b&gt;calm&lt;/b&gt; #12345<span class=\"take-cta\">Take</span>"]);
    });
  });

  describe("the style tile", () => {
    const rowsOf = (axes, lang = "en") => {
      const set = SET();
      set.variants[0].axes = axes;
      return [...columnsOf(pagesOf([set], { lang })["_set-layout.html"])[0].html.matchAll(/<tr[^>]*><th>([\s\S]*?)<\/th><td[^>]*>(<button[^>]*>[\s\S]*?<\/button>)<\/td><\/tr>/g)].map((match) => match[2]);
    };

    it("keeps one take button per axis row, with its axis, its variant and its pressed state", () => {
      const rows = rowsOf([["Palette", "#0b0f14 #e8eef3 #7fd4f2"], ["Lettres", "monospace"], ["Ton", "calme"]]);
      assert.equal(rows.length, 3);
      for (const row of rows) assert.match(row, /^<button type="button" class="take" data-axis="[^"]+" data-variant="a" aria-pressed="false">/);
    });

    it("shows a type cell as a heading and a body line in its font, at the sizes of the size cell", () => {
      const [, type] = rowsOf([["Palette", "#0b0f14 #e8eef3 #7fd4f2"], ["Lettres", "Mono, monospace"], ["Taille", "texte 17 px, titres 31 px"]]);
      assert.match(type, /<span class="specimen" style="font-family: 'Mono', ui-monospace, monospace">/);
      assert.match(type, /<b style="font-size: 31px">Heading<\/b>/);
      assert.match(type, /<span style="font-size: 17px">[^<]+<\/span>/);
      assert.match(rowsOf([["Lettres", "serif"]], "fr")[0], /<b>Titre<\/b>/);
    });

    it("shows a type cell at the browser sizes when there is no size cell, and a cell of text as text", () => {
      const [type, text] = rowsOf([["Lettres", "sans-serif"], ["Ton", "calme"]]);
      assert.match(type, /<span class="specimen" style="font-family: system-ui, sans-serif"><b>Heading<\/b><span>/);
      assert.match(text, />calme<span class="take-cta">Take<\/span><\/button>$/);
      assert.doesNotMatch(text, /specimen/);
    });

    it("names the font a cell gives before its generic family, first in the specimen and the dressed screens", () => {
      const fonts = (cell) => rowsOf([["Lettres", cell]])[0].match(/class="specimen" style="font-family: ([^"]*)"/)[1];
      assert.equal(fonts("Nunito, sans-serif"), "'Nunito', system-ui, sans-serif");
      assert.equal(fonts("Bitter serif"), "'Bitter', Georgia, serif");
      assert.equal(fonts("Source Sans 3, sans-serif"), "'Source Sans 3', system-ui, sans-serif");
      assert.equal(fonts("lettres rondes, sans-serif"), "system-ui, sans-serif");
      const set = SET({ variants: [{ ...variant("a", "calm", []), axes: [["Palette", "#0b0f14 #e8eef3 #7fd4f2"], ["Lettres", "Nunito, sans-serif"]] }, variant("b", "bold", [])] });
      const [frame] = [...columnsOf(pagesOf([set])["_set-layout.html"])[0].html.matchAll(/srcdoc="([^"]*)"/g)].map((match) => unescaped(match[1]));
      assert.match(frame, /font-family: 'Nunito', system-ui, sans-serif;/);
    });

    it("puts each axis name above its value, so the value takes the column's width", () => {
      const style = require(path.join(LIB, "variants.cjs")).STYLE;
      assert.match(style, /\.axes th, \.axes td \{[^}]*display: block/);
    });

    it("shows the colours as large swatches with their code under, and a sample button in the accent", () => {
      const [palette] = rowsOf([["Palette", "#0b0f14 #e8eef3 #7fd4f2"]]);
      assert.equal((palette.match(/<span class="tone"><i class="swatch" style="background: #[0-9a-f]{6}"><\/i><code>#[0-9a-f]{6}<\/code><\/span>/g) ?? []).length, 3);
      assert.match(palette, /<span class="sample" style="background: #7fd4f2; color: #0b0f14">Sample button<\/span>/);
    });
  });

  describe("the verdicts in the column", () => {
    const head = (column) => column.match(/<header class="column-head">[\s\S]*?<\/header>/)?.[0];

    it("heads each column with its name, its intent and Keep, Revise, Discard, in the page language", () => {
      for (const [lang, words] of [["en", ["Keep", "Revise", "Discard"]], ["fr", ["Garder", "À revoir", "Écarter"]]]) {
        const [a] = columnsOf(pagesOf([SET()], { lang })["_set-layout.html"]);
        const top = head(a.html);
        assert.ok(top, "a header");
        assert.match(top, /<h2>A<\/h2>/);
        assert.match(top, /Intent of a/);
      assert.match(top, /<textarea class="colcomment"[^>]* hidden>/);
        assert.deepEqual([...top.matchAll(/class="colvote" data-verdict="(\w+)" data-variant="a" aria-pressed="false">([^<]+)</g)].map((match) => [match[1], match[2]]), [["keep", words[0]], ["revise", words[1]], ["discard", words[2]]]);
      }
    });

    it("keeps the header in view while the column scrolls", () => {
      assert.match(pagesOf([SET()])["_set-layout.html"], /\.column-head \{[^}]*position: sticky/);
    });

    it("offers the verdicts on the columns of the latest round only", () => {
      const old = variant("old", "calm", [file("brand.md", SECTIONS("calm"))]);
      const html = pagesOf([SET({ variants: [{ ...old, round: 1 }, { ...variant("new", "bold", [file("brand.md", SECTIONS("bold"))]), round: 2, parent: "old" }] })])["_set-layout.html"];
      const [first, second] = columnsOf(html);
      assert.doesNotMatch(first.html, /colvote/);
      assert.match(second.html, /colvote/);
    });

    describe("in the page", () => {
      const element = (dataset = {}, own = {}) => {
        const node = { dataset, hidden: false, value: "", disabled: false, textContent: "", attrs: {}, listeners: {}, below: {}, ...own };
        node.addEventListener = (type, listener) => { node.listeners[type] = listener; };
        node.setAttribute = (name, value) => { node.attrs[name] = value; };
        node.getAttribute = (name) => node.attrs[name];
        node.removeAttribute = () => {};
        node.focus = () => { node.focused = true; };
        node.remove = () => {};
        node.classList = { toggle() {}, add() {}, remove() {} };
        node.querySelectorAll = (selector) => node.below[selector] ?? [];
        node.querySelector = (selector) => (node.below[selector] ?? [])[0] ?? null;
        return node;
      };
      // The page as the script sees it: a drawer row per variant, a header per column, one copy button.
      const open = ({ past = false } = {}) => {
        const html = pagesOf([SET()])["_set-layout.html"];
        const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
        const rows = ["a", "b"].map((name) => {
          const field = element();
          const votes = ["keep", "revise", "discard"].map((verdict) => element({ verdict }));
          return element({ variant: name }, { below: { ".vote": votes, ".comment": [field] }, field, votes });
        });
        const set = element({ set: "layout", title: "Layout", fingerprint: "f1" }, { below: { "li.pvariant": rows, ".done": [element({ label: "chosen" })], ".picked": [element({ axes: "2", label: "picked" })] } });
        const columns = ["a", "b"].map((name) => {
          const votes = ["keep", "revise", "discard"].map((verdict) => element({ verdict, variant: name }));
          const field = element();
          return element({ variant: name }, { below: { ".colvote": votes, ".colcomment": [field] }, votes, field });
        });
        const takes = ["a", "b"].map((name) => element({ axis: "Tone", variant: name }));
        const holder = element({ set: "layout", fingerprint: "f1" }, { below: { ".variant": columns, ".colvote": columns.flatMap((column) => column.votes), ".take": takes } });
        // A folded earlier round holds columns with no verdict and no comment box, under the same set.
        const folded = element({ set: "layout", fingerprint: "f1" }, { below: { ".variant": [element({ variant: "old" })], ".colvote": [] } });
        const holders = past ? [folded, holder] : [holder];
        const list = element({}, { children: [], replaceChildren: (...nodes) => { list.children = nodes; } });
        const by = { scrim: element(), review: element({}, { hidden: true, below: { "details.choice": [set], "details.item": [] } }), "open-review": element(), copy: element({ blocked: "blocked" }), clear: element(), "all-ok": element(), note: element(), "close-review": element(), decisions: element({ copy: "{count} to copy", words: JSON.stringify({ keep: "Keep", revise: "Revise", discard: "Discard", pick: "taken from {variant}" }) }, { below: { ul: [list] } }) };
        const document = { body: { dataset: {} }, createElement: () => element(), addEventListener() {}, getElementById: (id) => by[id] ?? null, querySelectorAll: (selector) => (selector === ".variants[data-set]" ? holders : []), querySelector: () => null };
        const written = [];
        const memory = {};
        const window = { addEventListener() {}, localStorage: { getItem: (key) => memory[key] ?? null, setItem: (key, value) => { memory[key] = value; }, removeItem: (key) => { delete memory[key]; } } };
        const navigator = { clipboard: { writeText: async (content) => { written.push(content); } } };
        new Function("document", "window", "navigator", "setTimeout", script)(document, window, navigator, () => {});
        return { rows, columns, takes, list, by, written };
      };
      const verdictsOf = (text) => JSON.parse(text.replace(/^```json\n|\n```\n$/g, ""))[0].variants.map((each) => [each.name, each.verdict, each.comment]);

      it("carries a verdict set in the column to the copy, and presses it in the drawer's row too", async () => {
        const page = open();
        page.columns[0].votes[0].listeners.click();
        assert.equal(page.columns[0].votes[0].attrs["aria-pressed"], "true");
        assert.equal(page.rows[0].votes[0].attrs["aria-pressed"], "true");
        page.by.copy.listeners.click();
        await new Promise((resolve) => setImmediate(resolve));
        assert.deepEqual(verdictsOf(page.written[0]), [["a", "keep", ""], ["b", null, ""]]);
      });

      it("lists in the drawer a verdict and a pick given in the columns, under the set's title", () => {
        const page = open();
        page.columns[1].votes[0].listeners.click();
        page.takes[0].listeners.click();
        assert.deepEqual(page.list.children.map((line) => line.textContent), ["Layout \u00b7 b \u00b7 Keep", "Layout \u00b7 Tone \u00b7 taken from a"]);
        assert.equal(page.by.decisions.hidden, false);
      });

      it("gives the columns of the latest round their handlers when an earlier round's column has no comment box", () => {
        const page = open({ past: true });
        page.columns[0].votes[1].listeners.click();
        assert.equal(page.columns[0].votes[1].attrs["aria-pressed"], "true");
        assert.equal(page.columns[0].field.hidden, false);
      });

      it("shows a verdict set in the drawer on the column too, and takes it back on a second click", () => {
        const page = open();
        page.rows[1].votes[2].listeners.click();
        assert.equal(page.columns[1].votes[2].attrs["aria-pressed"], "true");
        page.columns[1].votes[2].listeners.click();
        assert.equal(page.columns[1].votes[2].attrs["aria-pressed"], "false");
        assert.equal(page.rows[1].votes[2].attrs["aria-pressed"], "false");
      });

      it("asks the comment of a variant to revise in its column, the drawer left shut over the columns", () => {
        const page = open();
        assert.equal(page.columns[0].field.hidden, true);
        page.columns[0].votes[1].listeners.click();
        assert.equal(page.columns[0].field.hidden, false);
        assert.equal(page.columns[0].field.focused, true);
        assert.equal(page.by.review.hidden, true);
        assert.equal(page.columns[1].field.hidden, true);
      });

      it("keeps the comment typed in the column for the copy and for the drawer's row", async () => {
        const page = open();
        page.columns[0].votes[1].listeners.click();
        page.columns[0].field.value = "less grey";
        page.columns[0].field.listeners.input();
        assert.equal(page.rows[0].field.value, "less grey");
        page.by.copy.listeners.click();
        await new Promise((resolve) => setImmediate(resolve));
        assert.deepEqual(verdictsOf(page.written[0]), [["a", "revise", "less grey"], ["b", null, ""]]);
      });

      it("hides the comment of a column again once its verdict is taken back", () => {
        const page = open();
        page.columns[0].votes[1].listeners.click();
        page.columns[0].votes[1].listeners.click();
        assert.equal(page.columns[0].field.hidden, true);
      });
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
        assert.match(group, /<details class="choice" data-set="layout" data-title="Layout" data-fingerprint="f1" open>/);
        const rows = [...group.matchAll(/<li class="pvariant" data-variant="([^"]+)"[^>]*>([\s\S]*?)<\/li>/g)];
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

    it("holds no row for a set with problems, whose variants cannot be told apart yet", () => {
      const broken = SET({ id: "broken", problems: [{ rule: "D5", message: "x", fix: "y" }], variants: [{ name: undefined, intent: "", axes: [], files: [] }] });
      const pages = pagesOf([SET(), broken]);
      assert.deepEqual([...groupOfSets(pages["index.html"]).matchAll(/data-set="([^"]+)"/g)].map((match) => match[1]), ["layout"]);
      assert.equal(groupOfSets(pagesOf([broken])["index.html"]), undefined);
    });

    it("says the group in French, and carries the pure functions of the copy in every script", () => {
      assert.match(groupOfSets(pagesOf([SET()], { lang: "fr" })["index.html"]), /<h3>Variantes<\/h3>/);
      for (const html of Object.values(pagesOf([SET()]))) {
        const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
        assert.doesNotThrow(() => new Function(script));
        for (const fn of [copiedOf, keptOf, entriesOf, blockedOf, remainingOf, pickedOf]) assert.ok(script.includes(fn.toString()), fn.name);
      }
    });
  });

  describe("the copy of a set", () => {
    const LONE = "```json\n" + JSON.stringify([{ set: "layout", variants: [{ name: "a", verdict: "revise", comment: "calm" }, { name: "b", verdict: null, comment: "" }] }], null, 2) + "\n```\n";
    const decided = { set: "layout", variants: [{ name: "a", verdict: "revise", comment: " calm " }, { name: "b", verdict: null, comment: "" }] };
    const home = { record: "home", version: "1", verdicts: [{ state: "default", verdict: "ok", comment: "" }] };

    it("copies a set alone as a list of one, undecided variants null", () => {
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

    it("marks only the states of the step it is asked for, and none already chosen", () => {
      const two = { records: [{ key: "home@1", step: "screens", states: [{ state: "default", settled: false }, { state: "empty", settled: false }] }, { key: "button@1", step: "components", states: [{ state: "hover", settled: false }] }], sets: [] };
      assert.deepEqual(remainingOf(two, { "home@1": { empty: { verdict: "ok" } } }, "screens"), [{ key: "home@1", state: "default" }]);
      assert.deepEqual(remainingOf(two, {}, "components"), [{ key: "button@1", state: "hover" }]);
      assert.deepEqual(remainingOf(two, {}), [{ key: "home@1", state: "default" }, { key: "home@1", state: "empty" }, { key: "button@1", state: "hover" }]);
    });

    it("copies an entry of exactly a record, a version and verdicts, and leaves out what the drawer no longer lists", () => {
      const listed = { records: [{ key: "home@1", step: "screens", record: "home", version: "1", states: [{ state: "default", settled: false }] }], sets: [] };
      const stored = { "home@1": { default: { verdict: "ok" }, loading: { verdict: "revise", comment: "old" } }, "button@1": { hover: { verdict: "ok" } } };
      const [entry, ...others] = entriesOf(listed, stored);
      assert.deepEqual(Object.keys(entry), ["record", "version", "verdicts"]);
      assert.deepEqual(entry.verdicts, [{ state: "default", verdict: "ok", comment: "" }]);
      assert.deepEqual(others, []);
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

  describe("the picks per axis", () => {
    const plain = { set: "layout", variants: [{ name: "a", verdict: "keep", comment: "" }, { name: "b", verdict: null, comment: "" }] };
    const parsed = (copy) => JSON.parse(copy.replace(/^```json\n|\n```\n$/g, ""));

    it("copies the picks of a set after its variants, and nothing more without a pick", () => {
      assert.deepEqual(parsed(copiedOf([{ ...plain, picks: { Tone: "a", Density: "b" } }])), [{ ...plain, picks: { Tone: "a", Density: "b" } }]);
      assert.equal(copiedOf([{ ...plain, picks: {} }]), copiedOf([plain]));
      assert.doesNotMatch(copiedOf([plain]), /picks/);
    });

    it("copies a set with picks and no verdict yet", () => {
      const copy = copiedOf([{ set: "layout", variants: [{ name: "a", verdict: null, comment: "" }], picks: { Tone: "a" } }]);
      assert.deepEqual(parsed(copy)[0].picks, { Tone: "a" });
    });

    it("reads the picks of a set from its choices, never as a variant", () => {
      const sets = [{ key: "set:layout@f1", set: "layout", variants: ["a", "b"] }];
      const [entry] = entriesOf({ records: [], sets }, { "set:layout@f1": { "@picks": { Tone: "b" } } });
      assert.deepEqual(entry.picks, { Tone: "b" });
      assert.deepEqual(entry.variants.map((each) => each.verdict), [null, null]);
      assert.equal("picks" in entriesOf({ records: [], sets }, {})[0], false);
    });

    it("keeps the last pick of an axis, and takes a pick back when it is made again", () => {
      assert.deepEqual(pickedOf({ Tone: "a" }, "Tone", "b"), { Tone: "b" });
      assert.deepEqual(pickedOf({ Tone: "a", Density: "a" }, "Tone", "a"), { Density: "a" });
      assert.deepEqual(pickedOf(undefined, "Tone", "a"), { Tone: "a" });
    });

    it("makes each cell of an axis a button naming its axis and its variant, inside the set", () => {
      const html = pagesOf([SET()])["_set-layout.html"];
      assert.match(html, /<div class="variants"[^>]* data-set="layout" data-fingerprint="f1"/);
      const [a] = columnsOf(html);
      assert.match(a.html, /<th>Tone<\/th><td><button type="button" class="take" data-axis="Tone" data-variant="a" aria-pressed="false">calm<span class="take-cta">Take<\/span><\/button><\/td>/);
    });

    it("names the counts of a set in the drawer, and shows the picks only once one is made", () => {
      const row = pagesOf([SET()])["index.html"].match(/<details class="choice"[\s\S]*?<\/summary>/)[0];
      assert.match(row, /<span class="picked" data-axes="2" data-label="axes picked" hidden><\/span>/);
      assert.match(row, /<span class="done" data-label="chosen">0\/2 chosen<\/span>/);
      assert.match(pagesOf([SET()], { lang: "fr" })["index.html"], /data-label="axes pris" hidden><\/span><span class="done" data-label="choisies">0\/2 choisies<\/span>/);
    });
  });

  describe("the rounds of a set", () => {
    const round = (name, tone, at, parent) => ({ ...variant(name, tone, [file("preview.html", `<html><body><p>${name}</p></body></html>`)]), round: at, parent: parent ?? null });
    const rounds = () => SET({ variants: [round("a", "calm", 1), round("b", "bold", 1), { ...round("c", "bold", 2, "a"), axes: [["Tone", "bold"], ["Density", "roomy"]] }] });
    const roundsOf = (html) => [...html.matchAll(/<details class="round" data-round="(\d+)"( open)?>/g)].map((match) => [match[1], Boolean(match[2])]);

    it("shows the latest round open and the earlier ones folded", () => {
      assert.deepEqual(roundsOf(pagesOf([rounds()])["_set-layout.html"]), [["1", false], ["2", true]]);
    });

    it("lists in the drawer the variants of the latest round only, so a copy holds no verdict of a folded round", () => {
      const group = pagesOf([rounds()])["index.html"].match(/<section class="choices" data-group="choose">[\s\S]*?<\/section>/)[0];
      assert.deepEqual([...group.matchAll(/<li class="pvariant" data-variant="([^"]+)"/g)].map((match) => match[1]), ["c"]);
      assert.match(group, /<span class="done" data-label="chosen">0\/1 chosen<\/span>/);
    });

    it("shows a set of a single round as it was, with no fold", () => {
      assert.deepEqual(roundsOf(pagesOf([SET()])["_set-layout.html"]), []);
    });

    it("keeps the variants of each round in the fold of their round", () => {
      const html = pagesOf([rounds()])["_set-layout.html"];
      const [first, second] = html.split('<details class="round"').slice(1);
      assert.deepEqual([...first.matchAll(/data-variant="([^"]+)">/g)].map((match) => match[1]).filter((name, at, all) => all.indexOf(name) === at), ["a", "b"]);
      assert.match(second, /<section class="variant" data-variant="c">/);
      assert.doesNotMatch(second, /<section class="variant" data-variant="[ab]">/);
    });

    it("marks the cells that differ from the parent, and only those", () => {
      const [c] = columnsOf(pagesOf([rounds()])["_set-layout.html"]).filter((column) => column.name === "c");
      assert.match(c.html, /<th>Tone<\/th><td data-changed="a"/);
      assert.match(c.html, /<th>Density<\/th><td><button/);
    });

    it("marks nothing on a variant with no parent", () => {
      for (const column of columnsOf(pagesOf([rounds()])["_set-layout.html"]).filter((each) => each.name !== "c")) assert.doesNotMatch(column.html, /data-changed/);
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
