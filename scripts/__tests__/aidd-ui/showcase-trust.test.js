const assert = require("node:assert/strict");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { UI, LIB, makeTmp, removeTmp, writeProject, put, record } = require("../fixtures/aidd-ui/project.js");
const { load } = require(path.join(LIB, "project.cjs"));
const { showcaseOf, decisionsOf, entriesOf } = require(path.join(LIB, "showcase.cjs"));

// The reader trusts what the page counts: one number per step wherever it is shown, one row per screen,
// a set named and counted like a record, a variant named like a person would, a way in to the first step
// with work, and a sidebar that marks one thing at a time.

let tmp;

beforeEach(() => {
  tmp = makeTmp("aidd-ui-showcase-trust-");
  writeProject(tmp);
});

afterEach(() => removeTmp(tmp));

const RENDER = '<html><head></head><body><main data-state="default">x</main></body></html>';
const SCREEN = (id, wireframe) => record([`id: ${id}`, "kind: screen", "status: proposed", "version: 1", ...(wireframe ? [`wireframe: ${wireframe}`] : []), "states: [default]"], `# ${id}`);
const WIREFRAME = (id) => record([`id: ${id}`, "kind: wireframe", "status: proposed", "version: 1", "states: [default]"], `# ${id}`);
const JOURNEY = (id) => record([`id: ${id}`, "kind: journey", "status: proposed", "version: 1"], `# ${id}`, "## Steps\n\n| Screen | Action |\n| --- | --- |\n| home | opens |");

/** Two screens dressing a wireframe each, one wireframe alone, and a journey still proposed, beside the fixture's own screen. */
const crowd = () => {
  for (const [screen, wireframe] of [["start-screen", "start"], ["other-screen", "other"]]) {
    put(tmp, `${UI}/wireframes/${wireframe}.md`, WIREFRAME(wireframe));
    put(tmp, `${UI}/wireframes/${wireframe}.html`, RENDER);
    put(tmp, `${UI}/screens/${screen}.md`, SCREEN(screen, wireframe));
    put(tmp, `${UI}/screens/${screen}.html`, RENDER);
  }
  put(tmp, `${UI}/wireframes/bare.md`, WIREFRAME("bare"));
  put(tmp, `${UI}/wireframes/bare.html`, RENDER);
  put(tmp, `${UI}/journeys/second.md`, JOURNEY("second"));
};

const file = (name, text) => ({ path: name, text });
const variant = (name, tone) => ({ name, intent: `Intent of ${name}`, axes: [["Tone", tone], ["Density", "roomy"]], files: [file("screens/ecran-start.md", "---\nid: ecran-start\nkind: screen\n---\n\n# Start here\n\nText.\n")] });
const SET = (overrides = {}) => ({ id: "ecran-start", rows: [], axes: ["Tone", "Density"], variants: [variant("ami-d-abord", "calm"), variant("envoi-direct", "bold")], problems: [], fingerprint: "f1", ...overrides });
const pagesOf = (sets = [], lang = "en") => showcaseOf({ project: load(tmp), tokens: ":root { --accent: #123456; }\n", captures: new Set(), lang, sets });

