const assert = require("node:assert/strict");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { UI, LIB, makeTmp, removeTmp, writeProject } = require("../fixtures/aidd-ui/project.js");
const { load } = require(path.join(LIB, "project.cjs"));
const { showcaseOf, LABELS } = require(path.join(LIB, "showcase.cjs"));

// A French showcase is read by a person who does not code: what the engine writes on it is French, and
// no page shows a path, a rule code or a check message. The project's own words are left as written.

let tmp;

beforeEach(() => {
  tmp = makeTmp("aidd-ui-showcase-language-");
  writeProject(tmp);
});

afterEach(() => removeTmp(tmp));

const SET = {
  id: "layout",
  rows: [],
  axes: ["Tone"],
  fingerprint: "f1",
  problems: [],
  variants: ["a", "b"].map((name) => ({ name, intent: `Intent ${name}`, axes: [["Tone", name]], files: [{ path: "preview.html", text: `<html><body><p>${name}</p></body></html>` }, { path: "screens/home.md", text: `---\nid: home\nroute: /home/${name}\nstates: [default, focus]\n---\n\n# Home ${name}\n` }] })),
};
const PROBLEM = { rule: "V6", severity: "warning", file: `${UI}/screens/home.md`, message: "a literal pixel value", fix: "replace it with a token" };
const pagesOf = (lang) => showcaseOf({ project: load(tmp), problems: [PROBLEM], tokens: ":root { --accent: #123456; }\n", captures: new Set(), lang, sets: [SET] });

/** What a person reads or hears on a page: its text and the attributes a screen reader speaks, outside scripts and styles. */
function readOf(html) {
  const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "");
  const texts = [...body.matchAll(/>([^<]+)</g)].map((match) => match[1].trim()).filter(Boolean);
  const spoken = [...body.matchAll(/\s(?:title|alt|aria-label|placeholder)="([^"]*)"/g)].map((match) => match[1]);
  return { texts, spoken, all: texts.concat(spoken) };
}

// A record file always sits in a folder; a bare name ending in .md is a token, as space.md.
const PATH = /[\w-]+\/[\w./-]+\.\w+|\b[\w-]+\.(?:tsx?|jsx?|png|svg|html)\b|#\w+@\d/;

