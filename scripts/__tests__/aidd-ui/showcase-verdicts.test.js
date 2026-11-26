const assert = require("node:assert/strict");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { scriptOf, literally, UI, LIB, makeTmp, removeTmp, writeProject, put, record } = require("../fixtures/aidd-ui/project.js");
const { load } = require(path.join(LIB, "project.cjs"));
const { showcaseOf, decisionsOf, copiedOf, entriesOf, nextToReviewOf, nextOpenOf, LABELS } = require(path.join(LIB, "showcase.cjs"));

let tmp;
beforeEach(() => {
  tmp = makeTmp("aidd-ui-verdicts-");
  writeProject(tmp);
});
afterEach(() => removeTmp(tmp));

const pagesOf = (lang = "en") => showcaseOf({ project: load(tmp), tokens: null, captures: new Set(), lang });
const reviewOf = (html) => html.match(/<section class="review"[\s\S]*?<\/section>/)[0];
const barOf = (html) => reviewOf(html).match(/<div class="verdict-bar">[\s\S]*?<\/div>/)?.[0];

describe("the verdicts beside the state tabs", () => {
  it("puts OK and Revise after the rendered states of a reviewed record, with a comment field, in the language", () => {
    for (const [lang, words] of [["en", ["OK", "Revise"]], ["fr", ["OK", "À revoir"]]]) {
      const html = pagesOf(lang)["home.html"];
      const review = reviewOf(html);
      assert.ok(review.indexOf('role="tablist"') < review.indexOf('<article class="state"'), "tabs, then states");
      assert.ok(review.lastIndexOf('</article>') < review.indexOf('class="verdict-bar"'), "the verdict comes after the rendered states, not above them");
      assert.deepEqual([...barOf(html).matchAll(/class="verdict" data-verdict="(\w+)" aria-pressed="false">([^<]+)</g)].map((match) => [match[1], match[2]]), [["ok", words[0]], ["revise", words[1]]]);
      assert.match(barOf(html), /<textarea class="comment"[^>]* hidden>/);
    }
  });

  it("lets the verdict bar follow the preview on a narrow window instead of sticking over it", () => {
    const style = pagesOf()["home.html"].match(/<style>([\s\S]*?)<\/style>/)[1];
    assert.match(style, /\n\.verdict-bar \{[^}]*position: sticky; bottom: 0;/, "sticky on a wide window");
    const narrow = style.match(/@media \(max-width: 768px\) \{([\s\S]*?)\n\}\n/)[1];
    assert.match(narrow, /\.verdict-bar \{[^}]*position: static;/);
  });

  it("hands every page the reviewable records and their states, settled or not, for the copy to cover", () => {
    const html = pagesOf()["_journey-onboarding.html"];
    const records = JSON.parse(html.match(/<script type="application\/json" id="review-records">([^<]*)<\/script>/)[1]);
    const home = records.find((each) => each.record === "home");
    assert.ok(home, "a record the page does not show");
    assert.deepEqual(home.states.map((each) => each.state).sort(), ["default", "empty", "error", "loading"]);
    assert.equal(typeof home.version, "string");
  });

  it("holds the decisions to copy in the drawer, hidden until there is one, with the tally's words for them", () => {
    for (const lang of ["en", "fr"]) {
      const html = pagesOf(lang)["_journey-onboarding.html"];
      assert.match(html, new RegExp(`<section class="decisions" id="decisions" hidden data-copy="${literally(LABELS[lang].toCopy)}" data-words="[^"]*"><h3>${LABELS[lang].decisions}</h3><ul></ul></section>`), lang);
    }
    const bare = { ...load(tmp), records: [] };
    assert.match(showcaseOf({ project: bare, tokens: null, captures: new Set(), lang: "fr" })["index.html"], new RegExp(`<p class="nothing">${LABELS.fr.nothing}</p>`));
    const home = JSON.parse(pagesOf("fr")["_journey-onboarding.html"].match(/id="review-records">([^<]*)</)[1]).find((each) => each.record === "home");
    assert.equal(typeof home.title, "string");
    assert.ok(home.states.some((each) => each.state === "default" && each.name === "par défaut"));
  });

  it("lists the decisions of a copy by record and state, with the verdict and its comment", () => {
    const model = { records: [
      { key: "a@1", record: "a", title: "Alpha", states: [{ state: "default", name: "par défaut" }, { state: "empty", name: "vide" }] },
      { key: "b@2", record: "b", title: "Beta", states: [{ state: "default", name: "default" }] },
    ] };
    const choices = { "a@1": { empty: { verdict: "revise", comment: "bigger" }, default: { verdict: "ok", comment: "" } }, "b@2": {} };
    assert.deepEqual(decisionsOf(model, choices), [
      { title: "Alpha", name: "par défaut", verdict: "ok", comment: "" },
      { title: "Alpha", name: "vide", verdict: "revise", comment: "bigger" },
    ]);
  });

  it("lists the verdicts of a set's variants after the records, then the axes picked, each under the set's title", () => {
    const model = {
      records: [{ key: "a@1", record: "a", title: "Alpha", states: [{ state: "default", name: "default" }] }],
      sets: [{ key: "set:layout@f1", set: "layout", title: "Layout", variants: ["airy", "dense", "bold"] }],
    };
    const choices = { "a@1": { default: { verdict: "ok", comment: "" } }, "set:layout@f1": { dense: { verdict: "discard", comment: "" }, airy: { verdict: "keep", comment: " calm " }, "@picks": { Tone: "bold" } } };
    assert.deepEqual(decisionsOf(model, choices), [
      { title: "Alpha", name: "default", verdict: "ok", comment: "" },
      { title: "Layout", name: "airy", verdict: "keep", comment: " calm " },
      { title: "Layout", name: "dense", verdict: "discard", comment: "" },
      { title: "Layout", name: "Tone", verdict: "pick", comment: "", variant: "bold" },
    ]);
  });

  it("lists one decision for each verdict and each pick the copy holds, so the count to copy is the copy's", () => {
    const model = {
      records: [{ key: "a@1", record: "a", version: "1", title: "Alpha", states: [{ state: "default", name: "default" }, { state: "empty", name: "empty" }] }],
      sets: [{ key: "s@1", set: "s", title: "S", variants: ["x", "y"] }, { key: "t@1", set: "t", title: "T", variants: ["z"] }],
    };
    const choices = { "a@1": { empty: { verdict: "revise", comment: "c" } }, "s@1": { y: { verdict: "keep" }, "@picks": { A: "x", B: "y" } }, "t@1": {} };
    const copied = JSON.parse(copiedOf(entriesOf(model, choices)).replace(/^```json\n|\n```\n$/g, ""));
    const held = copied.reduce((sum, entry) => sum + (entry.verdicts ? entry.verdicts.length : entry.variants.filter((each) => each.verdict).length + Object.keys(entry.picks || {}).length), 0);
    assert.equal(held, 4);
    assert.equal(decisionsOf(model, choices).length, held);
  });

  it("names every verdict and the pick of an axis in the drawer's words, and titles each set it offers", () => {
    const SET = { id: "layout", rows: [], axes: ["Tone"], fingerprint: "f1", problems: [], variants: ["a", "b"].map((name) => ({ name, intent: "i", axes: [["Tone", name]], files: [{ path: "preview.html", text: "<p>x</p>" }] })) };
    for (const lang of ["en", "fr"]) {
      const html = showcaseOf({ project: load(tmp), tokens: null, captures: new Set(), lang, sets: [SET] })["index.html"];
      const words = JSON.parse(html.match(/data-words="([^"]*)"/)[1].replaceAll("&quot;", "\""));
      assert.deepEqual(Object.keys(words).sort(), ["discard", "keep", "ok", "pick", "revise"], lang);
      assert.equal(words.keep, LABELS[lang].keep);
      assert.match(html, /<details class="choice" data-set="layout" data-title="Layout" /, lang);
    }
  });

  it("counts the states reviewed of a record beside the verdict, in the language, with the template the page script refills", () => {
    for (const [lang, template] of [["en", "{done}/{total} states reviewed"], ["fr", "{done}/{total} \u00e9tats revus"]]) {
      const bar = barOf(pagesOf(lang)["home.html"]);
      const match = bar.match(/<span class="reviewed" data-template="([^"]*)" data-total="(\d+)">(\d+)\/(\d+) ([^<]*)<\/span>/);
      assert.ok(match, `${lang}: ${bar}`);
      assert.equal(match[1], template);
      assert.equal(match[2], match[4]);
      assert.equal(Number(match[2]), 4);
      assert.equal(match[5], template.replace("{done}/{total} ", ""));
    }
  });

  it("offers the next state and the next item beside the verdict, both hidden until the page script has something to offer", () => {
    for (const lang of ["en", "fr"]) {
      const bar = barOf(pagesOf(lang)["home.html"]);
      assert.match(bar, new RegExp(`<button type="button" class="next-state" hidden>${LABELS[lang].nextState}</button>`), lang);
      assert.match(bar, new RegExp(`<a class="next-record" href="index.html" data-next="${LABELS[lang].nextRecord}" data-overview="${LABELS[lang].backToOverview}" hidden>${LABELS[lang].nextRecord}</a>`), lang);
    }
  });

  it("hands every page the order to review the records in: by step, then as the sidebar lists them, a wireframe a screen dresses left out", () => {
    const orderOf = (html) => JSON.parse(html.match(/<script type="application\/json" id="review-order">([^<]*)<\/script>/)[1]);
    const pages = pagesOf();
    const order = orderOf(pages["home.html"]);
    assert.deepEqual(orderOf(pages["button.html"]), order, "the same on every page");
    assert.deepEqual(orderOf(pagesOf()["home.html"]), order, "the same on every generation");
    assert.ok(order.indexOf("button") !== -1 && order.indexOf("button") < order.indexOf("home"), `components before screens: ${order}`);
    assert.equal(new Set(order).size, order.length);
    assert.ok(!order.includes("search-flow"), `a wireframe a screen dresses is reviewed through that screen: ${order}`);
    const known = JSON.parse(pages["home.html"].match(/id="review-records">([^<]*)</)[1]).map((each) => each.record);
    for (const id of order) assert.ok(known.includes(id), `${id} is a reviewable record`);
  });

  it("lists each id once in the order, even when a journey and a wireframe share it", () => {
    const render = '<html><head></head><body><main data-state="default">x</main></body></html>';
    put(tmp, `${UI}/wireframes/shared.md`, record(["id: shared", "kind: wireframe", "status: proposed", "version: 1", "states: [default]"], "# shared"));
    put(tmp, `${UI}/wireframes/shared.html`, render);
    put(tmp, `${UI}/journeys/shared.md`, record(["id: shared", "kind: journey", "status: proposed", "version: 1"], "# shared", "## Steps\n\n| Screen | Action |\n| --- | --- |\n| shared | opens |"));
    const order = JSON.parse(pagesOf()["home.html"].match(/id="review-order">([^<]*)</)[1]);
    assert.deepEqual(order.filter((id) => id === "shared"), ["shared"], `${order}`);
  });

  it("opens the screens step on the first screen of the review order, the journeys' order, not the id order", () => {
    const render = '<html><head></head><body><main data-state="default">x</main></body></html>';
    for (const id of ["aaa-screen", "zzz-screen"]) {
      put(tmp, `${UI}/screens/${id}.md`, record([`id: ${id}`, "kind: screen", "status: proposed", "version: 1", "states: [default]"], `# ${id}`));
      put(tmp, `${UI}/screens/${id}.html`, render);
    }
    put(tmp, `${UI}/journeys/aaa-flow.md`, record(["id: aaa-flow", "kind: journey", "status: proposed", "version: 1"], "# flow", "## Steps\n\n| Screen | Action |\n| --- | --- |\n| zzz-screen | opens |\n| aaa-screen | leaves |"));
    const html = pagesOf()["index.html"];
    const order = JSON.parse(html.match(/id="review-order">([^<]*)</)[1]);
    const firstScreen = order.find((id) => id === "aaa-screen" || id === "zzz-screen" || id === "home");
    assert.equal(firstScreen, "zzz-screen");
    assert.equal(html.match(/<li data-step="screens"><a href="([^"]*)">/)[1], "zzz-screen.html");
  });

  it("leaves out of the order a wireframe whose screen has nothing left to review, as it leaves the count", () => {
    const orderOf = (html) => JSON.parse(html.match(/<script type="application\/json" id="review-order">([^<]*)<\/script>/)[1]);
    const render = '<html><head></head><body><main data-state="default">x</main></body></html>';
    put(tmp, `${UI}/wireframes/start.md`, record(["id: start", "kind: wireframe", "status: proposed", "version: 1", "states: [default]"], "# start"));
    put(tmp, `${UI}/wireframes/start.html`, render);
    put(tmp, `${UI}/screens/start-screen.md`, record(["id: start-screen", "kind: screen", "status: proposed", "version: 1", "wireframe: start", "states: [default]"], "# start-screen"));
    put(tmp, `${UI}/screens/start-screen.html`, render);
    const rows = ["| start-screen | default | 1 | ok | |"];
    put(tmp, `${UI}/reviews/first-pass.md`, record(["id: first-pass", "kind: review", "status: proposed", "version: 1", "scope: system", "screens: [home]"], "# First pass", ["## Verdicts", "", "| Screen | State | Version | Verdict | Comment |", "| --- | --- | --- | --- | --- |", ...rows].join("\n")));
    const order = orderOf(pagesOf()["home.html"]);
    assert.ok(!order.includes("start"), `a wireframe nothing else asks to review: ${order}`);
    assert.ok(!order.includes("start-screen"), `a settled screen: ${order}`);
  });

  it("escapes the order as it escapes the records, so no id can close the script", { skip: process.platform === "win32" && "no file name holds < on Windows" }, () => {
    const render = '<html><head></head><body><main data-state="default">x</main></body></html>';
    put(tmp, `${UI}/screens/odd.md`, record(["id: a<b", "kind: screen", "status: proposed", "version: 1", "states: [default]"], "# odd"));
    put(tmp, `${UI}/screens/a<b.html`, render);
    const html = pagesOf()["home.html"];
    assert.ok(JSON.parse(html.match(/id="review-order">([^<]*)</)[1]).includes("a<b"));
  });

  it("names the next record to review: the first after the current in the order with a state neither settled nor decided, wrapping at the end", () => {
    const known = ["a", "b", "c", "d"].map((record) => ({ record, version: "1", states: [{ state: "x", settled: record === "b" }, { state: "y", settled: false }] }));
    const order = ["a", "b", "c", "d"];
    assert.deepEqual(nextToReviewOf(order, known, {}, "a"), { record: "b", state: "y" }, "b has only y left");
    assert.deepEqual(nextToReviewOf(order, known, { "b@1": { y: { verdict: "ok" } } }, "a"), { record: "c", state: "x" }, "a decided state is not left");
    assert.deepEqual(nextToReviewOf(order, known, {}, "d"), { record: "a", state: "x" }, "wraps to the start");
    assert.deepEqual(nextToReviewOf(order, known, { "a@1": { x: { verdict: "ok" }, y: { verdict: "ok" } }, "b@1": { y: { verdict: "ok" } }, "c@1": { x: { verdict: "ok" }, y: { verdict: "revise" } } }, "d"), null, "none left but the current");
    assert.deepEqual(nextToReviewOf(["a"], known, {}, "a"), null, "the current record is never its own next");
    assert.deepEqual(nextToReviewOf(order, known, {}, "other"), { record: "a", state: "x" }, "a page outside the order starts from its head");
  });

  it("names the next state of a record with no verdict, after the shown one, wrapping, never the shown one", () => {
    const states = [{ state: "a", settled: false }, { state: "b", settled: true }, { state: "c", settled: false }];
    assert.equal(nextOpenOf(states, {}, "a"), "c");
    assert.equal(nextOpenOf(states, {}, "c"), "a");
    assert.equal(nextOpenOf(states, { a: { verdict: "ok" } }, "c"), null);
    assert.equal(nextOpenOf(states, { c: { verdict: "ok" } }, "a"), null);
  });

  it("puts none on a page with no state tabs", () => {
    const pages = pagesOf();
    for (const name of ["index.html", "_journey-onboarding.html", "brand.html", "system.html"]) assert.doesNotMatch(pages[name], /class="verdict-bar"/, name);
  });

  describe("in the page", () => {
    const element = (dataset = {}, own = {}) => {
      const node = { dataset, hidden: false, value: "", disabled: false, textContent: "", attrs: {}, listeners: {}, below: {}, on: new Set(), ...own };
      node.classList = { toggle: (name, force) => { if (force) node.on.add(name); else node.on.delete(name); } };
      node.addEventListener = (type, listener) => { node.listeners[type] = listener; };
      node.setAttribute = (name, value) => { node.attrs[name] = value; };
      node.getAttribute = (name) => node.attrs[name];
      node.focus = () => { node.focused = true; };
      node.querySelectorAll = (selector) => node.below[selector] ?? [];
      node.querySelector = (selector) => (node.below[selector] ?? [])[0] ?? null;
      return node;
    };
    // A record page as the script sees it: one review of home at version 1 with two tabs, the drawer holding the
    // row of `empty` only, as a state already settled has none there.
    // A drawer item with one state not settled, naming the screen that dresses it when it is a wireframe.
    const pending = (record, dressedBy, href) => {
      const row = element({ state: "default", current: "pending" }, { below: { ".verdict": ["ok", "revise"].map((verdict) => element({ verdict })), ".comment": [element()], ".pick": [element()] } });
      const own = element({ record, version: "1", ...(dressedBy ? { dressedBy } : {}), ...(href ? { href } : {}) }, { below: { "li.pstate": [row], ".done": [element()] } });
      own.hasAttribute = () => false;
      own.closest = () => ({ dataset: { step: "screens" } });
      return own;
    };
    const open = (memory = {}, { drawerHoldsIt = true, beside = [], itemData = {}, known, decisions = false, steps = false, order, extra = () => undefined, folder = "/one/aidd_docs/ui/showcase/" } = {}) => {
      const script = scriptOf(pagesOf()["index.html"]);
      const tabs = [["default", "pending"], ["empty", "pending"]].map(([state, current]) => element({ tab: state, current }));
      const field = element();
      const votes = ["ok", "revise"].map((verdict) => element({ verdict }));
      const reviewed = element({ template: "{done}/{total} states reviewed", total: "2" });
      const nextState = element({}, { hidden: true });
      const nextRecord = element({ next: "Next item", overview: "Overview" }, { hidden: true, href: "index.html" });
      const bar = element({}, { below: { ".verdict": votes, ".comment": [field], ".reviewed": [reviewed], ".next-state": [nextState], ".next-record": [nextRecord] } });
      const review = element({ record: "home", version: "1" }, { below: { '[role="tab"]': tabs, '[role="tab"][aria-selected="true"]': [tabs[0]], ".verdict-bar": [bar] } });
      const rowField = element();
      const rowVotes = ["ok", "revise"].map((verdict) => element({ verdict }));
      const row = element({ state: "empty", current: "pending" }, { below: { ".verdict": rowVotes, ".comment": [rowField], ".pick": [element()] } });
      const item = element({ record: "home", version: "1", ...itemData }, { below: { "li.pstate": [row], ".done": [element()] } });
      item.hasAttribute = () => false;
      item.closest = () => ({ dataset: { step: "screens" } });
      const tally = element({ template: "{count} to review" });
      const list = element({}, { children: [], replaceChildren: (...nodes) => { list.children = nodes; } });
      const decided = element({ copy: "{count} to copy", words: JSON.stringify({ ok: "OK", revise: "Revise" }) }, { hidden: undefined, below: { ul: [list] } });
      const nothing = element();
      const stepOk = element({ step: "screens", label: "All OK", confirm: "Confirm {count} states?", confirmOne: "Confirm 1 state?" }, { textContent: "All OK" });
      const stepCancel = element({}, { hidden: true });
      const by = { scrim: element(), review: element({}, { hidden: true, below: { ".nothing": [nothing], "details.item": drawerHoldsIt ? [item, ...beside.map(([record, dressedBy, href]) => pending(record, dressedBy, href))] : [], "details.choice": [], ".step-ok": steps ? [stepOk] : [], ".step-cancel": steps ? [stepCancel] : [] } }), "open-review": element(), copy: element({ blocked: "blocked", hint: "hint" }), clear: element(), note: element(), "close-review": element(), ...(decisions ? { decisions: decided } : {}), ...(order ? { "review-order": element({}, { textContent: JSON.stringify(order) }) } : {}), ...(known ? { "review-records": element({}, { textContent: JSON.stringify(known) }) } : {}) };
      const keys = {};
      const document = { activeElement: null, createElement: () => element(), body: { dataset: {} }, addEventListener(type, listener) { keys[type] = listener; }, getElementById: (id) => by[id] ?? null, querySelectorAll: (selector) => (selector === "section.review[data-record]" ? [review] : selector === ".tally[data-template]" ? [tally] : extra(selector) ?? []), querySelector: () => null };
      const written = [];
      const window = { addEventListener() {}, location: { pathname: `${folder}home.html` }, localStorage: { getItem: (key) => memory[key] ?? null, setItem: (key, value) => { memory[key] = value; }, removeItem: (key) => { delete memory[key]; } } };
      const navigator = { clipboard: { writeText: async (content) => { written.push(content); } } };
      const opened = [];
      let api;
      const openTab = (tab) => { opened.push(tab.dataset.tab); review.below['[role="tab"][aria-selected="true"]'] = [tab]; api.marked(tab.dataset.tab); };
      api = new Function("document", "window", "navigator", "setTimeout", "openTab", `${script}\nreturn { marked };`)(document, window, navigator, () => {}, openTab);
      return { document, reviewed, nextState, nextRecord, opened, keys, stepOk, stepCancel, tally, list, decided, nothing, votes, field, rowVotes, rowField, tabs, review, by, memory, written, api };
    };
    const shown = (page, index) => {
      page.review.below['[role="tab"][aria-selected="true"]'] = [page.tabs[index]];
      page.api.marked(page.tabs[index].dataset.tab);
    };
    const copiedStates = async (page) => {
      page.by.copy.listeners.click();
      await new Promise((resolve) => setImmediate(resolve));
      return JSON.parse(page.written[0].replace(/^```json\n|\n```\n$/g, ""))[0].verdicts.map((each) => [each.state, each.verdict, each.comment]);
    };

    it("counts a wireframe awaiting beside the screen that dresses it once, and never alone once that screen is settled", () => {
      const page = open({}, { beside: [["wire", "screen"], ["screen"], ["bare"]] });
      assert.equal(page.tally.textContent, "3 to review", "home, screen and bare count, the wireframe the screen dresses does not");
      const settledScreen = open({}, { beside: [["wire", "screen"], ["bare"]] });
      assert.equal(settledScreen.tally.textContent, "2 to review", "with no awaiting screen beside it the wireframe has left the review");
    });

    describe("a step brought to nothing", () => {
      const settledReview = (verdict) => record(["id: first-pass", "kind: review", "status: proposed", "version: 1", "scope: system", "screens: [home]"], "# First pass", ["## Verdicts", "", "| Screen | State | Version | Verdict | Comment |", "| --- | --- | --- | --- | --- |", "| brand | default | 1 | ok | |", "| system | default | 1 | ok | |", "| home | default | 1 | ok | |", "| home | empty | 1 | ok | |", "| home | loading | 1 | revise | spinner too small |", `| home | error | 1 | ${verdict} | |`].join("\n"));
      const unescapedText = (text) => text.replaceAll("&quot;", '"').replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");
      const datasetOf = (tag) => Object.fromEntries([...tag.matchAll(/ data-([a-z-]+)="([^"]*)"/g)].map(([, name, value]) => [name.replace(/-(\w)/g, (_, letter) => letter.toUpperCase()), unescapedText(value)]));
      const marks = (html) => ({
        stepper: html.match(/<li data-step="screens"( hidden)?><a[^>]*><span class="name">[^<]*<\/span><span class="state">([^<]*)<\/span>/),
        sidebar: html.match(/<li data-step="screens" data-todo="\d+">[\s\S]*?(<span class="step-mark( agree)?"[^>]*aria-label="([^"]*)"[^>]*>([^<]*)<\/span>)/),
        overview: html.match(/<section class="ov-step" data-step="screens"><h3>[^<]*(?:<span>(\d+)<\/span>)?<\/h3>/),
      });

      for (const [lang, line] of [["en", "Everything is reviewed."], ["fr", "Tout est relu."]]) {
        it(`lists no step and says in one calm line that everything is reviewed once the last verdict is given, ${lang}`, () => {
          require("node:fs").rmSync(path.join(tmp, UI, "components"), { recursive: true, force: true });
          put(tmp, `${UI}/reviews/first-pass.md`, settledReview("ok"));
          const index = pagesOf(lang)["index.html"];
          const items = [...index.match(/<ul class="waiting">[\s\S]*?<\/ul>/)[0].matchAll(/<li data-step="\w+"( hidden)?>/g)];
          assert.ok(items.length > 0 && items.every((match) => match[1]), index.match(/<ul class="waiting">[\s\S]*?<\/ul>/)[0]);
          assert.equal(index.match(/<p class="lede"[^>]*>([^<]*)<\/p>/)[1], line);
        });
      }

      for (const lang of ["en", "fr"]) {
        for (const proposed of [false, true]) {
          it(`says what a fresh render says once the last verdict is given, ${lang}, ${proposed ? "with" : "without"} a record still proposed`, () => {
            if (proposed) put(tmp, `${UI}/screens/draft.md`, record(["id: draft", "kind: screen", "status: proposed", "version: 1", "states: [default]"], "# draft"));
            put(tmp, `${UI}/reviews/first-pass.md`, settledReview("pending"));
            const before = pagesOf(lang)["index.html"];
            put(tmp, `${UI}/reviews/first-pass.md`, settledReview("ok"));
            const fresh = marks(pagesOf(lang)["index.html"]);
            const was = marks(before);
            assert.equal(was.stepper[1], undefined, "the step starts with a verdict to give, so it is listed");
            const spots = { state: element(), li: element(), mark: element(datasetOf(was.sidebar[1])), span: element() };
            const page = open({}, { extra: (selector) => ({
              '.waiting li[data-step="screens"] .state': [spots.state],
              '.waiting li[data-step="screens"]': [spots.li],
              '.steps > li[data-step="screens"] .step-mark': [spots.mark],
              '.ov-step[data-step="screens"] h3 span': [spots.span],
            })[selector] });
            page.rowVotes[0].listeners.click();
            assert.equal(spots.state.textContent, unescapedText(fresh.stepper[2]));
            assert.equal(spots.li.hidden, Boolean(fresh.stepper[1]));
            assert.equal(spots.mark.textContent, fresh.sidebar[4]);
            assert.equal(spots.mark.attrs["aria-label"], unescapedText(fresh.sidebar[3]));
            assert.equal(spots.mark.on.has("agree"), Boolean(fresh.sidebar[2]));
            assert.equal(spots.span.textContent, fresh.overview[1] ?? "");
            assert.equal(spots.span.hidden, fresh.overview[1] === undefined);
          });
        }
      }
    });

    describe("the home headline", () => {
      const unescapedText = (text) => text.replaceAll("&quot;", '"').replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");
      const datasetOf = (tag) => Object.fromEntries([...tag.matchAll(/ data-([a-z-]+)="([^"]*)"/g)].map(([, name, value]) => [name.replace(/-(\w)/g, (_, letter) => letter.toUpperCase()), unescapedText(value)]));
      const reviewFile = (verdicts) => record(["id: first-pass", "kind: review", "status: proposed", "version: 1", "scope: system", "screens: [home, other]"], "# First pass", ["## Verdicts", "", "| Screen | State | Version | Verdict | Comment |", "| --- | --- | --- | --- | --- |", "| brand | default | 1 | ok | |", "| system | default | 1 | ok | |", "| home | default | 1 | ok | |", "| home | empty | 1 | ok | |", "| home | loading | 1 | revise | spinner too small |", `| home | error | 1 | ${verdicts.home} | |`, `| other | default | 1 | ${verdicts.other} | |`].join("\n"));
      const headline = (html) => ({
        tag: html.match(/<p class="lede"[^>]* data-next=[^>]*>/)[0],
        text: unescapedText(html.match(/<p class="lede"[^>]* data-next=[^>]*>([^<]*)<\/p>/)[1]),
        start: html.match(/<p class="start-row"><a class="start" href="([^"]*)"/)?.[1] ?? null,
      });
      // Only the screens step, which the stand-in page holds, has work: the elements step is left out.
      const homeOnly = (lang) => {
        const project = load(tmp);
        return showcaseOf({ project: { ...project, records: project.records.filter((each) => ["brand", "system", "screen", "wireframe", "journey", "review"].includes(each.frontMatter.kind)) }, tokens: null, captures: new Set(), lang })["index.html"];
      };
      const hrefOf = (html, id) => html.match(new RegExp(`<details class="item" data-record="${id}"[^>]* data-href="([^"]*)"`))[1];

      for (const lang of ["en", "fr"]) {
        for (const [name, other, proposed] of [["nothing left", true, false], ["only proposed left", true, true], ["another record left to review", false, false], ["another record and a proposed one left", false, true]]) {
          it(`says what a fresh render says once the last verdict of home is given, ${lang}, ${name}`, () => {
            const render = '<html><head></head><body><main data-state="default">x</main></body></html>';
            put(tmp, `${UI}/screens/other.md`, record(["id: other", "kind: screen", "status: validated", "version: 1", "states: [default]"], "# Other"));
            put(tmp, `${UI}/screens/other.html`, render);
            if (proposed) put(tmp, `${UI}/screens/draft.md`, record(["id: draft", "kind: screen", "status: proposed", "version: 1", "states: [default]"], "# draft"));
            put(tmp, `${UI}/reviews/first-pass.md`, reviewFile({ home: "pending", other: other ? "ok" : "pending" }));
            const before = homeOnly(lang);
            put(tmp, `${UI}/reviews/first-pass.md`, reviewFile({ home: "ok", other: other ? "ok" : "pending" }));
            const fresh = headline(homeOnly(lang));
            const was = headline(before);
            const spots = { lede: element(datasetOf(was.tag)), anchor: element({}, { attrs: { href: was.start } }) };
            spots.row = element({}, { below: { "a.start": [spots.anchor] } });
            const page = open({}, { itemData: { href: hrefOf(before, "home") }, beside: other ? [] : [["other", undefined, hrefOf(before, "other")]], extra: (selector) => ({
              "p.lede[data-next]": [spots.lede],
              ".start-row": [spots.row],
            })[selector] });
            page.rowVotes[0].listeners.click();
            assert.equal(spots.lede.textContent, fresh.text);
            assert.equal(spots.row.hidden, fresh.start === null);
            if (fresh.start !== null) assert.equal(spots.anchor.attrs.href, fresh.start);
          });
        }
      }
    });

    it("keeps the rework mark of a record once every state has a verdict, and hides only its to-review mark", () => {
      const progress = element({ base: "0", total: "1" });
      const marks = [element({}, { classes: ["mark", "todo"] }), element({}, { classes: ["mark", "rework"] })];
      const extra = (selector) => {
        const match = selector.match(/^\.mark((?:\.\w+)*)\[data-record="home"\]$/);
        if (match) return marks.filter((mark) => match[1].split(".").filter(Boolean).every((name) => mark.classes.includes(name)));
        return selector === '.progress[data-record="home"]' ? [progress] : undefined;
      };
      const page = open({}, { extra });
      page.rowVotes[1].listeners.click();
      assert.deepEqual(marks.map((mark) => mark.hidden), [true, false]);
    });

    it("gives the waiting list, the sidebar, the overview and the drawer the one count of the review button, as verdicts are given", () => {
      const spots = { stepper: element(), sidebar: element(), overview: element(), drawer: element() };
      const extra = (selector) => ({
        '.waiting li[data-step="screens"] .state': [spots.stepper],
        '.steps > li[data-step="screens"] .step-mark': [spots.sidebar],
        '.ov-step[data-step="screens"] h3 span': [spots.overview],
        '.step-group[data-step="screens"] .step-count': [spots.drawer],
      })[selector];
      const page = open({}, { beside: [["screen"], ["bare"]], extra });
      page.rowVotes[0].listeners.click();
      assert.equal(page.tally.textContent, "2 to review");
      assert.deepEqual([spots.stepper.textContent, spots.sidebar.textContent, spots.overview.textContent, spots.drawer.textContent], ["2 to review", "2", "2", "(2)"]);
    });

    it("gives the verdict of the shown state under the key and the values the drawer keeps", () => {
      const page = open();
      page.votes[0].listeners.click();
      assert.deepEqual(JSON.parse(page.memory["aidd-ui-review:/one/aidd_docs/ui/showcase/"]), { "home@1": { default: { verdict: "ok", comment: "" } } });
      shown(page, 0);
      assert.equal(page.votes[0].attrs["aria-pressed"], "true");
      page.votes[0].listeners.click();
      assert.equal(page.memory["aidd-ui-review:/one/aidd_docs/ui/showcase/"], undefined);
    });

    it("keeps a verdict to the showcase it was given in, as every page opened from disk shares one storage", () => {
      const memory = {};
      open(memory).votes[0].listeners.click();
      const elsewhere = open(memory, { folder: "/two/aidd_docs/ui/showcase/" });
      assert.equal(elsewhere.votes[0].attrs["aria-pressed"], "false");
      const beside = open(memory);
      assert.equal(beside.votes[0].attrs["aria-pressed"], "true");
    });

    it("asks the comment of a state to revise in place, the drawer left shut, and keeps what is typed", () => {
      const page = open();
      page.votes[1].listeners.click();
      assert.equal(page.field.hidden, false);
      assert.equal(page.field.focused, true);
      assert.equal(page.by.review.hidden, true);
      page.field.value = "too tight";
      page.field.listeners.input();
      assert.deepEqual(JSON.parse(page.memory["aidd-ui-review:/one/aidd_docs/ui/showcase/"])["home@1"].default, { verdict: "revise", comment: "too tight" });
    });

    it("shows in the drawer a verdict given beside the tabs, and the other way round", () => {
      const page = open();
      page.tabs.forEach((tab) => { tab.setAttribute = () => {}; });
      page.review.below['[role="tab"][aria-selected="true"]'] = [page.tabs[1]];
      page.api.marked("empty");
      assert.equal(page.votes[0].attrs["aria-pressed"], "false");
      page.votes[0].listeners.click();
      shown(page, 1);
      assert.equal(page.rowVotes[0].attrs["aria-pressed"], "true");
      page.rowVotes[1].listeners.click();
      assert.equal(page.votes[0].attrs["aria-pressed"], "false");
      assert.equal(page.votes[1].attrs["aria-pressed"], "true");
    });

    it("repaints the bar for the state a tab opens", () => {
      const page = open({ "aidd-ui-review:/one/aidd_docs/ui/showcase/": JSON.stringify({ "home@1": { empty: { verdict: "ok", comment: "" } } }) });
      assert.equal(page.votes[0].attrs["aria-pressed"], "false");
      page.review.below['[role="tab"][aria-selected="true"]'] = [page.tabs[1]];
      page.api.marked("empty");
      assert.equal(page.votes[0].attrs["aria-pressed"], "true");
    });

    it("keeps and copies a verdict on a record the drawer holds no item for, every state of it settled", async () => {
      const page = open({}, { drawerHoldsIt: false });
      page.votes[1].listeners.click();
      page.field.value = "wider";
      page.field.listeners.input();
      assert.deepEqual(await copiedStates(page), [["default", "revise", "wider"]]);
      const again = open(page.memory, { drawerHoldsIt: false });
      assert.equal(again.votes[1].attrs["aria-pressed"], "true");
      assert.equal(again.field.value, "wider");
    });

    it("copies and keeps a verdict given on another page for a record this page neither shows nor lists", async () => {
      const known = [{ record: "button", version: "1", step: "components", title: "Button", states: [{ state: "default", name: "default", settled: true }] }];
      const page = open({ "aidd-ui-review:/one/aidd_docs/ui/showcase/": JSON.stringify({ "button@1": { default: { verdict: "ok", comment: "" } } }) }, { known });
      page.votes[1].listeners.click();
      page.field.value = "wider";
      page.field.listeners.input();
      page.by.copy.listeners.click();
      await new Promise((resolve) => setImmediate(resolve));
      assert.deepEqual(JSON.parse(page.written[0].replace(/^```json\n|\n```\n$/g, "")).map((each) => [each.record, each.verdicts.map((one) => [one.state, one.verdict])]), [["home", [["default", "revise"]]], ["button", [["default", "ok"]]]]);
      assert.deepEqual(Object.keys(JSON.parse(page.memory["aidd-ui-review:/one/aidd_docs/ui/showcase/"])).sort(), ["button@1", "home@1"]);
    });

    it("shows what the copy will hold, and no longer says nothing is left while a decision awaits its copy", () => {
      const known = [{ record: "home", version: "1", title: "Home", states: [{ state: "default", name: "default", settled: true }, { state: "empty", name: "empty", settled: false }] }];
      const page = open({}, { known, decisions: true });
      assert.equal(page.decided.hidden, true, "nothing decided yet");
      page.votes[0].listeners.click();
      assert.equal(page.tally.textContent, "1 to review", "the empty state is still to settle");
      assert.deepEqual(page.list.children.map((each) => each.textContent), ["Home \u00b7 default \u00b7 OK"]);
      assert.equal(page.nothing.hidden, true);
      page.rowVotes[1].listeners.click();
      page.rowField.value = "wider";
      page.rowField.listeners.input();
      assert.deepEqual(page.list.children.map((each) => each.textContent), ["Home \u00b7 empty \u00b7 Revise : wider", "Home \u00b7 default \u00b7 OK"]);
      assert.equal(page.decided.hidden, false);
      assert.equal(page.tally.textContent, "2 to copy", "nothing left to review, two decisions to copy");
      shown(page, 0);
      page.votes[0].listeners.click();
      page.rowVotes[1].listeners.click();
      assert.equal(page.tally.textContent, "1 to review");
      assert.equal(page.decided.hidden, true);
      assert.equal(page.nothing.hidden, false);
    });

    const KNOWN = [
      { record: "home", version: "1", title: "Home", states: [{ state: "default", name: "default", settled: false }, { state: "empty", name: "empty", settled: false }] },
      { record: "button", version: "1", title: "Button", states: [{ state: "focus", name: "focus", settled: false }] },
    ];

    it("refills the count of the states reviewed as verdicts are given", () => {
      const page = open();
      assert.equal(page.reviewed.textContent, "0/2 states reviewed");
      page.votes[0].listeners.click();
      assert.equal(page.reviewed.textContent, "1/2 states reviewed");
      page.votes[0].listeners.click();
      assert.equal(page.reviewed.textContent, "2/2 states reviewed");
    });

    it("moves to the next state with no verdict after an OK, and stays after a revise or a verdict taken back", () => {
      const ok = open();
      ok.votes[0].listeners.click();
      assert.deepEqual(ok.opened, ["empty"]);
      const revise = open();
      revise.votes[1].listeners.click();
      assert.deepEqual(revise.opened, [], "a revise waits for its comment");
      const back = open({ "aidd-ui-review:/one/aidd_docs/ui/showcase/": JSON.stringify({ "home@1": { default: { verdict: "ok", comment: "" } } }) });
      back.votes[0].listeners.click();
      assert.deepEqual(back.opened, []);
    });

    it("offers the next state while one has no verdict, held back on a revise with no comment, and opens it", () => {
      const page = open();
      assert.equal(page.nextState.hidden, false);
      page.votes[1].listeners.click();
      assert.equal(page.nextState.disabled, true);
      page.field.value = "wider";
      page.field.listeners.input();
      assert.equal(page.nextState.disabled, false);
      page.nextState.listeners.click();
      assert.deepEqual(page.opened, ["empty"]);
      page.votes[0].listeners.click();
      assert.equal(page.nextState.hidden, true, "every state has a verdict");
    });

    it("offers the next record only once every state of this one has a verdict, at the state of it still to review", () => {
      const page = open({}, { known: KNOWN, order: ["home", "button"] });
      assert.equal(page.nextRecord.hidden, true);
      page.votes[0].listeners.click();
      assert.equal(page.nextRecord.hidden, true, "a state is left");
      page.votes[0].listeners.click();
      assert.equal(page.nextRecord.hidden, false);
      assert.equal(page.nextRecord.href, "button.html#tab-focus");
      assert.equal(page.nextRecord.textContent, "Next item");
    });

    it("sends to the overview when no record is left to review", () => {
      const page = open({}, { known: [KNOWN[0]], order: ["home"] });
      page.votes[0].listeners.click();
      page.votes[0].listeners.click();
      assert.equal(page.nextRecord.hidden, false);
      assert.equal(page.nextRecord.href, "index.html");
      assert.equal(page.nextRecord.textContent, "Overview");
    });

    it("holds the next record back while a revise has no comment", () => {
      const page = open({}, { known: KNOWN, order: ["home", "button"] });
      page.votes[0].listeners.click();
      page.votes[1].listeners.click();
      assert.equal(page.nextRecord.hidden, true);
      page.field.value = "wider";
      page.field.listeners.input();
      assert.equal(page.nextRecord.hidden, false);
    });

    it("asks to confirm a step's all OK with the count it would mark, and applies it on the second click only", () => {
      const page = open({}, { steps: true });
      const click = () => page.stepOk.listeners.click({ preventDefault() {} });
      click();
      assert.equal(page.stepOk.textContent, "Confirm 2 states?");
      assert.equal(page.stepCancel.hidden, false);
      assert.equal(page.memory["aidd-ui-review:/one/aidd_docs/ui/showcase/"], undefined, "nothing marked by the first click");
      click();
      assert.deepEqual(Object.keys(JSON.parse(page.memory["aidd-ui-review:/one/aidd_docs/ui/showcase/"])["home@1"]).sort(), ["default", "empty"]);
      assert.equal(page.stepOk.textContent, "All OK");
      assert.equal(page.stepCancel.hidden, true);
    });

    it("cancels a step's confirmation with Cancel or with Escape, which then leaves the drawer open", () => {
      const page = open({}, { steps: true });
      const click = () => page.stepOk.listeners.click({ preventDefault() {} });
      click();
      page.stepCancel.listeners.click({ preventDefault() {} });
      assert.equal(page.stepOk.textContent, "All OK");
      assert.equal(page.stepCancel.hidden, true);
      assert.equal(page.memory["aidd-ui-review:/one/aidd_docs/ui/showcase/"], undefined);
      page.by["open-review"].listeners.click();
      click();
      page.keys.keydown({ key: "Escape" });
      assert.equal(page.stepOk.textContent, "All OK");
      assert.equal(page.by.review.hidden, false, "the first Escape only cancels");
      page.keys.keydown({ key: "Escape" });
      assert.equal(page.by.review.hidden, true, "with nothing to cancel, Escape closes it");
      assert.equal(page.memory["aidd-ui-review:/one/aidd_docs/ui/showcase/"], undefined);
    });

    it("gives the focus back to the step's all OK when the Cancel that held it is hidden, by a click or by Escape", () => {
      const page = open({}, { steps: true });
      page.by["open-review"].listeners.click();
      page.stepOk.listeners.click({ preventDefault() {} });
      page.document.activeElement = page.stepCancel;
      page.stepCancel.listeners.click({ preventDefault() {} });
      assert.equal(page.stepOk.focused, true, "after a click on Cancel");
      page.stepOk.focused = false;
      page.document.activeElement = null;
      page.stepOk.listeners.click({ preventDefault() {} });
      page.document.activeElement = page.stepCancel;
      page.keys.keydown({ key: "Escape" });
      assert.equal(page.stepOk.focused, true, "after Escape on Cancel");
      page.stepOk.focused = false;
      page.document.activeElement = null;
      page.stepOk.listeners.click({ preventDefault() {} });
      page.keys.keydown({ key: "Escape" });
      assert.notEqual(page.stepOk.focused, true, "a focus elsewhere is left alone");
    });

    it("copies a verdict given on a state the drawer holds no row for, and keeps it across a reload", async () => {
      const page = open();
      page.votes[0].listeners.click();
      assert.deepEqual(await copiedStates(page), [["default", "ok", ""]]);
      const again = open(page.memory);
      assert.equal(again.votes[0].attrs["aria-pressed"], "true");
    });
  });
});
