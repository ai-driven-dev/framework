const assert = require("node:assert/strict");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { LIB, makeTmp, removeTmp, writeProject } = require("../fixtures/aidd-ui/project.js");
const { load } = require(path.join(LIB, "project.cjs"));
const { showcaseOf, decisionsOf, copiedOf, entriesOf, LABELS } = require(path.join(LIB, "showcase.cjs"));

// The verdict of a state is given beside the tabs of the record, and the drawer only recaps it: the page script
// is run here on a stand-in for the page, as the sets' tests do.
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
  it("puts OK and Revise under the tabs of a reviewed record, with a comment field, in the language", () => {
    for (const [lang, words] of [["en", ["OK", "Revise"]], ["fr", ["OK", "À revoir"]]]) {
      const html = pagesOf(lang)["home.html"];
      const review = reviewOf(html);
      assert.ok(review.indexOf('role="tablist"') < review.indexOf('class="verdict-bar"'), "after the tabs");
      assert.ok(review.indexOf('class="verdict-bar"') < review.indexOf('<article class="state"'), "before the states");
      assert.deepEqual([...barOf(html).matchAll(/class="verdict" data-verdict="(\w+)" aria-pressed="false">([^<]+)</g)].map((match) => [match[1], match[2]]), [["ok", words[0]], ["revise", words[1]]]);
      assert.match(barOf(html), /<textarea class="comment"[^>]* hidden>/);
    }
  });

  it("hands every page the reviewable records and their states, settled or not, for the copy to cover", () => {
    const html = pagesOf()["onboarding.html"];
    const records = JSON.parse(html.match(/<script type="application\/json" id="review-records">([^<]*)<\/script>/)[1]);
    const home = records.find((each) => each.record === "home");
    assert.ok(home, "a record the page does not show");
    assert.deepEqual(home.states.map((each) => each.state).sort(), ["default", "empty", "error", "loading"]);
    assert.equal(typeof home.version, "string");
  });

  it("holds the decisions to copy in the drawer, hidden until there is one, with the tally's words for them", () => {
    for (const lang of ["en", "fr"]) {
      const html = pagesOf(lang)["onboarding.html"];
      assert.match(html, new RegExp(`<section class="decisions" id="decisions" hidden data-copy="${LABELS[lang].toCopy.replace("{", "\\{").replace("}", "\\}")}" data-words="[^"]*"><h3>${LABELS[lang].decisions}</h3><ul></ul></section>`), lang);
    }
    const bare = { ...load(tmp), records: [] };
    assert.match(showcaseOf({ project: bare, tokens: null, captures: new Set(), lang: "fr" })["index.html"], new RegExp(`<p class="nothing">${LABELS.fr.nothing}</p>`));
    const home = JSON.parse(pagesOf("fr")["onboarding.html"].match(/id="review-records">([^<]*)</)[1]).find((each) => each.record === "home");
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

  it("puts none on a page with no state tabs", () => {
    const pages = pagesOf();
    for (const name of ["index.html", "onboarding.html", "brand.html", "system.html"]) assert.doesNotMatch(pages[name], /class="verdict-bar"/, name);
  });

  describe("in the page", () => {
    const element = (dataset = {}, own = {}) => {
      const node = { dataset, hidden: false, value: "", disabled: false, textContent: "", attrs: {}, listeners: {}, below: {}, ...own };
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
    const pending = (record, dressedBy) => {
      const row = element({ state: "default", current: "pending" }, { below: { ".verdict": ["ok", "revise"].map((verdict) => element({ verdict })), ".comment": [element()], ".pick": [element()] } });
      const own = element(dressedBy ? { record, version: "1", dressedBy } : { record, version: "1" }, { below: { "li.pstate": [row], ".done": [element()] } });
      own.hasAttribute = () => false;
      own.closest = () => ({ dataset: { step: "screens" } });
      return own;
    };
    const open = (memory = {}, { drawerHoldsIt = true, beside = [], known, decisions = false } = {}) => {
      const script = pagesOf()["index.html"].match(/<script>([\s\S]*)<\/script>/)[1];
      const tabs = [["default", "pending"], ["empty", "pending"]].map(([state, current]) => element({ tab: state, current }));
      const field = element();
      const votes = ["ok", "revise"].map((verdict) => element({ verdict }));
      const bar = element({}, { below: { ".verdict": votes, ".comment": [field] } });
      const review = element({ record: "home", version: "1" }, { below: { '[role="tab"]': tabs, '[role="tab"][aria-selected="true"]': [tabs[0]], ".verdict-bar": [bar] } });
      const rowField = element();
      const rowVotes = ["ok", "revise"].map((verdict) => element({ verdict }));
      const row = element({ state: "empty", current: "pending" }, { below: { ".verdict": rowVotes, ".comment": [rowField], ".pick": [element()] } });
      const item = element({ record: "home", version: "1" }, { below: { "li.pstate": [row], ".done": [element()] } });
      item.hasAttribute = () => false;
      item.closest = () => ({ dataset: { step: "screens" } });
      const tally = element({ template: "{count} to review" });
      const list = element({}, { children: [], replaceChildren: (...nodes) => { list.children = nodes; } });
      const decided = element({ copy: "{count} to copy", words: JSON.stringify({ ok: "OK", revise: "Revise" }) }, { hidden: undefined, below: { ul: [list] } });
      const nothing = element();
      const by = { scrim: element(), review: element({}, { hidden: true, below: { ".nothing": [nothing], "details.item": drawerHoldsIt ? [item, ...beside.map(([record, dressedBy]) => pending(record, dressedBy))] : [], "details.choice": [], ".step-ok": [] } }), "open-review": element(), copy: element({ blocked: "blocked", hint: "hint" }), clear: element(), note: element(), "close-review": element(), ...(decisions ? { decisions: decided } : {}), ...(known ? { "review-records": element({}, { textContent: JSON.stringify(known) }) } : {}) };
      const document = { createElement: () => element(), body: { dataset: {} }, addEventListener() {}, getElementById: (id) => by[id] ?? null, querySelectorAll: (selector) => (selector === "section.review[data-record]" ? [review] : selector === ".tally[data-template]" ? [tally] : []), querySelector: () => null };
      const written = [];
      const window = { addEventListener() {}, localStorage: { getItem: (key) => memory[key] ?? null, setItem: (key, value) => { memory[key] = value; }, removeItem: (key) => { delete memory[key]; } } };
      const navigator = { clipboard: { writeText: async (content) => { written.push(content); } } };
      const api = new Function("document", "window", "navigator", "setTimeout", `${script}\nreturn { marked };`)(document, window, navigator, () => {});
      return { tally, list, decided, nothing, votes, field, rowVotes, rowField, tabs, review, by, memory, written, api };
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

    it("gives the verdict of the shown state under the key and the values the drawer keeps", () => {
      const page = open();
      page.votes[0].listeners.click();
      assert.deepEqual(JSON.parse(page.memory["aidd-ui-review"]), { "home@1": { default: { verdict: "ok", comment: "" } } });
      assert.equal(page.votes[0].attrs["aria-pressed"], "true");
      page.votes[0].listeners.click();
      assert.equal(page.memory["aidd-ui-review"], undefined);
    });

    it("asks the comment of a state to revise in place, the drawer left shut, and keeps what is typed", () => {
      const page = open();
      page.votes[1].listeners.click();
      assert.equal(page.field.hidden, false);
      assert.equal(page.field.focused, true);
      assert.equal(page.by.review.hidden, true);
      page.field.value = "too tight";
      page.field.listeners.input();
      assert.deepEqual(JSON.parse(page.memory["aidd-ui-review"])["home@1"].default, { verdict: "revise", comment: "too tight" });
    });

    it("shows in the drawer a verdict given beside the tabs, and the other way round", () => {
      const page = open();
      page.tabs.forEach((tab) => { tab.setAttribute = () => {}; });
      page.review.below['[role="tab"][aria-selected="true"]'] = [page.tabs[1]];
      page.api.marked("empty");
      assert.equal(page.votes[0].attrs["aria-pressed"], "false");
      page.votes[0].listeners.click();
      assert.equal(page.rowVotes[0].attrs["aria-pressed"], "true");
      page.rowVotes[1].listeners.click();
      assert.equal(page.votes[0].attrs["aria-pressed"], "false");
      assert.equal(page.votes[1].attrs["aria-pressed"], "true");
    });

    it("repaints the bar for the state a tab opens", () => {
      const page = open({ "aidd-ui-review": JSON.stringify({ "home@1": { empty: { verdict: "ok", comment: "" } } }) });
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
      const page = open({ "aidd-ui-review": JSON.stringify({ "button@1": { default: { verdict: "ok", comment: "" } } }) }, { known });
      page.votes[1].listeners.click();
      page.field.value = "wider";
      page.field.listeners.input();
      page.by.copy.listeners.click();
      await new Promise((resolve) => setImmediate(resolve));
      assert.deepEqual(JSON.parse(page.written[0].replace(/^```json\n|\n```\n$/g, "")).map((each) => [each.record, each.verdicts.map((one) => [one.state, one.verdict])]), [["home", [["default", "revise"]]], ["button", [["default", "ok"]]]]);
      assert.deepEqual(Object.keys(JSON.parse(page.memory["aidd-ui-review"])).sort(), ["button@1", "home@1"]);
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
      page.votes[0].listeners.click();
      page.rowVotes[1].listeners.click();
      assert.equal(page.tally.textContent, "1 to review");
      assert.equal(page.decided.hidden, true);
      assert.equal(page.nothing.hidden, false);
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