describe("a French showcase", () => {
  it("holds every source of an engine-written word, so the checks below cannot pass on an empty page", () => {
    const pages = pagesOf("fr");
    assert.ok(pages["_set-layout.html"], "a set has its page");
    assert.match(pages["home.html"], /class="capture missing"/, "a coded screen without its capture");
    assert.match(pages["home.html"], /data-state="focus"|data-tab="focus"|tab-focus/, "a state the French names may miss");
    assert.ok(load(tmp).records.some(({ frontMatter }) => frontMatter.route !== undefined && frontMatter.code !== undefined), "a screen with a route and a code link");
  });

  it("shows no path on any page", () => {
    for (const [name, html] of Object.entries(pagesOf("fr"))) {
      if (!name.endsWith(".html")) continue;
      for (const text of readOf(html).all) assert.doesNotMatch(text, PATH, `${name}: ${text}`);
    }
  });

  it("names a variant by a label a person reads, never by its id, on its set page and in the drawer", () => {
    const set = { ...SET, variants: SET.variants.map((variant, at) => ({ ...variant, name: ["ami-d-abord", "envoi-direct"][at] })) };
    const pages = showcaseOf({ project: load(tmp), problems: [], tokens: ":root { --accent: #123456; }\n", captures: new Set(), lang: "fr", sets: [set] });
    for (const file of ["_set-layout.html", "index.html"]) {
      const { all } = readOf(pages[file]);
      assert.ok(all.some((text) => text.includes("Ami d'abord")), `${file} reads the label`);
      assert.ok(!all.some((text) => /ami-d-abord|envoi-direct/.test(text)), `${file} reads no variant id`);
    }
  });

  it("shows no front matter of a variant's record on its set page", () => {
    const set = readOf(pagesOf("fr")["_set-layout.html"]).all;
    assert.ok(set.some((text) => text.includes("Home a")), "the variant's record is on the page");
    for (const text of set) assert.ok(!/^(route|states|id)$|\/home\/|\[default, focus\]/.test(text), text);
  });

  it("shows no rule code nor check message, nor the route and code links of a screen", () => {
    const home = readOf(pagesOf("fr")["home.html"]).all;
    const words = home.flatMap((text) => text.split(/\s+/));
    for (const word of [PROBLEM.rule, "route", "code"]) assert.ok(!words.includes(word), word);
    for (const sentence of [PROBLEM.message, PROBLEM.fix]) assert.ok(!home.some((text) => text.includes(sentence)), sentence);
  });

  it("names each state by its French name where a person reads or hears it", () => {
    const named = Object.keys(LABELS.fr.stateNames);
    const states = new Set(load(tmp).records.flatMap(({ frontMatter }) => [].concat(frontMatter.states ?? [])));
    for (const state of states) assert.ok(named.includes(state), `no French name for ${state}`);
    for (const [name, html] of Object.entries(pagesOf("fr"))) {
      if (!name.endsWith(".html")) continue;
      for (const text of readOf(html).spoken) for (const state of states) if (LABELS.fr.stateNames[state] !== state) assert.doesNotMatch(text.replaceAll(LABELS.fr.stateNames[state], ""), new RegExp(`(^|\\s)${state}(\\s|$)`), `${name}: ${text}`);
    }
  });

  it("names a light and a dark theme in French, and keeps any other theme as written", () => {
    const options = (html) => [...html.matchAll(/<select data-axis="theme">([\s\S]*?)<\/select>/g)].flatMap((match) => [...match[1].matchAll(/>([^<]+)</g)].map((each) => each[1]));
    assert.deepEqual([...new Set(options(pagesOf("fr")["button.html"]))], ["clair", "sombre"]);
    assert.deepEqual([...new Set(options(pagesOf("en")["button.html"]))], ["light", "dark"]);
  });

  it("words the review flow in French, in the bar of a record and in the drawer's confirmation", () => {
    const keys = ["confirmAll", "confirmAllOne", "cancel", "reviewed", "nextState", "nextRecord", "backToOverview"];
    for (const key of keys) assert.ok(LABELS.en[key] && LABELS.fr[key] && LABELS.en[key] !== LABELS.fr[key], key);
    const pages = pagesOf("fr");
    const bar = pages["home.html"].match(/<div class="verdict-bar"[\s\S]*?<\/div>\s*<\/section>/)[0];
    const heard = readOf(bar).all.join(" | ");
    assert.ok(heard.includes(LABELS.fr.nextState), heard);
    assert.match(bar, /class="reviewed"[^>]*>\d+\/\d+ états revus</);
    assert.ok(bar.includes(`data-next="${LABELS.fr.nextRecord}"`) && bar.includes(`data-overview="${LABELS.fr.backToOverview}"`));
    const drawer = pages["index.html"].match(/<aside class="drawer"[\s\S]*?<\/aside>/)[0];
    assert.ok(drawer.includes(`data-confirm="${LABELS.fr.confirmAll}"`) && readOf(drawer).all.includes(LABELS.fr.cancel));
  });

  it("writes none of the English labels the engine translates", () => {
    const english = Object.entries(LABELS.en).filter(([key, value]) => typeof value === "string" && value !== LABELS.fr[key]).flatMap(([, value]) => value.split(/\{\w+\}/)).map((piece) => piece.trim()).filter((piece) => piece.length >= 5);
    for (const [name, html] of Object.entries(pagesOf("fr"))) {
      if (!name.endsWith(".html")) continue;
      for (const text of readOf(html).all) for (const piece of english) assert.ok(!text.includes(piece), `${name}: "${piece}" in "${text}"`);
    }
  });
});