const navOf = (html) => html.match(/<nav aria-label="[^"]*">[\s\S]*?<\/nav>/)[0];
const drawerOf = (html) => html.match(/<aside class="drawer" id="review"[\s\S]*?<\/aside>/)[0];
const sidebarCount = (html, step) => Number(navOf(html).match(new RegExp(`<li data-step="${step}" data-todo="\\d+"><details[^>]*><summary>.*?class="step-mark"[^>]*>(\\d+)<`))?.[1]);
const stepperCount = (html, step) => Number(html.match(new RegExp(`<li data-step="${step}" data-state="\\w+"><a href="[^"]*"><span class="no">\\d</span><span class="name">[^<]*</span><span class="state">(\\d+) `))?.[1]);
const listCount = (html, step) => Number(html.match(new RegExp(`<section class="ov-step" data-step="${step}"><h3>[^<]*<span>(\\d+)</span>`))?.[1]);
const drawerCount = (html, step) => Number(drawerOf(html).match(new RegExp(`<details class="step-group" data-step="${step}"[^>]*><summary><span class="step-name">[^<]*</span><span class="step-count">\\((\\d+)\\)`))?.[1]);
const blockOf = (html, step) => html.match(new RegExp(`<section class="ov-step" data-step="${step}">[\\s\\S]*?</section>`))?.[0] ?? "";
const tilesOf = (block) => [...block.matchAll(/<ul class="ovcards[^"]*">[\s\S]*?<\/ul>/g)].map((match) => match[0]).join("");
const rowsIn = (block) => [...block.matchAll(/<li data-(?:id|set)="([^"]+)"/g)].map((match) => match[1]);

describe("aidd-ui showcase trust", () => {
  describe("one count per step", () => {
    it("shows the same number in the sidebar, on the step card, in the overview list and in the drawer", () => {
      crowd();
      const index = pagesOf([SET()])["index.html"];
      for (const step of ["journeys", "components", "screens"]) {
        const counts = [step === "journeys" ? 1 : sidebarCount(index, step), stepperCount(index, step), listCount(index, step), drawerCount(index, step)];
        assert.ok(counts.every((count) => count > 0), `${step} ${counts}`);
        assert.equal(new Set(counts).size, 1, `${step}: sidebar, card, list, drawer = ${counts}`);
      }
      assert.equal(sidebarCount(index, "screens"), 5, "home, two screens, the bare wireframe, the set");
      const mark = navOf(index).match(/<li data-step="journeys"[^>]*><details[^>]*><summary>.*?(<span class="step-mark[^"]*"[^>]*>[^<]*<\/span>)/)[1];
      assert.match(mark, /class="step-mark agree"/, "what awaits agreement is not drawn as a count of states to review");
      assert.match(mark, /aria-label="1 awaiting your agreement"/);
      assert.doesNotMatch(mark, />\d+</);
    });

    it("puts the journeys on the overview as cards and in the drawer, the one awaiting agreement to link and not to review", () => {
      crowd();
      const index = pagesOf()["index.html"];
      assert.deepEqual(rowsIn(blockOf(index, "journeys")), ["onboarding", "second"]);
      assert.match(blockOf(index, "journeys"), /<a class="ovcard" href="second\.html">/);
      const group = drawerOf(index).match(/<details class="step-group" data-step="journeys"[\s\S]*?<\/details>/)[0];
      assert.match(group, /<a href="second\.html">/);
      assert.doesNotMatch(group, /class="item"|class="step-ok"|class="verdict"/);
    });

    it("keeps the review button counting what the drawer can review, not the journeys", () => {
      crowd();
      const index = pagesOf()["index.html"];
      const total = [...navOf(index).matchAll(/data-todo="(\d+)"/g)].reduce((sum, match) => sum + Number(match[1]), 0);
      assert.match(navOf(index), new RegExp(`class="tally pending" data-template="\\{count\\} to review">${total} to review<`));
    });
  });

  describe("one row per screen", () => {
    it("shows a screen and the wireframe it dresses once on the overview, as one card, marked as many as the step counts", () => {
      crowd();
      const block = blockOf(pagesOf()["index.html"], "screens");
      const rows = rowsIn(tilesOf(block));
      assert.deepEqual(rows.sort(), ["bare", "home", "other-screen", "start-screen"]);
      assert.equal((tilesOf(block).match(/class="mark todo"/g) ?? []).length, listCount(pagesOf()["index.html"], "screens"));
    });
  });

  describe("one entry per counted record in the drawer", () => {
    it("lists as many entries as the group counts, a dressed wireframe nested under its screen, its verdict keys unchanged", () => {
      crowd();
      const index = pagesOf()["index.html"];
      const group = drawerOf(index).split('<details class="step-group" data-step="screens"')[1].split('<details class="step-group"')[0];
      const entries = group.split('<div class="entry">').slice(1);
      assert.equal(entries.length, drawerCount(index, "screens"), "group count = number of entries");
      const heads = entries.map((entry) => entry.match(/<details class="item" data-record="([^"]+)" data-version="1"(?![^>]*data-dressed-by)/)?.[1]);
      assert.ok(heads.every(Boolean), "an entry opens with a record the step counts");
      const nested = entries.find((entry) => entry.includes('data-record="start-screen"'));
      assert.match(nested, /data-record="start" data-version="1" data-dressed-by="start-screen"/);
      assert.equal((group.match(/data-dressed-by/g) ?? []).length, 3, "start, other and search-flow stay items with their own key");
    });
  });

  describe("a set of variants", () => {
    it("is titled by the record it writes, in the sidebar, the overview, the drawer and its own page", () => {
      const pages = pagesOf([SET()]);
      for (const name of ["index.html", "_set-ecran-start.html"]) {
        assert.match(navOf(pages[name]), /<li data-set="ecran-start"><a href="_set-ecran-start\.html"[^>]*>Start here<\/a>/, name);
        assert.match(drawerOf(pages[name]), /<details class="choice" data-set="ecran-start" data-title="Start here"/, name);
      }
      assert.match(blockOf(pages["index.html"], "screens"), /<a class="ovcard" href="_set-ecran-start\.html">[\s\S]*?<span class="title">Start here<\/span>/);
      assert.match(pages["_set-ecran-start.html"], /<h1>Start here<\/h1>/);
    });

    it("falls back on its id as words when no record of it is written", () => {
      const bare = SET({ variants: SET().variants.map((each) => ({ ...each, files: [file("screens/other.md", "# Other\n")] })) });
      assert.match(pagesOf([bare])["index.html"], /<li data-set="ecran-start"><a class="ovcard" href="_set-ecran-start\.html">[\s\S]*?<span class="title">Ecran start<\/span>/);
    });

    it("shows a count on its overview row like a record, and counts in the drawer group of its step", () => {
      const index = pagesOf([SET()])["index.html"];
      assert.match(blockOf(index, "screens"), /<li data-set="ecran-start"><a class="ovcard" href="_set-ecran-start\.html">[\s\S]*?<span class="progress" data-set="ecran-start" data-label="chosen" data-total="2">0\/2 chosen<\/span>/);
      const group = drawerOf(index).match(/<details class="step-group" data-step="screens"[\s\S]*?<\/details>\s*(?=<details class="step-group"|<\/div>)/)[0];
      assert.match(group, /<details class="choice" data-set="ecran-start"/);
    });

    it("marks its own item current in the sidebar, in the step that holds it", () => {
      const html = pagesOf([SET()])["_set-ecran-start.html"];
      assert.match(navOf(html), /<li data-step="screens" data-todo="\d+"><details open>/);
      assert.match(navOf(html), /<a href="_set-ecran-start\.html" aria-current="page">Start here<\/a>/);
    });
  });

  describe("the name of a variant", () => {
    it("is a label a person reads, in the column head, the drawer row and the tooltip of a change, while the id stays in the data", () => {
      const pages = pagesOf([SET()]);
      assert.match(pages["_set-ecran-start.html"], /<section class="variant" data-variant="ami-d-abord"><header class="column-head"><h2>Ami d'abord<\/h2>/);
      assert.match(drawerOf(pages["index.html"]), /<li class="pvariant" data-variant="ami-d-abord" data-label="Ami d'abord"><span class="pick">Ami d'abord<\/span>/);
      assert.doesNotMatch(pages["_set-ecran-start.html"], /<h2>ami-d-abord/);
    });

    it("is written by the decisions listed in the drawer, never as its id, and the copy keeps the id", () => {
      const model = { records: [], sets: [{ key: "set:ecran-start@f1", set: "ecran-start", title: "Start here", variants: ["ami-d-abord", "envoi-direct"], labels: { "ami-d-abord": "Ami d'abord" } }] };
      const choices = { "set:ecran-start@f1": { "ami-d-abord": { verdict: "keep", comment: "" }, "envoi-direct": { verdict: "discard", comment: "" }, "@picks": { Tone: "ami-d-abord" } } };
      assert.deepEqual(decisionsOf(model, choices).map((each) => [each.name, each.variant]), [["Ami d'abord", undefined], ["envoi-direct", undefined], ["Tone", "Ami d'abord"]]);
      assert.deepEqual(entriesOf({ records: [], sets: [{ key: "set:ecran-start@f1", set: "ecran-start", variants: ["ami-d-abord"], labels: { "ami-d-abord": "Ami d'abord" } }] }, choices)[0].variants.map((each) => each.name), ["ami-d-abord"]);
    });
  });

  describe("the way in to the review", () => {
    const startOf = (html) => html.match(/<a class="start" href="([^"]+)">/)?.[1];

    it("opens on the first step with work in display order, a journey awaiting agreement coming last", () => {
      crowd();
      assert.notEqual(startOf(pagesOf()["index.html"]), "second.html");
      assert.equal(startOf(pagesOf()["index.html"]), "search-field.html");
    });

    it("opens on the first record awaiting when no journey does", () => {
      assert.notEqual(startOf(pagesOf()["index.html"]), "second.html");
      assert.match(startOf(pagesOf()["index.html"]), /^[a-z-]+\.html$/);
    });
  });

  describe("the sidebar", () => {
    const rule = (html, selector) => html.match(new RegExp(`(?:^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{([^}]*)\\}`))?.[1];
    const css = () => pagesOf()["index.html"];

    it("tints only the link under the pointer, never the group of items that holds it", () => {
      assert.doesNotMatch(css(), /nav li:hover/);
      assert.match(css(), /\nnav li > a:not\(\[aria-current="page"\]\):hover/);
      assert.match(rule(css(), 'nav li > a:not([aria-current="page"]):hover') ?? rule(css(), 'nav li > a:not([aria-current="page"]):hover, nav .home a:not([aria-current="page"]):hover'), /background/);
    });

    it("tints the pointer lighter than the selection, and the selection with the accent", () => {
      const hover = css().match(/nav li > a:not\(\[aria-current="page"\]\):hover[^{]*\{([^}]*)\}/)[1];
      const current = css().match(/nav li:has\(> a\[aria-current="page"\]\)[^{]*\{([^}]*)\}/)[1];
      assert.match(current, /background: var\(--accent-soft\)/);
      assert.match(css().match(/nav a\[aria-current="page"\] \{([^}]*)\}/)[1], /color: var\(--text\)/);
      assert.match(hover, /background: var\(--bg\)/);
      assert.doesNotMatch(hover, /--accent-soft|--sunken/);
    });
  });
});
