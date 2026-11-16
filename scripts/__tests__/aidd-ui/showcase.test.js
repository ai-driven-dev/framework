const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { UI, LIB, makeTmp, removeTmp, filesUnder, engine, validate, writeProject, put, edit, editTokens, record } = require("../fixtures/aidd-ui/project.js");
const { load } = require(path.join(LIB, "project.cjs"));
const colour = require(path.join(LIB, "colour.cjs"));
const { showcaseOf, copiedOf, keptOf, WIDTH, LABELS } = require(path.join(LIB, "showcase.cjs"));

// The showcase is a pure module that renders pages and a command that writes them: the pages are
// judged as text, and the command as a subprocess, as the skill calls it.
const PAGE_IDS = ["brand", "button", "dialog", "home", "icon-search", "old-button", "onboarding", "search-flow", "search-field", "system"];
const SHOWCASE = `${UI}/showcase`;
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const REVIEW_FILE = `${UI}/reviews/first-pass.md`;
const HOME_STATES = ["default", "empty", "loading", "error"];
// The records with states and a render, in the order of the drawer, and how many states each holds.
const REVIEWABLE = [["search-field", 4], ["button", 4], ["old-button", 1], ["dialog", 4], ["home", 4], ["search-flow", 2]];

let tmp;

beforeEach(() => {
  tmp = makeTmp("aidd-ui-showcase-");
  writeProject(tmp);
});

afterEach(() => removeTmp(tmp));

const read = (name) => fs.readFileSync(path.join(tmp, name), "utf8");
const pagesOf = (options = {}) => showcaseOf({ project: load(tmp), problems: [], tokens: null, captures: new Set(), lang: "en", ...options });
const written = (...args) => {
  const run = engine("showcase", "--root", tmp, ...args);
  return { code: run.status, out: run.stdout, err: run.stderr };
};
/** Rewrites the review of the fixture with these rows, `[screen, state, version, verdict, comment]`, after the
 * brand and the system reviewed at their version. */
const verdicts = (...all) => {
  const rows = [["brand", "default", "1", "ok", ""], ["system", "default", "1", "ok", ""], ...all];
  const table = ["## Verdicts", "", "| Screen | State | Version | Verdict | Comment |", "| --- | --- | --- | --- | --- |", ...rows.map((cells) => `| ${cells.join(" | ")} |`)].join("\n");
  put(tmp, REVIEW_FILE, record(["id: first-pass", "kind: review", "status: proposed", "version: 1", "scope: system", "screens: [home]"], "# First pass", table));
};
const statesIn = (html) => [...html.matchAll(/<article class="state" data-state="([^"]+)"/g)].map((match) => match[1]);
const articleOf = (html, state) => html.match(new RegExp(`<article class="state" data-state="${state}"[\\s\\S]*?</article>`))[0];
const navOf = (html) => html.match(/<nav aria-label="[^"]*">[\s\S]*?<\/nav>/)[0];
const stepsOf = (html) => [...navOf(html).matchAll(/<li data-step="(\w+)" data-todo="(\d+)"><details( open)?>([\s\S]*?)<\/details><\/li>/g)].map((match) => ({ step: match[1], todo: match[2], open: Boolean(match[3]), html: match[4], mark: match[4].match(/class="step-mark"[^>]*>([^<]*)</)[1] }));
const todoOf = (html) => html.slice(html.indexOf('data-overview="todo"')).split('data-overview="revise"')[0];
const stepOf = (html, step) => stepsOf(html).find((each) => each.step === step);
const linksOf = (html, kind) => [...html.match(new RegExp(`<section class="links" data-links="${kind}">[\\s\\S]*?</section>`))[0].matchAll(/href="([^"]+)\.html"/g)].map((match) => match[1]);
const capture = (name) => put(tmp, `${UI}/screens/${name}`, PNG);
const unescaped = (text) => text.replaceAll("&quot;", '"').replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");
const cardsOf = (html) => [...html.match(/<section class="journey"[\s\S]*?<\/section>/)[0].matchAll(/<li class="card"[\s\S]*?<\/li>/g)].map((match) => match[0]);
const tabsOf = (html) => [...html.matchAll(/<button type="button" role="tab"[^>]*>/g)].map((match) => match[0]);
const attributeOf = (tag, name) => tag.match(new RegExp(`${name}="([^"]*)"`))?.[1];

const drawerOf = (html) => html.match(/<aside class="drawer" id="review"[\s\S]*?<\/aside>/)[0];
const itemsOf = (html) => [...drawerOf(html).matchAll(/<details class="item" data-record="([^"]+)" data-version="([^"]+)"([^>]*)>[\s\S]*?<\/details>/g)].map((match) => ({ record: match[1], version: match[2], attributes: match[3], html: match[0] }));
const rowOf = (html, record, state) => itemsOf(html).find((item) => item.record === record).html.match(new RegExp(`<li class="pstate" data-state="${state}"[\\s\\S]*?</li>`))[0];
const headerOf = (html) => html.match(/<header class="head">[\s\S]*?<\/header>/)[0];
const appearsOf = (html) => [...(html.match(/<section class="appears">[\s\S]*?<\/section>/)?.[0] ?? "").matchAll(/<a class="mini-card" href="([^"]+)\.html"><b>([^<]*)<\/b><span class="chip" data-status="([^"]+)">/g)].map((match) => match.slice(1));

describe("aidd-ui showcase", () => {
  describe("the pages", () => {
    it("holds the home page and one page for each record that is not a review", () => {
      assert.deepEqual(Object.keys(pagesOf()).sort(), ["index.html", ...PAGE_IDS.map((id) => `${id}.html`)].sort());
    });

    it("reaches every page from the home page", () => {
      const index = pagesOf()["index.html"];
      for (const id of PAGE_IDS) assert.ok(index.includes(`href="${id}.html"`), id);
    });

    it("lists a wireframe and a screen under the screens step, and a journey under its own", () => {
      const index = pagesOf()["index.html"];
      assert.ok(stepOf(index, "screens").html.includes('href="home.html"'));
      assert.ok(!stepOf(index, "screens").html.includes('href="search-flow.html"'), "the wireframe the screen dresses is reached from the screen");
      const bare = pagesOf();
      assert.ok(bare["search-flow.html"]);
      assert.ok(!stepOf(index, "journeys").html.includes("search-flow"));
      assert.ok(stepOf(index, "journeys").html.includes('href="onboarding.html"'));
    });

    it("names the five steps in the language, in both languages", () => {
      const names = (lang) => stepsOf(pagesOf({ lang })["index.html"]).map((each) => each.html.match(/<(?:span|a) class="step-name"[^>]*>([^<]*)</)[1]);
      assert.deepEqual(names("en"), ["Journeys", "Identity", "Foundations", "Elements", "Screens"]);
      assert.deepEqual(names("fr"), ["Parcours", "Identité", "Charte", "Éléments", "Écrans"]);
    });

    it("draws a wireframe state as labelled grey boxes, and no other record's", () => {
      const pages = pagesOf();
      const frameOf = (html) => html.match(/<iframe [^>]*srcdoc="([^"]*)"/)[1];
      assert.match(frameOf(pages["search-flow.html"]), /\[data-zone\]::before \{ content: attr\(data-zone\)/);
      assert.doesNotMatch(frameOf(pages["home.html"]), /data-zone/);
      assert.doesNotMatch(fs.readFileSync(path.join(tmp, `${UI}/wireframes/search-flow.html`), "utf8"), /<style/);
    });

    it("draws a journey as a storyboard: a card per step, linking its page, its action numbered under it, the last one too", () => {
      const cards = cardsOf(pagesOf()["onboarding.html"]);
      assert.deepEqual(cards.map((card) => card.match(/<a class="step" href="([^".]+)\.html/)?.[1]), ["home", "home", "search-flow"]);
      assert.deepEqual(cards.map((card) => card.match(/<p class="action"><span class="num">(\d+)<\/span>([^<]*)<\/p>/).slice(1)), [["1", "types a query"], ["2", "opens a result"], ["3", "narrows the results"]]);
    });

    it("shows each journey step as a live miniature of its record's default state, sketched for a wireframe", () => {
      const cards = cardsOf(pagesOf()["onboarding.html"]);
      for (const card of cards) assert.match(card, /<iframe [^>]*tabindex="-1"[^>]*srcdoc="/);
      const frames = cards.map((card) => unescaped(card.match(/srcdoc="([^"]*)"/)[1]));
      for (const frame of frames) assert.ok(frame.includes('[data-state]:not([data-state="default"])'), frame);
      assert.match(frames[2], /\[data-zone\]::before/);
      assert.doesNotMatch(frames[0], /\[data-zone\]::before/);
    });

    it("draws a journey step that names no record as a card with neither a link nor a miniature", () => {
      edit(tmp, `${UI}/journeys/onboarding.md`, "| search-flow | narrows", "| ghost | narrows");
      const ghost = cardsOf(pagesOf()["onboarding.html"])[2];
      assert.match(ghost, /<span class="screen">ghost<\/span>/);
      assert.doesNotMatch(ghost, /ghost\.html|<iframe/);
    });

    it("shows the persona as one line under the title, and leaves the Steps table and the Persona section out of the journey's text", () => {
      const page = pagesOf()["onboarding.html"];
      assert.match(headerOf(page), /<h1>Onboarding<\/h1><div class="stamp">[\s\S]*?<\/div><p class="persona">For a first-time analyst: An analyst opening the product for the first time, looking for one answer\.<\/p>/);
      assert.doesNotMatch(page, /<h2>Steps<\/h2>|<h2>Persona<\/h2>|<table|<section class="persona"/);
      assert.equal(page.match(/An analyst opening the product/g).length, 1);
    });

    it("writes the persona line from one template per language, a narrow no-break space before the French colon", () => {
      assert.equal(LABELS.en.persona, "For {name}: {said}");
      assert.equal(LABELS.fr.persona, "Pour {name}\u202f: {said}");
      assert.match(headerOf(pagesOf({ lang: "fr" })["onboarding.html"]), /<p class="persona">Pour a first-time analyst\u202f: An analyst/);
    });

    it("writes the persona line as its text alone when the text already opens with the persona's name", () => {
      edit(tmp, `${UI}/journeys/onboarding.md`, "An analyst opening", "A first-time analyst opening");
      assert.match(headerOf(pagesOf()["onboarding.html"]), /<p class="persona">A first-time analyst opening the product for the first time, looking for one answer\.<\/p>/);
    });

    it("holds no Uses row on a journey, whose storyboard already shows its screens", () => {
      assert.doesNotMatch(pagesOf()["onboarding.html"], /data-links="uses"/);
    });

    it("draws no journey chain on a record that is not a journey", () => {
      assert.doesNotMatch(pagesOf()["home.html"], /class="journey"/);
    });

    it("lists on the home page what awaits review as links, with no card and no miniature", () => {
      const index = pagesOf()["index.html"];
      assert.doesNotMatch(index, /<a class="card"|<iframe/);
      assert.deepEqual([...todoOf(index).matchAll(/<li data-id="([^"]+)">/g)].map((match) => match[1]).sort(), ["button", "dialog", "home", "old-button", "search-field", "search-flow"]);
      assert.doesNotMatch(todoOf(index), /<li data-id="(brand|system|onboarding)">/);
    });

    it("orders the navigation by step, one li per step", () => {
      const index = pagesOf()["index.html"];
      assert.match(navOf(index), /<ol class="steps">/);
      assert.deepEqual(stepsOf(index).map((each) => each.step), ["journeys", "identity", "foundations", "components", "screens"]);
    });

    it("lists what a record uses at the top, and where it appears at the bottom, from every field that cites an id", () => {
      const pages = pagesOf();
      assert.deepEqual(linksOf(pages["home.html"], "uses"), ["dialog", "search-field"]);
      assert.deepEqual(appearsOf(pages["home.html"]), [["onboarding", "Onboarding", "validated"]]);
      assert.deepEqual(appearsOf(pages["search-field.html"]).map(([id]) => id), ["home", "search-flow"]);
      assert.ok(!pages["home.html"].includes('href="first-pass.html"'));
      assert.doesNotMatch(pages["home.html"], /data-links="used-by"/);
    });

    it("puts the journeys a wireframe appears in at the very bottom of its page, as small cards with a title and a status", () => {
      const page = pagesOf()["search-flow.html"];
      assert.deepEqual(appearsOf(page), [["onboarding", "Onboarding", "validated"]]);
      const main = page.match(/<main>([\s\S]*)<\/main>/)[1];
      assert.ok(main.indexOf('<section class="appears">') > main.indexOf('<section class="review"'));
      assert.match(main, /<section class="appears">[\s\S]*<\/section>\s*$/);
    });

    it("marks a proposed record on its page, a validated one nowhere, and tags none in the navigation", () => {
      const pages = pagesOf();
      assert.match(pages["search-flow.html"], /<span class="chip" data-status="proposed">/);
      assert.doesNotMatch(navOf(pages["home.html"]), /class="tag"/);
      assert.match(pages["home.html"], /<span class="chip" data-status="validated">/);
    });

    it("titles a page with its record's heading, its status and version stamped on the title line, and no id or kind chip", () => {
      const home = pagesOf()["home.html"];
      assert.deepEqual(home.match(/<h1[ >][^<]*<\/h1>/g), ["<h1>Home</h1>"]);
      assert.match(headerOf(home), /<div class="stamp"><span class="chip" data-status="validated">validated<\/span><span class="version">v1<\/span><\/div>/);
      assert.match(headerOf(home), /<div class="chips"><span class="chip" data-key="route">/);
      assert.doesNotMatch(home, /data-key="id"|data-key="kind"|data-key="version"/);
      assert.doesNotMatch(headerOf(home), /class="lede"/);
      assert.match(home, /<title>Home<\/title>/);
    });

    it("puts the record's description under its title, before the canvas, and not again in its text", () => {
      edit(tmp, `${UI}/wireframes/search-flow.md`, "# Search flow", "# Search flow\n\nLet an analyst narrow a search\nto one result.\n\n## Notes\n\nKept below.");
      const page = pagesOf()["search-flow.html"];
      assert.match(headerOf(page), /<h1>Search flow<\/h1><div class="stamp">[\s\S]*?<\/div><p class="lede">Let an analyst narrow a search to one result\.<\/p>/);
      assert.equal(page.match(/narrow a search/g).length, 1);
      assert.ok(page.indexOf('class="lede"') < page.indexOf('<section class="review"'));
      assert.match(page, /<p>Kept below\.<\/p>/);
    });

    it("shows the code links and the route of a screen as chips", () => {
      const home = pagesOf()["home.html"];
      assert.match(home, /<span class="chip" data-key="route"><span class="key">route<\/span>\/<\/span>/);
      assert.ok(home.includes('data-key="code"'));
      assert.ok(home.includes("src/ui/HomePage.tsx#HomePage@1"));
    });

    it("renders each state of a record in a frame that holds the tokens", () => {
      const home = pagesOf({ tokens: ":root { --space-md: 1rem; }\n" })["home.html"];
      assert.equal(statesIn(home).length, 4);
      assert.equal(home.match(/<iframe /g).length, 4);
      assert.ok(home.includes("--space-md: 1rem;"));
      assert.ok(!home.includes("../tokens.css"));
    });
  });

  describe("the title of the showcase", () => {
    it("calls the page the showcase, never the wireframe kind, in both languages", () => {
      assert.equal(LABELS.en.title, "Showcase");
      assert.equal(LABELS.fr.title, "La vitrine");
      for (const lang of ["en", "fr"]) assert.notEqual(LABELS[lang].title, LABELS[lang].wireframe, lang);
    });

    it("names the page in plain words, with no design system jargon, in both languages", () => {
      for (const lang of ["en", "fr"]) {
        const index = pagesOf({ lang })["index.html"];
        for (const shown of [index.match(/<title>([^<]*)<\/title>/)[1], index.match(/<h1>([^<]*)<\/h1>/)[1], LABELS[lang].title]) assert.doesNotMatch(shown, /design system|syst\u00e8me de design/i, lang);
      }
    });
  });

  describe("the frame of a platform", () => {
    const withPlatforms = (platforms) => put(tmp, `${UI}/system.md`, read(`${UI}/system.md`).replace(/platforms: \[[^\]]*\]/, `platforms: ${platforms}`));
    const platformsOf = (html) => [...html.matchAll(/<iframe [^>]*>/g)].map((match) => match[0].match(/data-platform="([^"]*)"/)?.[1]);

    it("marks each frame with the first platform the system declares", () => {
      withPlatforms("[mobile]");
      assert.deepEqual(platformsOf(pagesOf()["home.html"]), ["mobile", "mobile", "mobile", "mobile"]);
      withPlatforms("[web, mobile]");
      assert.deepEqual(platformsOf(pagesOf()["home.html"]), ["web", "web", "web", "web"]);
    });

    it("marks no frame when the system declares no platform", () => {
      withPlatforms("[]");
      assert.deepEqual(platformsOf(pagesOf()["home.html"]), [undefined, undefined, undefined, undefined]);
    });

    it("gives a mobile frame a phone's width and leaves the others fluid", () => {
      const html = pagesOf()["home.html"];
      assert.match(html, /\.state \.render iframe\[data-platform="mobile"\] \{ flex: 0 0 390px; inline-size: 390px; \}/);
      assert.doesNotMatch(html, /^\.state \.render iframe\[data-platform="web"\] \{/m);
      assert.ok(!html.includes("height: 320px"));
    });
  });

  describe("the width of a web screen", () => {
    const withPlatforms = (platforms) => put(tmp, `${UI}/system.md`, read(`${UI}/system.md`).replace(/platforms: \[[^\]]*\]/, `platforms: ${platforms}`));
    const groupOf = (html) => html.match(/<div class="twin"[^>]*role="group"[^>]*>[\s\S]*?<\/div>/)?.[0];
    const choicesOf = (group) => [...group.matchAll(/<button type="button" data-width="(\w+)" aria-pressed="(\w+)">([^<]+)<\/button>/g)].map((match) => match.slice(1));

    it("offers desktop, pressed, and phone on a record with web renders, in the language", () => {
      for (const [lang, words] of [["en", ["Width", "Desktop", "Phone"]], ["fr", ["Largeur", "Ordinateur", "Téléphone"]]]) {
        const group = groupOf(pagesOf({ lang })["home.html"]);
        assert.match(group, new RegExp(`aria-label="${words[0]}"`), lang);
        assert.deepEqual(choicesOf(group), [["desktop", "true", words[1]], ["phone", "false", words[2]]], lang);
        assert.deepEqual([LABELS[lang].width, LABELS[lang].desktop, LABELS[lang].phone], words, lang);
      }
    });

    it("sits inside the review, ahead of the tabs", () => {
      const html = pagesOf()["home.html"];
      const review = html.match(/<section class="review"[\s\S]*?<\/section>/)[0];
      assert.ok(review.indexOf('data-width="phone"') > 0 && review.indexOf('data-width="phone"') < review.indexOf('role="tablist"'));
    });

    it("is not offered where no web render is shown", () => {
      withPlatforms("[mobile]");
      assert.equal(groupOf(pagesOf()["home.html"]), undefined);
      withPlatforms("[]");
      assert.equal(groupOf(pagesOf()["home.html"]), undefined);
      withPlatforms("[web]");
      const pages = pagesOf();
      for (const name of ["index.html", "onboarding.html", "brand.html", "system.html", "icon-search.html"]) assert.equal(groupOf(pages[name]), undefined, name);
    });

    it("sets the web frames of the review to a phone's width, a fluid one on a narrow window", () => {
      const html = pagesOf()["home.html"];
      assert.match(html, /^\.review\[data-width="phone"\] \.state \.render iframe\[data-platform="web"\] \{ flex: 0 0 390px; inline-size: 390px; \}/m);
      assert.match(html, /^ {2}\.review\[data-width="phone"\] \.state \.render iframe\[data-platform="web"\] \{ flex: 0 1 390px; min-inline-size: 0; \}/m);
    });

    it("runs in the page of a review, and nowhere else", () => {
      const pages = pagesOf();
      assert.ok(pages["home.html"].includes(WIDTH));
      for (const name of ["index.html", "onboarding.html", "system.html"]) assert.ok(!pages[name].includes(WIDTH), name);
    });

    it("presses the chosen width and sets it on the review, going back to desktop", () => {
      const node = (dataset = {}) => {
        const own = { dataset, attrs: {}, listeners: {} };
        own.setAttribute = (name, value) => { own.attrs[name] = value; };
        own.addEventListener = (type, listener) => { own.listeners[type] = listener; };
        own.closest = (selector) => (selector === "[data-width]" && dataset.width ? own : null);
        return own;
      };
      const choices = [node({ width: "desktop" }), node({ width: "phone" })];
      const review = node();
      const group = node();
      group.querySelectorAll = () => choices;
      group.closest = (selector) => (selector === ".review" ? review : null);
      new Function("document", WIDTH)({ getElementById: (id) => (id === "width" ? group : null) });
      group.listeners.click({ target: choices[1] });
      assert.equal(review.dataset.width, "phone");
      assert.deepEqual(choices.map((each) => each.attrs["aria-pressed"]), ["false", "true"]);
      group.listeners.click({ target: choices[0] });
      assert.equal(review.dataset.width, "desktop");
      assert.deepEqual(choices.map((each) => each.attrs["aria-pressed"]), ["true", "false"]);
      group.listeners.click({ target: node() });
      assert.equal(review.dataset.width, "desktop");
    });
  });

  describe("the colours of the chrome", () => {
    const rootOf = (html) => {
      const block = html.match(/:root \{([^}]*)\}/)[1];
      return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]));
    };
    const ratio = (tokens, front, back) => colour.contrast(colour.parse(tokens[front]), colour.parse(tokens[back]));

    it("keeps every text colour readable on every ground it sits on, and a control edge visible", () => {
      const tokens = rootOf(pagesOf()["index.html"]);
      for (const front of ["text", "muted", "faint", "accent-text"]) {
        for (const back of ["bg", "surface", "sunken"]) assert.ok(ratio(tokens, front, back) >= 4.5, `${front} on ${back}: ${ratio(tokens, front, back).toFixed(2)}`);
      }
      assert.ok(ratio(tokens, "ok", "ok-soft") >= 4.5, "ok on its soft ground");
      assert.ok(ratio(tokens, "revise", "revise-soft") >= 4.5, "revise on its soft ground");
      assert.ok(colour.contrast(colour.parse("#ffffff"), colour.parse(tokens.accent)) >= 4.5, "a white label on the accent");
      assert.ok(ratio(tokens, "control", "surface") >= 3, "a control's edge on its ground");
    });

    it("keeps the chrome neutral: the accent is the text colour, no gradient mark", () => {
      const html = pagesOf()["index.html"];
      assert.equal(rootOf(html).accent, rootOf(html).text);
      assert.doesNotMatch(html, /linear-gradient\(135deg/);
    });
  });

  describe("the height of a frame", () => {
    const scriptOf = (html) => html.match(/<script>([\s\S]*)<\/script>/)[1];

    it("fits again when the content of a frame changes size and when the window resizes", () => {
      const script = scriptOf(pagesOf()["home.html"]);
      assert.match(script, /new ResizeObserver\(/);
      assert.match(script, /\.observe\(root\)/);
      assert.match(script, /addEventListener\("resize"/);
    });
  });

  describe("the charte page", () => {
    const sheet = () => read(`${UI}/tokens.css`);
    const systemPage = (options = {}) => pagesOf({ tokens: sheet(), ...options })["system.html"];
    const idsIn = (html) => [...html.matchAll(/<section id="([^"]+)" aria-labelledby="([^"]+)"/g)].map((match) => match[1]);
    const sectionOf = (html, id) => html.match(new RegExp(`<section id="${id}" aria-labelledby[\\s\\S]*?</section>`))[0];
    const subOf = (html, page) => [...navOf(html).matchAll(new RegExp(`<a href="${page}\\.html#([^"]+)"`, "g"))].map((match) => match[1]);

    it("builds one native section per kind of token, each with its heading, in the order of the page", () => {
      const html = systemPage();
      assert.deepEqual(idsIn(html), ["palette", "roles", "typographie", "espacements", "points-de-rupture", "autres"]);
      for (const [, id, labelled] of html.matchAll(/<section id="([^"]+)" aria-labelledby="([^"]+)"/g)) assert.match(html, new RegExp(`<h2 id="${labelled}">[^<]+</h2>`), id);
    });

    it("writes each section a French heading and one plain sentence under it", () => {
      const html = systemPage({ lang: "fr" });
      for (const [id, title] of [["palette", "Palette"], ["roles", "Rôles"], ["typographie", "Typographie"], ["espacements", "Espacements"], ["points-de-rupture", "Points de rupture"], ["autres", "Autres réglages"]]) {
        assert.match(sectionOf(html, id), new RegExp(`<h2 id="${id}-title">${title}</h2><p class="lead">[^<]+\\.</p>`), id);
      }
    });

    it("shows a colour as a swatch of its resolved value, its token name after it", () => {
      const palette = sectionOf(systemPage(), "palette");
      assert.match(palette, /<li data-token="color\.brand\.primary"><i class="swatch" style="background: #336699"><\/i>/);
      assert.ok(palette.indexOf("swatch") < palette.indexOf("color.brand.primary</"), "the visual comes first");
    });

    it("keeps the roles apart from the palette, and says which token a role reads", () => {
      const html = systemPage();
      const roles = sectionOf(html, "roles");
      assert.ok(roles.includes('data-token="color.text.default"') && !roles.includes('data-token="color.brand.primary"'));
      assert.match(roles, /<li data-token="color\.text\.default">[\s\S]*?= color\.brand\.primary/);
    });

    it("draws a space as a square of its real size, in rem and in pixels", () => {
      const spaces = sectionOf(systemPage(), "espacements");
      assert.match(spaces, /<li data-token="space\.md"><i class="square" style="inline-size: 1rem; block-size: 1rem"><\/i>/);
      assert.ok(spaces.includes("1rem \u00b7 16 px"));
    });

    it("sets typography in one small frame that holds the stylesheet, and nothing else in a frame", () => {
      const html = systemPage();
      assert.equal([...html.matchAll(/<iframe /g)].length, 1);
      assert.ok(sectionOf(html, "typographie").includes("<iframe"));
      const frame = unescaped(html.match(/<iframe [^>]*srcdoc="([^"]*)"/)[1]);
      assert.ok(frame.includes("--space-md: 1rem"));
      assert.match(frame, /font-family: var\(--font-body\)/);
      assert.match(frame, /font-weight: var\(--font-weight-bold\)/);
    });

    it("stacks the label above the sample in a narrow frame, so a sample never wraps one word per line", () => {
      const frame = unescaped(systemPage().match(/<iframe [^>]*srcdoc="([^"]*)"/)[1]);
      assert.match(frame, /@media \(max-width: 600px\) \{[^}]*\.row \{ grid-template-columns: minmax\(0, 1fr\)/);
    });

    it("sets the typography frame bare, on the left edge of the other sections, not inside a second card", () => {
      const html = systemPage();
      assert.match(sectionOf(html, "typographie"), /<div class="render bare"><iframe/);
      const rule = html.match(/section\[id\] \.render\.bare \{([^}]*)\}/)[1];
      assert.match(rule, /border: 0/);
      assert.match(rule, /padding: 0/);
      assert.match(rule, /background: none/);
    });

    it("lists what no section claims in a plain name and value list, the token type never a heading", () => {
      editTokens(tmp, (tree) => (tree.misc = { ring: { $extensions: { "dev.ai-driven.css": "0 0 0 2px red" } } }));
      const html = systemPage();
      const others = sectionOf(html, "autres");
      for (const name of ["border.thin", "motion.fast", "misc.ring"]) assert.ok(others.includes(`data-token="${name}"`), name);
      assert.ok(others.includes("0 0 0 2px red"));
      assert.doesNotMatch(html, />(color|dimension|fontFamily|fontWeight|duration)</);
    });

    it("shows an alpha colour as its hex and its opacity", () => {
      editTokens(tmp, (tree) => (tree.color.brand.veil = { $type: "color", $value: { colorSpace: "srgb", components: [1, 0.4196, 0.2078], alpha: 0.0784, hex: "#ff6b35" } }));
      const veil = sectionOf(systemPage(), "palette").match(/<li data-token="color\.brand\.veil">[\s\S]*?<\/li>/)[0];
      assert.equal(veil.match(/<span class="value">([^<]*)</)[1], "#ff6b35 \u00b7 8%");
    });

    describe("the contrast grid", () => {
      const withRoles = () => editTokens(tmp, (tree) => {
        const hex = (value) => ({ $type: "color", $value: { colorSpace: "srgb", components: [0, 0, 0], hex: value } });
        Object.assign(tree.color, { background: hex("#ffffff"), "text-soft": hex("#7f7f7f"), accent: hex("#e4572e"), "text-on-accent": hex("#1f1a17"), border: hex("#cccccc"), focus: hex("#1f5fd1") });
      });
      const cellOf = (html, fg, bg) => sectionOf(html, "roles").match(new RegExp(`<td data-fg="color\\.${fg}" data-bg="color\\.${bg}"[^>]*>[\\s\\S]*?</td>`))[0];

      it("reads a text colour on its ground in words and a ratio, a comma for decimals in French", () => {
        withRoles();
        const fr = systemPage({ lang: "fr" });
        assert.match(cellOf(fr, "text-soft", "background"), /data-verdict="large"[\s\S]*>4,00:1<[\s\S]*>AA gros texte</);
        assert.match(cellOf(fr, "text-on-accent", "accent"), /data-verdict="aa"[\s\S]*>4,68:1<[\s\S]*>AA</);
        assert.match(cellOf(systemPage(), "text-on-accent", "accent"), />4\.68:1</);
        assert.match(cellOf(fr, "border", "background"), /data-verdict="fail"[\s\S]*>insuffisant</);
        assert.match(cellOf(fr, "focus", "background"), /data-verdict="aa"/);
      });

      it("shows a border or a focus colour as a line or a ring on the ground, never as text, judged at 3:1", () => {
        withRoles();
        const html = systemPage({ lang: "fr" });
        const border = cellOf(html, "border", "background");
        const focus = cellOf(html, "focus", "background");
        assert.match(border, /<span class="pair-line" style="background: #ffffff"><i style="background: #cccccc"><\/i><\/span>/);
        assert.match(focus, /<span class="pair-ring" style="background: #ffffff"><i style="border-color: #1f5fd1"><\/i><\/span>/);
        for (const cell of [border, focus]) assert.doesNotMatch(cell, />Aa</);
        assert.match(border, /insuffisant/);
        assert.match(cellOf(html, "text-soft", "background"), />Aa</);
      });

      it("lets the grid scroll inside its own wrapper", () => {
        assert.match(systemPage(), /\.scroll \{ overflow-x: auto; max-inline-size: 100%; \}/);
      });

      it("shows each pair in its own colours, rows for the text, columns for the grounds, in a table with a caption", () => {
        withRoles();
        const roles = sectionOf(systemPage({ lang: "fr" }), "roles");
        assert.match(roles, /<table class="contrast"><caption>Contraste des couleurs de texte sur leurs fonds<\/caption>/);
        assert.match(cellOf(systemPage(), "text-on-accent", "accent"), /style="color: #1f1a17; background: #e4572e"[^>]*>Aa</);
        assert.match(roles, /<th scope="row">color\.text-soft<\/th>/);
        assert.match(roles, /<th scope="col">color\.accent<\/th>/);
      });

      it("draws no grid when no role is a text colour", () => {
        assert.doesNotMatch(sectionOf(systemPage(), "roles").replace(/color\.text\.default/g, ""), /<table class="contrast"/);
      });
    });

    describe("the breakpoint ruler", () => {
      const rulerOf = (html) => sectionOf(html, "points-de-rupture");

      it("draws one stop per breakpoint, in order of width, with no table words", () => {
        const ruler = rulerOf(systemPage({ lang: "fr" }));
        assert.match(ruler, /<ol class="ruler">/);
        assert.deepEqual([...ruler.matchAll(/<li data-breakpoint="([^"]+)"/g)].map((match) => match[1]), ["mobile", "desktop"]);
        assert.doesNotMatch(ruler, /\bName\b|\bQuery\b/);
      });

      it("reads an empty query as the default, up to the next width", () => {
        const ruler = rulerOf(systemPage({ lang: "fr" }));
        assert.match(ruler, /data-breakpoint="mobile"[\s\S]*?par défaut \(moins de 64rem\)/);
        assert.match(ruler, /data-breakpoint="desktop"[\s\S]*?\(min-width: 64rem\)[\s\S]*?1024 px/);
      });
    });

    it("keeps the breakpoints and no token section without a stylesheet", () => {
      const html = systemPage({ tokens: null });
      assert.deepEqual(idsIn(html), ["points-de-rupture"]);
      assert.ok(!html.includes("<iframe"));
    });

    it("holds no theme and platform bar: every value shown is the base one", () => {
      assert.doesNotMatch(systemPage(), /class="toolbar"|data-axis=/);
    });

    it("links each section from the navigation under its step, and each link to a section, for the charte and the identity", () => {
      for (const lang of ["en", "fr"]) {
        const pages = pagesOf({ tokens: sheet(), lang });
        const nav = navOf(pages["home.html"]);
        for (const page of ["system", "brand"]) {
          const linked = subOf(pages["home.html"], page);
          assert.ok(linked.length > 0, `${page} has anchors`);
          assert.deepEqual(linked, idsIn(pages[`${page}.html`]), `${page}: nav and page list the same sections in the same order`);
        }
        assert.match(nav, /<ul class="sub">/);
      }
    });

    it("gives the identity a section per heading of the brand, named in the language", () => {
      const html = pagesOf({ lang: "fr" })["brand.html"];
      assert.deepEqual(idsIn(html).slice(0, 3), ["project", "users", "domain"]);
      assert.match(html, /<h2 id="project-title">Projet<\/h2>/);
      assert.match(navOf(pagesOf({ lang: "fr" })["home.html"]), /<a href="brand\.html#project">Projet<\/a>/);
    });

    it("highlights the section being read: the script sets aria-current to location from an observer", () => {
      const script = systemPage().match(/<script>([\s\S]*?)<\/script>/)[1];
      assert.match(script, /new IntersectionObserver\(/);
      assert.match(script, /"aria-current", "location"/);
      assert.match(script, /rootMargin: "0px 0px -70% 0px"/);
    });
  });

  describe("the system font floor", () => {
    const FLOOR = ":where(html) { font-family: system-ui, sans-serif; }";

    it("opens each state frame with the floor, before the render's own rules, with or without tokens", () => {
      for (const tokens of [":root { --space-md: 1rem; }\n", null]) {
        const frames = [...pagesOf({ tokens })["home.html"].matchAll(/srcdoc="([^"]*)"/g)].map((match) => match[1]);
        assert.equal(frames.length, 4);
        for (const frame of frames) assert.ok(frame.includes(FLOOR) && frame.indexOf(FLOOR) < frame.indexOf(".ui {"), frame);
      }
    });
  });

  describe("the command", () => {
    it("writes the pages and a gitignore that leaves them out, then lists them", () => {
      const run = written();
      assert.equal(run.code, 0, run.err);
      const files = filesUnder(path.join(tmp, SHOWCASE)).map((file) => path.relative(path.join(tmp, SHOWCASE), file)).sort();
      assert.deepEqual(files, [".gitignore", "index.html", ...PAGE_IDS.map((id) => `${id}.html`)].sort());
      assert.equal(read(`${SHOWCASE}/.gitignore`), "*\n");
      assert.deepEqual(JSON.parse(run.out), { page: `${SHOWCASE}/index.html`, pages: PAGE_IDS.length + 1, lang: "en" });
    });

    it("leaves a design system that still validates", () => {
      written();
      assert.deepEqual(validate(tmp), { code: 0, out: ["VALID"], err: "" });
    });

    it("writes two generations identical to the byte", () => {
      written();
      const first = filesUnder(path.join(tmp, SHOWCASE)).map((file) => [file, fs.readFileSync(file, "utf8")]);
      written();
      const second = filesUnder(path.join(tmp, SHOWCASE)).map((file) => [file, fs.readFileSync(file, "utf8")]);
      assert.deepEqual(second, first);
    });

    it("removes the page of a record that is gone", () => {
      written();
      assert.ok(fs.existsSync(path.join(tmp, SHOWCASE, "onboarding.html")));
      fs.rmSync(path.join(tmp, UI, "journeys/onboarding.md"));
      written();
      assert.ok(!fs.existsSync(path.join(tmp, SHOWCASE, "onboarding.html")));
      assert.ok(fs.existsSync(path.join(tmp, SHOWCASE, "home.html")));
    });

    it("reads the captures beside the records, a png that is no record staying out of the pages", () => {
      capture("home.default@1.png");
      written();
      assert.ok(read(`${SHOWCASE}/home.html`).includes('src="../screens/home.default@1.png"'));
      assert.ok(!fs.existsSync(path.join(tmp, SHOWCASE, "home.default@1.png.html")));
    });

    it("refuses without a design system, and on an argument it does not know", () => {
      const empty = makeTmp("aidd-ui-showcase-empty-");
      const refused = engine("showcase", "--root", empty);
      assert.deepEqual([refused.status, refused.stdout], [2, ""]);
      removeTmp(empty);
      const usage = engine("showcase", "extra", "--root", tmp);
      assert.deepEqual([usage.status, usage.stderr], [2, "usage: node aidd-ui.cjs showcase [--lang <code>] [--root <dir>]\n"]);
    });

    it("holds no script that reaches out: no request, and no storage but the browser's own local one", () => {
      for (const [name, html] of Object.entries(pagesOf())) {
        for (const reaching of ["http://", "https://", "fetch(", "XMLHttpRequest", "WebSocket", "sendBeacon", "sessionStorage", "indexedDB", "document.cookie"]) assert.ok(!html.includes(reaching), `${name} ${reaching}`);
      }
    });
  });

  describe("the review", () => {
    it("shows a verdict set at the current version as it is", () => {
      verdicts(["home", "default", "1", "ok", ""], ["home", "default", "0", "revise", "old"]);
      const article = articleOf(pagesOf()["home.html"], "default");
      assert.match(article, /data-current="ok"/);
      assert.doesNotMatch(article, /class="outdated"/);
    });

    it("shows a verdict of an older version as outdated, and does not count it", () => {
      verdicts(["home", "default", "1", "ok", ""], ["home", "loading", "0", "ok", ""]);
      const home = pagesOf()["home.html"];
      const article = articleOf(home, "loading");
      assert.match(article, /data-current="none"/);
      assert.match(article, /<p class="outdated" data-version="0">outdated, v0<\/p>/);
      assert.doesNotMatch(home, /class="count"/);
    });

    it("keeps one tally, the drawer's, and none above the tabs", () => {
      verdicts(["home", "default", "1", "ok", ""]);
      const home = pagesOf()["home.html"];
      assert.doesNotMatch(home, /class="count"|\d+\/\d+ OK/);
    });

    it("lets the review drawer float over the page instead of narrowing it", () => {
      const home = pagesOf()["home.html"];
      assert.doesNotMatch(home, /reviewing/);
      assert.match(home, /\.drawer \{ position: fixed;/);
    });

    it("shows the comment of a verdict, and a pending one as pending", () => {
      verdicts(["home", "loading", "1", "revise", "spinner too small"], ["home", "error", "1", "pending", ""]);
      const home = pagesOf()["home.html"];
      assert.match(articleOf(home, "loading"), /data-current="revise"[\s\S]*<p class="said">spinner too small<\/p>/);
      assert.match(articleOf(home, "error"), /data-current="pending"/);
    });

    it("shows a revise over an ok at the same version, in either order", () => {
      verdicts(["home", "default", "1", "ok", ""], ["home", "default", "1", "revise", "too pale"]);
      assert.match(articleOf(pagesOf()["home.html"], "default"), /data-current="revise"[\s\S]*<p class="said">too pale<\/p>/);
      verdicts(["home", "default", "1", "revise", "too pale"], ["home", "default", "1", "ok", ""]);
      assert.match(articleOf(pagesOf()["home.html"], "default"), /data-current="revise"[\s\S]*<p class="said">too pale<\/p>/);
    });

    it("never lets a pending row hide a verdict set at the same version, as the publication reads it", () => {
      verdicts(["home", "default", "1", "ok", ""], ["home", "default", "1", "pending", ""]);
      const home = pagesOf()["home.html"];
      assert.match(articleOf(home, "default"), /data-current="ok"/);
      assert.doesNotMatch(home, /class="count"/);
    });

    it("puts the states with no verdict or a pending one first, the others in the record's order", () => {
      verdicts(["home", "default", "1", "ok", ""], ["home", "empty", "1", "ok", ""], ["home", "loading", "0", "ok", ""], ["home", "error", "1", "pending", ""]);
      assert.deepEqual(statesIn(pagesOf()["home.html"]), ["loading", "error", "default", "empty"]);
    });

    it("keeps the record's order when no state is reviewed or all are", () => {
      verdicts();
      assert.deepEqual(statesIn(pagesOf()["home.html"]), ["default", "empty", "loading", "error"]);
      verdicts(...HOME_STATES.map((state) => ["home", state, "1", "ok", ""]));
      assert.deepEqual(statesIn(pagesOf()["home.html"]), HOME_STATES);
    });

    it("puts the capture of a coded screen beside the render of the state", () => {
      const home = pagesOf({ captures: new Set(["screens/home.default@1.png"]) })["home.html"];
      assert.match(articleOf(home, "default"), /<figure class="capture" data-file="screens\/home\.default@1\.png"><img src="\.\.\/screens\/home\.default@1\.png"/);
    });

    it("names the path to save when the capture is missing", () => {
      const article = articleOf(pagesOf({ captures: new Set(["screens/home.default@1.png"]) })["home.html"], "empty");
      assert.match(article, /<div class="capture missing" data-file="screens\/home\.empty@1\.png">No capture. Save it at screens\/home\.empty@1\.png<\/div>/);
      assert.doesNotMatch(article, /<img /);
    });

    it("takes the capture of another version for no capture", () => {
      const article = articleOf(pagesOf({ captures: new Set(["screens/home.default@0.png"]) })["home.html"], "default");
      assert.match(article, /class="capture missing"/);
    });

    it("asks no capture of a screen whose code is at an earlier version", () => {
      edit(tmp, `${UI}/screens/home.md`, "HomePage@1", "HomePage@0");
      assert.doesNotMatch(pagesOf()["home.html"], /class="capture/);
    });

    it("asks no capture of a screen with no code, or of a record that is no screen", () => {
      edit(tmp, `${UI}/screens/home.md`, "code: src/ui/HomePage.tsx#HomePage@1\n", "");
      const pages = pagesOf();
      assert.doesNotMatch(pages["home.html"], /class="capture/);
      assert.doesNotMatch(pages["button.html"], /class="capture/);
      assert.doesNotMatch(pages["search-flow.html"], /class="capture/);
    });

    it("holds the engine checks of the record and of its render, and no other record's", () => {
      const problems = [
        { rule: "V1", severity: "error", file: `${UI}/screens/home.md`, message: "home record problem", fix: "f" },
        { rule: "V2", severity: "error", file: `${UI}/screens/home.html`, message: "home render problem", fix: "f" },
        { rule: "V3", severity: "error", file: `${UI}/components/button.md`, message: "button problem", fix: "f" },
      ];
      const pages = pagesOf({ problems });
      assert.ok(pages["home.html"].includes("home record problem") && pages["home.html"].includes("home render problem"));
      assert.ok(!pages["home.html"].includes("button problem"));
      assert.ok(pages["button.html"].includes("button problem") && !pages["button.html"].includes("home record problem"));
      assert.match(pages["home.html"], /<li data-rule="V1">/);
    });

    describe("the order of a record page", () => {
      const problems = [{ rule: "V1", severity: "error", file: `${UI}/screens/home.md`, message: "m", fix: "f" }];
      const positions = (html) => ["<section class=\"review\"", "<article class=\"doc\"", "<section class=\"appears\"", "<details class=\"checks\""].map((marker) => html.indexOf(marker));

      it("puts the review, then the prose, then where it appears, then the checks for developers last", () => {
        for (const id of ["button", "home"]) {
          const at = positions(pagesOf({ problems: [{ ...problems[0], file: `${UI}/${id === "home" ? "screens" : "components"}/${id}.md` }] })[`${id}.html`]);
          assert.ok(at.every((place) => place >= 0), `${id} holds all four: ${at}`);
          assert.deepEqual([...at].sort((a, b) => a - b), at, id);
        }
      });

      it("sets the prose bare, at the width of a line, and where it appears as a grid of cards", () => {
        const html = pagesOf()["button.html"];
        const ruleOf = (selector) => html.match(new RegExp(`\\n${selector.replaceAll(".", "\\.")} \\{([^}]*)\\}`))[1];
        assert.match(ruleOf(".doc"), /max-width: 68ch/);
        assert.doesNotMatch(ruleOf(".doc"), /background|border: 1px/);
        assert.match(ruleOf(".appears ul"), /grid-template-columns: repeat\(auto-fill, minmax\(200px, 1fr\)\)/);
      });
    });

    it("folds the engine checks into a closed block named for developers, with their count", () => {
      const problems = [
        { rule: "V1", severity: "error", file: `${UI}/screens/home.md`, message: "home record problem", fix: "f" },
        { rule: "V2", severity: "error", file: `${UI}/screens/home.html`, message: "home render problem", fix: "f" },
      ];
      const block = (html) => html.match(/<details class="checks"[^>]*>[\s\S]*?<\/details>/)[0];
      assert.match(block(pagesOf({ problems })["home.html"]), /^<details class="checks"><summary>For developers \(2\)<\/summary>/);
      assert.match(block(pagesOf({ problems, lang: "fr" })["home.html"]), /^<details class="checks"><summary>Pour les d\u00e9veloppeurs \(2\)<\/summary>/);
      assert.doesNotMatch(pagesOf({ problems })["button.html"], /class="checks"/);
    });

    it("shows what a record uses by title, not by id", () => {
      const home = pagesOf()["home.html"];
      const block = home.match(/<section class="links" data-links="uses">[\s\S]*?<\/section>/)[0];
      const shown = [...block.matchAll(/<a href="([^"]+)\.html">([^<]*)<\/a>/g)].map((match) => [match[1], match[2]]);
      assert.deepEqual(shown, [["dialog", "Dialog"], ["search-field", "Search field"]]);
    });

    it("writes the section headings of a record in the language, the record staying in English", () => {
      const keep = "## Usage\n\ntext\n\n## Keyboard\n\ntext\n\n## Breakpoints\n\ntext\n\n## Something else\n\ntext\n";
      put(tmp, `${UI}/components/button.md`, `${read(`${UI}/components/button.md`)}\n${keep}`);
      const headings = (html) => [...html.match(/<article class="doc">[\s\S]*?<\/article>/)[0].matchAll(/<h2>([^<]*)<\/h2>/g)].map((match) => match[1]);
      assert.deepEqual(headings(pagesOf()["button.html"]).slice(-4), ["Usage", "Keyboard", "Breakpoints", "Something else"]);
      assert.deepEqual(headings(pagesOf({ lang: "fr" })["button.html"]).slice(-4), ["Utilisation", "Clavier", "Points de rupture", "Something else"]);
      assert.ok(read(`${UI}/components/button.md`).includes("## Usage"));
    });

    it("leaves the expected-component check out of a page, the engine still reports it", () => {
      const problems = [
        { rule: "R18", severity: "warning", file: `${UI}/wireframes/search-flow.md`, message: "expected component", fix: "f" },
        { rule: "V13", severity: "warning", file: `${UI}/wireframes/search-flow.md`, message: "same markup", fix: "f" },
      ];
      const page = pagesOf({ problems })["search-flow.html"];
      assert.doesNotMatch(page, /data-rule="R18"/);
      assert.match(page, /data-rule="V13"/);
    });

    it("holds the review only on a record with states and a render", () => {
      const pages = pagesOf();
      for (const id of ["home", "button", "search-flow"]) assert.match(pages[`${id}.html`], /<section class="review" data-record="/, id);
      for (const id of ["brand", "system", "onboarding", "icon-search", "index"]) assert.doesNotMatch(pages[`${id}.html`], /<section class="review"/, id);
    });

    it("keeps no verdict under the canvas: no choice, no comment field, no state name repeated beside the tabs", () => {
      const home = pagesOf()["home.html"];
      for (const state of HOME_STATES) assert.doesNotMatch(articleOf(home, state), /class="verdict"|<textarea|<h3>/, state);
      assert.doesNotMatch(home.match(/<section class="review"[\s\S]*?<\/section>/)[0], /id="copy"/);
    });

    it("shows the states as tabs in the order of the review, the first open and the others hidden", () => {
      verdicts(["home", "default", "1", "ok", ""]);
      const home = pagesOf()["home.html"];
      const tabs = tabsOf(home);
      assert.deepEqual(tabs.map((tab) => attributeOf(tab, "data-tab")), statesIn(home));
      assert.deepEqual(tabs.map((tab) => attributeOf(tab, "aria-selected")), ["true", "false", "false", "false"]);
      statesIn(home).forEach((state, at) => {
        const open = articleOf(home, state).match(/^<article [^>]*>/)[0];
        assert.equal(attributeOf(open, "id"), attributeOf(tabs[at], "aria-controls"), state);
        assert.equal(/ hidden[ >]/.test(open), at > 0, state);
      });
    });
  });

  describe("the review panel", () => {
    it("opens from a My review button at the foot of the sidebar on every page, naming how many records await review", () => {
      verdicts(["home", "default", "1", "ok", ""], ["home", "loading", "1", "revise", "too small"], ["home", "error", "1", "pending", ""], ["button", "default", "0", "ok", ""]);
      for (const [name, html] of Object.entries(pagesOf())) {
        assert.match(navOf(html), /<div class="review-foot"><button type="button" class="open-review" id="open-review" aria-controls="review" aria-expanded="false"><span class="label">My review<\/span><span class="tally pending" data-template="\{count\} to review">\d+ to review<\/span><\/button><\/div><\/nav>$/, name);
        assert.equal(html.match(/id="open-review"/g).length, 1, name);
        assert.equal(html.match(/<aside class="drawer" id="review"/g).length, 1, name);
        assert.equal(html.match(/id="copy"/g).length, 1, name);
        assert.match(html, /<aside class="drawer" id="review" aria-label="My review" hidden>/, name);
        assert.match(html, /<div class="drawer-head"><h2>My review<\/h2>/, name);
      }
    });

    it("names the recap in French as Ma revue, beside the count", () => {
      for (const html of Object.values(pagesOf({ lang: "fr" }))) {
        assert.match(navOf(html), /id="open-review"[^>]*><span class="label">Ma revue<\/span><span class="tally pending" data-template="\{count\} \u00e0 relire">/);
        assert.match(html, /<aside class="drawer" id="review" aria-label="Ma revue" hidden>\s*<div class="drawer-head"><h2>Ma revue<\/h2>/);
      }
    });

    it("lists every record with states and a render, in the order of the navigation, the record of the page open", () => {
      const pages = pagesOf();
      assert.deepEqual(itemsOf(pages["index.html"]).map((item) => [item.record, item.version]), REVIEWABLE.map(([id]) => [id, id === "old-button" ? "2" : "1"]));
      for (const item of itemsOf(pages["index.html"])) assert.doesNotMatch(item.attributes, /open|data-here/, item.record);
      const open = itemsOf(pages["home.html"]).filter((item) => / open/.test(item.attributes)).map((item) => item.record);
      assert.deepEqual(open, ["home"]);
      assert.match(itemsOf(pages["home.html"]).find((item) => item.record === "home").attributes, /data-here/);
    });

    it("lists a brand with a version as one `default` row, until a verdict at that version settles it", () => {
      edit(tmp, `${UI}/brand.md`, "version: 1", "version: 2");
      const before = pagesOf()["index.html"];
      const item = itemsOf(before).find((each) => each.record === "brand");
      assert.equal(item.version, "2");
      assert.deepEqual([...item.html.matchAll(/<li class="pstate" data-state="([^"]+)"/g)].map((match) => match[1]), ["default"]);
      assert.equal(stepOf(before, "identity").mark, "1");
      verdicts(["brand", "default", "2", "ok", ""]);
      const after = pagesOf()["index.html"];
      assert.ok(!itemsOf(after).some((each) => each.record === "brand"));
      assert.equal(stepOf(after, "identity").mark, "\u2713");
    });

    it("gives each state of a record a verdict pair, a comment field and a link to its tab, in the order of the tabs", () => {
      verdicts(["home", "default", "1", "ok", ""]);
      const home = pagesOf()["home.html"];
      const item = itemsOf(home).find((each) => each.record === "home").html;
      assert.deepEqual([...item.matchAll(/<li class="pstate" data-state="([^"]+)"/g)].map((match) => match[1]), statesIn(home).filter((state) => state !== "default"));
      for (const state of HOME_STATES.filter((each) => each !== "default")) {
        const row = rowOf(home, "home", state);
        assert.deepEqual([...row.matchAll(/<button type="button" class="verdict" data-verdict="(\w+)" aria-pressed="false">/g)].map((match) => match[1]), ["ok", "revise"], state);
        assert.equal(row.match(/<textarea class="comment"[^>]* hidden/g).length, 1, state);
        assert.match(row, new RegExp(`<a class="pick" href="home\\.html#tab-${state}">${state}</a>`), state);
      }
      assert.doesNotMatch(item, /data-state="default"/);
    });

    it("shows the overview's progress on each record left, and nothing pre-checked nor a batch to copy", () => {
      verdicts(["button", "default", "1", "ok", ""], ["button", "hover", "1", "revise", "too pale"]);
      const index = pagesOf()["index.html"];
      assert.match(todoOf(index).match(/<li data-id="button">[\s\S]*?<\/li>/)[0], /<span class="progress" data-record="button" data-base="2" data-total="4">2\/4<\/span>/);
      assert.match(todoOf(index).match(/<li data-id="search-flow">[\s\S]*?<\/li>/)[0], /<span class="progress" data-record="search-flow" data-base="0" data-total="2">0\/2<\/span>/);
      assert.doesNotMatch(index, /type="checkbox"|checked|class="batch"|copy-all/);
    });

    it("counts the records awaiting review per step on the overview, not their states", () => {
      const index = pagesOf()["index.html"];
      const count = (step) => index.match(new RegExp(`<section class="todo-step" data-step="${step}"><h3>[^<]*<span>(\\d+)</span>`))[1];
      assert.equal(count("components"), "4");
      assert.equal(count("screens"), "1");
      assert.match(index, /<h2>To review \(5\)<\/h2>/);
      assert.doesNotMatch(index, /data-step="(journeys|identity|foundations)"><h3>/);
    });

    it("counts a screen and the wireframe it dresses once on the overview, a wireframe no screen dresses still apart", () => {
      const render = "<html><head></head><body><main data-state=\"default\">x</main></body></html>";
      put(tmp, `${UI}/wireframes/start.md`, record(["id: start", "kind: wireframe", "status: proposed", "version: 1", "states: [default]"], "# Start"));
      put(tmp, `${UI}/wireframes/start.html`, render);
      put(tmp, `${UI}/screens/start-screen.md`, record(["id: start-screen", "kind: screen", "status: proposed", "version: 1", "wireframe: start", "states: [default]"], "# Start"));
      put(tmp, `${UI}/screens/start-screen.html`, render);
      put(tmp, `${UI}/wireframes/bare.md`, record(["id: bare", "kind: wireframe", "status: proposed", "version: 1", "states: [default]"], "# Bare"));
      put(tmp, `${UI}/wireframes/bare.html`, render);
      const index = pagesOf()["index.html"];
      const count = (step) => index.match(new RegExp(`<section class="todo-step" data-step="${step}"><h3>[^<]*<span>(\\d+)</span>`))[1];
      assert.equal(count("screens"), "3");
      assert.match(index, /<h2>To review \(7\)<\/h2>/);
    });

    it("counts a screen and the wireframe it dresses once in the drawer too, and still lists both for a verdict", () => {
      const render = "<html><head></head><body><main data-state=\"default\">x</main></body></html>";
      put(tmp, `${UI}/wireframes/start.md`, record(["id: start", "kind: wireframe", "status: proposed", "version: 1", "states: [default]"], "# Start"));
      put(tmp, `${UI}/wireframes/start.html`, render);
      put(tmp, `${UI}/screens/start-screen.md`, record(["id: start-screen", "kind: screen", "status: proposed", "version: 1", "wireframe: start", "states: [default]"], "# Start"));
      put(tmp, `${UI}/screens/start-screen.html`, render);
      put(tmp, `${UI}/wireframes/bare.md`, record(["id: bare", "kind: wireframe", "status: proposed", "version: 1", "states: [default]"], "# Bare"));
      put(tmp, `${UI}/wireframes/bare.html`, render);
      const drawer = pagesOf()["index.html"].match(/<aside class="drawer"[\s\S]*?<\/aside>/)[0];
      assert.match(drawer, /data-step="screens"[^>]*>(?:(?!<\/summary>)[\s\S])*<span class="step-count">\(3\)<\/span>/);
      for (const id of ["start", "start-screen", "bare"]) assert.match(drawer, new RegExp(`<details class="item" data-record="${id}"`), id);
      assert.match(drawer, /data-record="start" data-version="1" data-dressed-by="start-screen"/);
      assert.doesNotMatch(drawer, /data-record="(start-screen|bare)"[^>]*data-dressed-by/);
    });

    it("takes a wireframe out of the review once a screen that dresses it is settled, and keeps its own page", () => {
      const render = "<html><head></head><body><main data-state=\"default\">x</main></body></html>";
      put(tmp, `${UI}/wireframes/start.md`, record(["id: start", "kind: wireframe", "status: proposed", "version: 1", "states: [default]"], "# Start"));
      put(tmp, `${UI}/wireframes/start.html`, render);
      put(tmp, `${UI}/screens/start-screen.md`, record(["id: start-screen", "kind: screen", "status: proposed", "version: 1", "wireframe: start", "states: [default]"], "# Start"));
      put(tmp, `${UI}/screens/start-screen.html`, render);
      put(tmp, `${UI}/screens/other-screen.md`, record(["id: other-screen", "kind: screen", "status: proposed", "version: 1", "wireframe: start", "states: [default]"], "# Other"));
      put(tmp, `${UI}/screens/other-screen.html`, render);
      put(tmp, `${UI}/wireframes/bare.md`, record(["id: bare", "kind: wireframe", "status: proposed", "version: 1", "states: [default]"], "# Bare"));
      put(tmp, `${UI}/wireframes/bare.html`, render);
      const first = pagesOf();
      assert.match(first["index.html"].match(/<aside class="drawer"[\s\S]*?<\/aside>/)[0], /data-record="start"/, "listed while no dressing screen is settled");
      verdicts(["start-screen", "default", "1", "ok", ""]);
      const pages = pagesOf();
      const index = pages["index.html"];
      const drawer = index.match(/<aside class="drawer"[\s\S]*?<\/aside>/)[0];
      assert.doesNotMatch(drawer, /data-record="start"/);
      assert.match(drawer, /data-record="bare"/);
      assert.match(drawer, /data-step="screens"[^>]*>(?:(?!<\/summary>)[\s\S])*<span class="step-count">\(3\)<\/span>/);
      assert.match(index, /<h2>To review \(7\)<\/h2>/);
      assert.match(pages["start.html"], /class="verdict"/, "its own page keeps the verdict buttons");
    });

    it("tells the dressed wireframe from its screen by the kind in its drawer title", () => {
      const render = "<html><head></head><body><main data-state=\"default\">x</main></body></html>";
      put(tmp, `${UI}/wireframes/start.md`, record(["id: start", "kind: wireframe", "status: proposed", "version: 1", "states: [default]"], "# Start"));
      put(tmp, `${UI}/wireframes/start.html`, render);
      put(tmp, `${UI}/screens/start-screen.md`, record(["id: start-screen", "kind: screen", "status: proposed", "version: 1", "wireframe: start", "states: [default]"], "# Start"));
      put(tmp, `${UI}/screens/start-screen.html`, render);
      for (const lang of ["en", "fr"]) {
        const drawer = pagesOf({ lang })["index.html"].match(/<aside class="drawer"[\s\S]*?<\/aside>/)[0];
        assert.match(drawer, new RegExp(`data-record="start-screen"[^>]*><summary><span>Start</span>`), lang);
        assert.match(drawer, new RegExp(`data-record="start"[^>]*><summary><span>Start \u00b7 ${LABELS[lang].wireframe}</span>`), lang);
      }
    });

    it("splits the elements awaiting review by category on the overview", () => {
      const index = pagesOf()["index.html"];
      const block = index.match(/<section class="todo-step" data-step="components">[\s\S]*?<\/section>/)[0];
      assert.deepEqual([...block.matchAll(/<h4 data-category="(\w+)">/g)].map((match) => match[1]).every((key) => ["input", "action", "display", "navigation", "group", "asset"].includes(key)), true);
      assert.ok(block.match(/<h4 /g).length >= 1);
    });

    it("draws the steps as a stepper in order, each with its state in words, replacing the meter", () => {
      const index = pagesOf()["index.html"];
      assert.doesNotMatch(index, /<meter/);
      const stepper = index.match(/<ol class="stepper">[\s\S]*?<\/ol>/)[0];
      const items = [...stepper.matchAll(/<li data-step="(\w+)" data-state="(\w+)">([\s\S]*?)<\/li>/g)];
      assert.deepEqual(items.map((match) => match[1]), ["journeys", "identity", "foundations", "components", "screens"]);
      const steps = stepsOf(index);
      for (const [, step, state, html] of items) {
        const held = steps.find((each) => each.step === step);
        assert.equal(state, held.todo !== "0" ? "todo" : held.mark === "\u2014" ? "empty" : "done", step);
        assert.match(html, /<span class="state">[^<]+<\/span>/, step);
      }
      assert.match(items.find((match) => match[1] === "components")[3], /<a href="[^"]+\.html">/);
    });

    it("says what awaits review and starts the review on the first record awaiting, by step order", () => {
      for (const [lang, word, status] of [["en", "Start the review", /\d+ to review, in /], ["fr", "Commencer la revue", /\d+ à relire, dans /]]) {
        const index = pagesOf({ lang })["index.html"];
        const start = index.match(/<a class="start" href="([^"]+)">([^<]*)<\/a>/);
        assert.equal(start[2], word, lang);
        assert.match(index.match(/<p class="lede">[\s\S]*?<\/p>/)[0], status, lang);
        const links = [...todoOf(index).matchAll(/<li data-id="[^"]+"><a href="([^"]+)">/g)].map((match) => match[1]);
        assert.ok(links.length > 1, "more than one record awaits");
        assert.equal(start[1], links[0], lang);
      }
    });


    it("lists a record with a state to rework under its own heading, hidden when there is none", () => {
      const revise = (html) => html.match(/<section class="overview" data-overview="revise">[\s\S]*?<\/section>/)?.[0];
      assert.match(revise(pagesOf()["index.html"]), /<h2>To rework \(\d+\)<\/h2>/);
      assert.match(revise(pagesOf()["index.html"]), /<li data-id="home">/);
      assert.equal(revise(pagesOf({ lang: "fr" })["index.html"]).match(/<h2>([^<]*)</)[1].startsWith("\u00c0 reprendre"), true);
    });

    it("offers marking the remaining states OK only as an explicit action of a step of the panel, never one for all", () => {
      for (const [lang, label] of [["en", "All OK"], ["fr", "Tout OK"]]) {
        const index = pagesOf({ lang })["index.html"];
        assert.deepEqual([...drawerOf(index).matchAll(/<button type="button" class="step-ok" data-step="(\w+)">([^<]*)<\/button>/g)].map((match) => [match[1], match[2]]), [["components", label], ["screens", label]]);
        assert.doesNotMatch(index, /id="all-ok"/);
      }
    });

    it("groups the drawer by step, only the steps with something left, the step of the page open", () => {
      const groupsOf = (html) => [...drawerOf(html).matchAll(/<details class="step-group" data-step="(\w+)"( open)?><summary><span class="step-name">([^<]*)<\/span><span class="step-count">\((\d+)\)<\/span>/g)].map((match) => [match[1], Boolean(match[2]), match[3], match[4]]);
      const pages = pagesOf();
      assert.deepEqual(groupsOf(pages["index.html"]), [["components", true, "Elements", "4"], ["screens", false, "Screens", "1"]]);
      assert.deepEqual(groupsOf(pages["home.html"]), [["components", false, "Elements", "4"], ["screens", true, "Screens", "1"]]);
      assert.deepEqual(groupsOf(pagesOf({ lang: "fr" })["button.html"]).map(([step, open, name]) => [step, open, name]), [["components", true, "\u00c9l\u00e9ments"], ["screens", false, "\u00c9crans"]]);
    });

    it("leaves a settled record out of the drawer, ok or revise alike, and its settled states out of a record kept", () => {
      verdicts(...HOME_STATES.map((state) => ["home", state, "1", "ok", ""]), ["button", "default", "1", "revise", "too pale"]);
      const index = pagesOf()["index.html"];
      assert.ok(!itemsOf(index).some((item) => ["home", "search-flow"].includes(item.record)));
      assert.equal(itemsOf(index).find((item) => item.record === "button")?.html.match(/class="pstate"/g).length, 3);
      assert.doesNotMatch(drawerOf(index), /data-step="screens"/);
    });

    it("counts the records and open sets awaiting review, not the states, in the button and in the drawer, in the language", () => {
      verdicts(["home", "default", "1", "ok", ""]);
      for (const [lang, text] of [["en", "5 to review"], ["fr", "5 \u00e0 relire"]]) {
        const index = pagesOf({ lang })["index.html"];
        assert.equal(index.match(new RegExp(`<span class="tally pending" data-template="[^"]+">${text}</span>`, "g")).length, 2, lang);
      }
    });

    it("carries a script that compiles on every page, holding the copy the review skill reads", () => {
      for (const [name, html] of Object.entries(pagesOf())) {
        const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
        assert.doesNotThrow(() => new Function(script), name);
        assert.ok(script.includes(copiedOf.toString()) && script.includes(keptOf.toString()), name);
      }
    });

    it("writes the same page twice", () => {
      assert.equal(pagesOf()["index.html"], pagesOf()["index.html"]);
      assert.equal(pagesOf()["home.html"], pagesOf()["home.html"]);
    });
  });

  describe("the review drawer", () => {
    const scriptOf = (html) => html.match(/<script>([\s\S]*)<\/script>/)[1];
    const css = () => pagesOf()["home.html"];

    it("tells why the copy is disabled, in the language, in the note under it", () => {
      assert.equal(LABELS.en.copyHint, "Give an opinion on at least one state.");
      assert.equal(LABELS.fr.copyHint, "Donnez un avis sur au moins un \u00e9tat.");
      for (const lang of ["en", "fr"]) {
        const html = pagesOf({ lang })["home.html"];
        assert.match(drawerOf(html), new RegExp(`<button type="button" id="copy"[^>]* data-hint="${LABELS[lang].copyHint.replace("\u00e9", "\u00e9")}"`), lang);
        assert.match(drawerOf(html), /<p id="note" role="status">/);
        assert.match(scriptOf(html), /copy\.dataset\.hint/);
      }
      assert.match(css(), /#copy:disabled \{[^}]*color: var\(--muted\)/);
      assert.doesNotMatch(css().match(/#copy:disabled \{[^}]*\}/)[0], /opacity/);
    });

    it("is 400px wide, and pushes the page only where the viewport holds the page and the drawer", () => {
      const html = css();
      assert.match(html, /--drawer: 400px/);
      const push = html.match(/@media \(min-width: (\d+)px\) \{[^@]*?body\[data-drawer="open"\] \.shell > main \{([^}]*)\}/);
      assert.ok(push, "a push rule");
      assert.equal(Number(push[1]), 1280 + 400);
      assert.match(push[2], /padding-right: calc\(var\(--s7\) \+ var\(--drawer\)\)/);
      assert.match(html, /\.scrim \{ display: none; \}/);
      assert.match(html, /body\[data-drawer="open"\] \.scrim \{ display: block; position: fixed;/);
      assert.match(html, /@media \(min-width: 1680px\) \{[^@]*\.scrim \{ display: none !important; \}/);
      assert.match(html, /<div class="scrim" id="scrim"><\/div>/);
    });

    it("closes on Escape and on the scrim, and gives the focus back to the review button", () => {
      const script = scriptOf(css());
      assert.match(script, /document\.addEventListener\("keydown", \(event\) => \{ if \(event\.key === "Escape" && !drawer\.hidden\) \{ show\(false\); opener\.focus\(\); \} \}\);/);
      assert.match(script, /getElementById\("scrim"\)\.addEventListener\("click"/);
      assert.match(script, /document\.body\.dataset\.drawer = on \? "open" : "closed"/);
    });
  });

  describe("the copy of a review", () => {
    const HOME_COPY = "```json\n" + JSON.stringify([{ record: "home", version: 1, verdicts: [{ state: "default", verdict: "ok", comment: "" }, { state: "loading", verdict: "revise", comment: "spinner too small" }] }], null, 2) + "\n```\n";
    const home = { record: "home", version: "1", verdicts: [{ state: "default", verdict: "ok", comment: "" }, { state: "loading", verdict: "revise", comment: "  spinner too small " }] };

    it("copies one record as a list of one: its decided states in order, the comments trimmed", () => {
      assert.equal(copiedOf([home, { record: "button", version: "1", verdicts: [] }]), HOME_COPY);
    });

    it("copies several records as a list of the same objects, in the order given", () => {
      const button = { record: "button", version: "1", verdicts: [{ state: "hover", verdict: "ok", comment: "" }] };
      const expected = "```json\n" + JSON.stringify([{ record: "button", version: 1, verdicts: [{ state: "hover", verdict: "ok", comment: "" }] }, { record: "home", version: 1, verdicts: [{ state: "default", verdict: "ok", comment: "" }, { state: "loading", verdict: "revise", comment: "spinner too small" }] }], null, 2) + "\n```\n";
      assert.equal(copiedOf([button, home]), expected);
    });

    it("copies nothing when nothing is decided", () => {
      assert.equal(copiedOf([{ record: "home", version: "1", verdicts: [] }]), "");
    });

    it("keeps only the verdicts of a record at the version a page shows, so a raised version starts clean", () => {
      const stored = { "home@0": { default: { verdict: "ok", comment: "" } }, "home@1": { empty: { verdict: "revise", comment: "x" } }, "gone@1": { default: { verdict: "ok", comment: "" } } };
      assert.deepEqual(keptOf(stored, ["home@1", "button@1"]), { "home@1": { empty: { verdict: "revise", comment: "x" } } });
      assert.deepEqual(keptOf(null, ["home@1"]), {});
      assert.deepEqual(keptOf("broken", ["home@1"]), {});
    });
  });

  describe("the sidebar and the header", () => {
    const itemOf = (html, id) => navOf(html).match(new RegExp(`<li data-id="${id}">[\\s\\S]*?</li>`))[0];
    const rule = (html, selector) => html.match(new RegExp(`(?:^|\\n)${selector.replaceAll(".", "\\.")} \\{([^}]*)\\}`))[1];

    it("lists each record in the navigation by its title, the id staying in the address", () => {
      const home = pagesOf()["home.html"];
      assert.match(itemOf(home, "home"), /<a href="home\.html" aria-current="page">Home<\/a>/);
      assert.doesNotMatch(itemOf(home, "home"), />home</);
    });

    it("marks only the item whose own link is the page, never the step that holds it", () => {
      const html = pagesOf()["home.html"];
      assert.doesNotMatch(html, /li:has\(a\[aria-current="page"\]\)/);
      assert.match(html, /nav li:has\(> a\[aria-current="page"\]\)/);
    });

    it("keeps the mark of the current tab on one line", () => {
      assert.match(rule(pagesOf()["home.html"], ".tab"), /white-space: nowrap/);
    });

    it("names the mark of each step in words, from the labels of the language", () => {
      for (const lang of ["en", "fr"]) {
        const labels = LABELS[lang];
        const marks = [...navOf(pagesOf({ lang })["index.html"]).matchAll(/<span class="step-mark"([^>]*)>([^<]*)</g)];
        assert.equal(marks.length, 5);
        const names = marks.map((match) => attributeOf(match[1], "aria-label"));
        assert.ok(names.every(Boolean), "every mark has a name");
        assert.deepEqual(names, ["journeys", "identity", "foundations", "components", "screens"].map((step) => {
          const own = stepOf(pagesOf({ lang })["index.html"], step);
          return own.todo !== "0" ? labels.toReview.replace("{count}", own.todo) : own.mark === "\u2713" ? labels.stepDone : labels.stepEmpty;
        }));
        assert.ok(labels.stepDone && labels.stepEmpty && labels.stepDone !== labels.stepEmpty);
      }
    });

    it("opens the navigation from a button that names the sheet it controls, in the language", () => {
      for (const lang of ["en", "fr"]) {
        const html = pagesOf({ lang })["home.html"];
        const toggle = html.match(/<button [^>]*id="nav-toggle"[^>]*>([^<]*)</);
        assert.ok(toggle, "a toggle");
        assert.equal(toggle[1], LABELS[lang].contents);
        assert.equal(attributeOf(toggle[0], "aria-expanded"), "false");
        const target = attributeOf(toggle[0], "aria-controls");
        assert.ok(target && html.includes(`id="${target}"`), `the sheet ${target} exists`);
        assert.ok(navOf(html).includes(`id="${target}"`), "inside the navigation");
      }
      assert.match(pagesOf()["home.html"], /@media \(max-width: 768px\)/);
    });

    it("writes the status of a chip, a card and the navigation in the language, the stored value staying", () => {
      const pages = pagesOf({ lang: "fr" });
      assert.match(headerOf(pages["search-flow.html"]), /<span class="chip" data-status="proposed">proposé<\/span>/);
      assert.match(headerOf(pages["home.html"]), /<span class="chip" data-status="validated">validé<\/span>/);
      assert.deepEqual(appearsOf(pages["home.html"]), [["onboarding", "Onboarding", "validated"]]);
      assert.match(pages["home.html"], /<a class="mini-card"[^>]*><b>Onboarding<\/b><span class="chip" data-status="validated">validé<\/span>/);
      assert.match(pagesOf()["search-flow.html"], /<span class="chip" data-status="proposed">proposed<\/span>/);
    });

    it("writes the known state names in the language in the tabs and the drawer rows, the raw names staying in the data and the copy", () => {
      const fr = pagesOf({ lang: "fr" });
      const tab = (html, state) => html.match(new RegExp(`<button type="button" role="tab"[^>]*data-tab="${state}"[^>]*>[\\s\\S]*?</button>`))[0];
      assert.match(tab(fr["home.html"], "empty"), />vide<\/button>$/);
      assert.match(rowOf(fr["home.html"], "home", "error"), /<a class="pick" href="home\.html#tab-error">erreur<\/a>/);
      assert.match(rowOf(fr["home.html"], "home", "error"), /data-state="error"/);
      assert.deepEqual(["default", "loading", "error"].map((state) => tab(fr["home.html"], state).match(/>([^<]*)<\/button>$/)[1]), ["par défaut", "chargement", "erreur"]);
      put(tmp, `${UI}/components/button.md`, read(`${UI}/components/button.md`).replace("states: [default, hover, focus, disabled]", "states: [default, hover, focus, disabled, pressed, selected, checked, ghost]"));
      const button = pagesOf({ lang: "fr" })["button.html"];
      const picked = (state) => rowOf(button, "button", state).match(/class="pick"[^>]*>([^<]*)</)[1];
      assert.deepEqual(["hover", "focus", "disabled", "pressed", "selected", "checked"].map(picked), ["survol", "focus", "d\u00e9sactiv\u00e9", "appuy\u00e9", "s\u00e9lectionn\u00e9", "coch\u00e9"]);
      assert.equal(picked("ghost"), "ghost", "an unknown name as written");
      assert.match(rowOf(pagesOf()["home.html"], "home", "error"), /class="pick"[^>]*>error</);
      assert.equal(copiedOf([{ record: "home", version: 1, verdicts: [{ state: "empty", verdict: "ok", comment: "" }] }]).includes('"state": "empty"'), true);
    });

    it("translates a deprecated status too, and shows an unknown one as written", () => {
      edit(tmp, `${UI}/wireframes/search-flow.md`, "status: proposed", "status: deprecated");
      assert.match(headerOf(pagesOf({ lang: "fr" })["search-flow.html"]), /data-status="deprecated">déprécié</);
      assert.match(headerOf(pagesOf()["search-flow.html"]), /data-status="deprecated">deprecated</);
      edit(tmp, `${UI}/wireframes/search-flow.md`, "status: deprecated", "status: odd");
      assert.match(headerOf(pagesOf({ lang: "fr" })["search-flow.html"]), /data-status="odd">odd</);
    });

    it("stamps the status and the version under the title, clear of the review button, and keeps the route and the code below", () => {
      const home = headerOf(pagesOf()["home.html"]);
      assert.match(home, /<\/h1><div class="stamp">/);
      assert.doesNotMatch(home.match(/<div class="chips">[\s\S]*?<\/div>/)[0], /data-status|class="version"/);
      assert.match(rule(pagesOf()["home.html"], ".head"), /flex-direction: column/);
      assert.doesNotMatch(pagesOf()["home.html"], /\.head \{[^}]*grid-template-columns/);
    });

    it("never wraps nor scrolls a journey's storyboard: one row of equal columns sharing the width, else one step per row", () => {
      const html = pagesOf()["onboarding.html"];
      const board = rule(html, ".board");
      assert.doesNotMatch(board, /flex-wrap: wrap|overflow-x: auto|overflow: auto/);
      assert.match(rule(html, ".journey"), /container-type: inline-size/);
      assert.match(html, /<ol class="board" data-steps="3" style="--steps: 3">/);
      assert.match(html, /@container \(min-width: \d+px\) \{ \.board\[data-steps="3"\] \{[^@]*grid-template-columns: repeat\(var\(--steps\), minmax\(0, 320px\)\)/);
      assert.match(rule(html, ".board .step"), /display: contents/);
    });

    it("caps a storyboard card's width, so a short journey on a wide screen keeps small cards", () => {
      const html = pagesOf()["onboarding.html"];
      assert.match(html, /\.board\[data-steps="2"\] \{[^@]*grid-template-columns: repeat\(var\(--steps\), minmax\(0, 320px\)\)/);
    });

    it("switches to the vertical list below a readable card, the threshold following the step count", () => {
      const html = pagesOf()["onboarding.html"];
      const threshold = (n) => Number(html.match(new RegExp(`@container \\(min-width: (\\d+)px\\) \\{ \\.board\\[data-steps="${n}"\\]`))[1]);
      assert.equal(threshold(4), 4 * 240 + 3 * 48);
      assert.ok(threshold(5) > threshold(4));
      assert.match(rule(html, ".board .card"), /grid-template-columns: 280px minmax\(0, 1fr\)/);
    });

    it("stacks a card's miniature above its text when the board is too narrow for the two side by side", () => {
      const html = pagesOf()["onboarding.html"];
      const narrow = html.match(/@container \(max-width: (\d+)px\) \{([^@]*)\}\n/);
      assert.ok(narrow, "a narrow rule");
      assert.ok(Number(narrow[1]) < 2 * 240 + 48, "below the first width the row of cards needs");
      assert.match(narrow[2], /\.board \.card \{ grid-template-columns: minmax\(0, 1fr\)/);
    });

    it("holds the review button at the foot of the sidebar instead of floating over the page", () => {
      const html = pagesOf()["onboarding.html"];
      assert.match(rule(html, ".review-foot"), /flex: none/);
      assert.doesNotMatch(rule(html, ".review-foot"), /position: (fixed|sticky)/);
      assert.doesNotMatch(rule(html, ".open-review"), /position: fixed/);
      assert.doesNotMatch(rule(html, ".shell > main"), /34px/);
    });

    it("splits the elements by category, in the order of the table, a record under its role", () => {
      const html = pagesOf()["index.html"];
      const body = stepOf(html, "components").html;
      const categories = [...body.matchAll(/<h3 data-category="(\w+)">[\s\S]*?<\/h3><ul>([\s\S]*?)<\/ul>/g)].map((match) => [match[1], [...match[2].matchAll(/data-id="([^"]+)"/g)].map((each) => each[1])]);
      assert.deepEqual(categories, [["input", ["search-field"]], ["action", ["button", "old-button"]], ["group", ["dialog"]], ["asset", ["icon-search"]]]);
    });

    it("counts the records awaiting review on each step, and marks a step with nothing awaiting done, or empty", () => {
      const index = pagesOf()["index.html"];
      assert.deepEqual(stepsOf(index).map((each) => [each.step, each.todo, each.mark]), [["journeys", "0", "\u2713"], ["identity", "0", "\u2713"], ["foundations", "0", "\u2713"], ["components", "4", "4"], ["screens", "1", "1"]]);
      fs.rmSync(path.join(tmp, UI, "journeys/onboarding.md"));
      assert.equal(stepOf(pagesOf()["index.html"], "journeys").mark, "\u2014");
    });

    it("shows an asset's image on its page, at most its natural size, with the alt of its front matter", () => {
      const html = pagesOf()["icon-search.html"];
      assert.match(html, /<figure class="asset-image" data-file="assets\/icon-search\.svg"><img src="\.\.\/assets\/icon-search\.svg" alt="Search"><\/figure>/);
      assert.match(rule(html, ".asset-image img"), /max-width: 100%/);
      assert.doesNotMatch(rule(html, ".asset-image img"), /(?<!max-)width: 100%/);
    });

    it("names the path of an asset whose file is missing instead of a broken image", () => {
      fs.rmSync(path.join(tmp, UI, "assets/icon-search.svg"));
      const html = pagesOf()["icon-search.html"];
      assert.doesNotMatch(html, /<figure class="asset-image"/);
      assert.match(html, /<div class="asset-image missing" data-file="assets\/icon-search\.svg">No file\. Save it at assets\/icon-search\.svg<\/div>/);
      assert.match(pagesOf({ lang: "fr" })["icon-search.html"], /Aucun fichier\. Enregistrez-le dans assets\/icon-search\.svg/);
    });

    it("shows no image for an asset file that points outside the design system folder", () => {
      put(tmp, "secret.svg", "<svg/>");
      edit(tmp, `${UI}/assets/icon-search.md`, "file: icon-search.svg", "file: ../../../secret.svg");
      assert.doesNotMatch(pagesOf()["icon-search.html"], /secret/);
    });

    it("does not mark a step done while an asset in it is still proposed", () => {
      for (const name of ["button", "search-field", "dialog", "old-button"]) fs.rmSync(path.join(tmp, UI, `components/${name}.md`));
      assert.equal(stepOf(pagesOf()["index.html"], "components").mark, "\u2713");
      edit(tmp, `${UI}/assets/icon-search.md`, "status: validated", "status: proposed");
      const index = pagesOf()["index.html"];
      assert.equal(stepOf(index, "components").mark, "1");
      assert.match(index, /<li data-step="components" data-state="todo">/);
      assert.match(index, /<span class="state">1 awaiting your agreement<\/span>/);
      assert.match(stepOf(index, "components").html, /aria-label="1 awaiting your agreement"/);
    });

    it("counts what the drawer reviews, not the proposed assets, in a step holding both", () => {
      const before = stepOf(pagesOf()["index.html"], "components");
      edit(tmp, `${UI}/assets/icon-search.md`, "status: validated", "status: proposed");
      const index = pagesOf()["index.html"];
      assert.deepEqual([stepOf(index, "components").todo, stepOf(index, "components").mark], [before.todo, before.todo]);
      assert.match(index, new RegExp(`<li data-step="components" data-state="todo">[\\s\\S]*?<span class="state">${before.todo} to review</span>`));
    });

    it("does not mark a step done while a journey in it is still proposed, and leaves the drawer count alone", () => {
      edit(tmp, `${UI}/journeys/onboarding.md`, "status: validated", "status: proposed");
      const index = pagesOf()["index.html"];
      assert.deepEqual([stepOf(index, "journeys").todo, stepOf(index, "journeys").mark], ["0", "1"]);
      assert.match(index, /<li data-step="journeys" data-state="todo">[\s\S]*?<span class="state">1 awaiting your agreement<\/span>/);
      assert.match(index, /<li data-step="components" data-state="todo">[\s\S]*?<span class="state">\d+ to review<\/span>/);
      assert.ok(!itemsOf(index).some((item) => item.record === "onboarding"));
      assert.match(pagesOf({ lang: "fr" })["index.html"], /<li data-step="journeys" data-state="todo">[\s\S]*?<span class="state">1 en attente de votre accord<\/span>/);
    });

    it("says what is still proposed on the overview when nothing awaits the drawer", () => {
      for (const file of ["components/button", "components/search-field", "components/dialog", "components/old-button", "screens/home", "wireframes/search-flow"]) fs.rmSync(path.join(tmp, UI, `${file}.md`));
      assert.match(pagesOf()["index.html"], /<p class="none">Nothing to review\.<\/p>/);
      edit(tmp, `${UI}/journeys/onboarding.md`, "status: validated", "status: proposed");
      const words = { en: "Nothing to review here\\. 1 awaiting your agreement, in Journeys\\. Agree with the assistant in the conversation\\.", fr: "Rien à relire ici\\. 1 en attente de votre accord, dans Parcours\\. À valider avec l'assistant dans la conversation\\." };
      for (const lang of ["en", "fr"]) {
        const index = pagesOf({ lang })["index.html"];
        assert.doesNotMatch(index, /<p class="none">/, lang);
        assert.match(index, new RegExp(`<p class="lede">${words[lang]}</p>`), lang);
        assert.doesNotMatch(index, /class="start"/, lang);
        assert.match(index, /data-overview="todo"[\s\S]*?<a href="onboarding\.html">/, lang);
      }
    });

    it("opens the step of the page, and on the overview the first step with work", () => {
      const pages = pagesOf();
      assert.deepEqual(stepsOf(pages["index.html"]).filter((each) => each.open).map((each) => each.step), ["components"]);
      assert.deepEqual(stepsOf(pages["home.html"]).filter((each) => each.open).map((each) => each.step), ["screens"]);
      assert.deepEqual(stepsOf(pages["button.html"]).filter((each) => each.open).map((each) => each.step), ["components"]);
    });

    it("groups the screens under the first journey that names them, the rest out of journey", () => {
      const body = stepOf(pagesOf()["index.html"], "screens").html;
      const groups = [...body.matchAll(/<h3 data-journey="([^"]*)">[^<]*<\/h3><ul>([\s\S]*?)<\/ul>/g)].map((match) => [match[1], [...match[2].matchAll(/data-id="([^"]+)"/g)].map((each) => each[1])]);
      assert.deepEqual(groups, [["onboarding", ["home"]]]);
      const file = path.join(tmp, UI, "journeys/onboarding.md");
      fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("| search-flow |", "| ghost |"));
      const after = stepOf(pagesOf()["index.html"], "screens").html;
      assert.match(after, /<h3 data-journey="onboarding">[^<]*<\/h3><ul><li data-id="home">/);
      assert.match(after, /<h3 data-journey="">Out of journey<\/h3><ul><li data-id="search-flow">/);
    });

    it("lists one item per journey step: the screen that dresses its wireframe, else the wireframe", () => {
      put(tmp, `${UI}/wireframes/start.md`, record(["id: start", "kind: wireframe", "status: proposed", "version: 1", "states: [default]"], "# Start"));
      put(tmp, `${UI}/screens/start-screen.md`, record(["id: start-screen", "kind: screen", "status: proposed", "version: 1", "wireframe: start", "states: [default]"], "# Start"));
      put(tmp, `${UI}/screens/lonely.md`, record(["id: lonely", "kind: screen", "status: proposed", "version: 1", "wireframe: elsewhere", "states: [default]"], "# Lonely"));
      put(tmp, `${UI}/wireframes/bare.md`, record(["id: bare", "kind: wireframe", "status: proposed", "version: 1", "states: [default]"], "# Bare"));
      edit(tmp, `${UI}/journeys/onboarding.md`, "| search-flow | narrows the results |", "| search-flow | narrows the results |\n| start | begins |\n| bare | sketches |");
      const body = stepOf(pagesOf()["index.html"], "screens").html;
      const groups = [...body.matchAll(/<h3 data-journey="([^"]*)">[^<]*<\/h3><ul>([\s\S]*?)<\/ul>/g)].map((match) => [match[1], [...match[2].matchAll(/data-id="([^"]+)"/g)].map((each) => each[1])]);
      assert.deepEqual(groups, [["onboarding", ["home", "start-screen", "bare"]], ["", ["lonely"]]]);
      assert.doesNotMatch(body, /\(wireframe\)|\(maquette\)/);
    });

    it("keeps the screen of a wireframe current in the sidebar while its wireframe page is open", () => {
      put(tmp, `${UI}/wireframes/start.md`, record(["id: start", "kind: wireframe", "status: proposed", "version: 1", "states: [default]"], "# Start"));
      put(tmp, `${UI}/screens/start-screen.md`, record(["id: start-screen", "kind: screen", "status: proposed", "version: 1", "wireframe: start", "states: [default]"], "# Start"));
      edit(tmp, `${UI}/journeys/onboarding.md`, "| search-flow | narrows the results |", "| search-flow | narrows the results |\n| start | begins |");
      const current = (html) => [...navOf(html).matchAll(/<a [^>]*href="([^"]+)\.html"[^>]*aria-current="page"/g)].map((match) => match[1]);
      assert.deepEqual(current(pagesOf()["start.html"]), ["start-screen"]);
    });

    it("switches a screen page and its wireframe page to each other, in both languages", () => {
      put(tmp, `${UI}/wireframes/start.md`, record(["id: start", "kind: wireframe", "status: proposed", "version: 1", "states: [default]"], "# Start"));
      put(tmp, `${UI}/screens/start-screen.md`, record(["id: start-screen", "kind: screen", "status: proposed", "version: 1", "wireframe: start", "states: [default]"], "# Start"));
      put(tmp, `${UI}/screens/lonely.md`, record(["id: lonely", "kind: screen", "status: proposed", "version: 1", "wireframe: elsewhere", "states: [default]"], "# Lonely"));
      const twinOf = (html) => html.match(/<nav class="twin"[\s\S]*?<\/nav>/)?.[0];
      const pairOf = (twin) => [...twin.matchAll(/<a href="([^"]+)\.html"[^>]*>([^<]+)<\/a>|<a [^>]*aria-current="page"[^>]*>([^<]+)<\/a>/g)].map((match) => (match[1] ? [match[1], match[2]] : [null, match[3]]));
      for (const [lang, words] of [["en", ["Screen", "Wireframe"]], ["fr", ["Écran", "Maquette"]]]) {
        const pages = pagesOf({ lang });
        assert.deepEqual(pairOf(twinOf(pages["start-screen.html"])), [[null, words[0]], ["start", words[1]]]);
        assert.deepEqual(pairOf(twinOf(pages["start.html"])), [["start-screen", words[0]], [null, words[1]]]);
        assert.equal(twinOf(pages["lonely.html"]), undefined);
        assert.equal(twinOf(pages["onboarding.html"]), undefined);
      }
    });

    it("reads the description in the text color, and the persona darker than the faint grey", () => {
      const html = pagesOf()["onboarding.html"];
      assert.match(rule(html, ".lede"), /color: var\(--text\)/);
      assert.doesNotMatch(rule(html, ".head .persona"), /var\(--muted\)|var\(--faint\)/);
    });

    it("lets only a journey page use the width of the screen", () => {
      const pages = pagesOf();
      assert.ok(pages["onboarding.html"].includes('<main class="wide">'));
      for (const name of ["home.html", "search-flow.html", "index.html"]) assert.ok(pages[name].includes("<main>"), name);
      assert.match(rule(pages["home.html"], ".shell > main.wide"), /max-width: none/);
    });
  });

  describe("the journey navigation", () => {
    const barsOf = (html) => [...html.matchAll(/<nav class="journey-bar"[^>]*>[\s\S]*?<\/nav>/g)].map((match) => match[0]);
    const hrefsOf = (bar) => [...bar.matchAll(/href="([^"]+)"/g)].map((match) => unescaped(match[1]));
    const textOf = (bar, name) => unescaped(bar.match(new RegExp(`<a class="${name}"[^>]*>([\\s\\S]*?)</a>`))?.[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() ?? "");

    it("sends each storyboard card to its page with the journey and the step in the query", () => {
      const cards = cardsOf(pagesOf()["onboarding.html"]);
      assert.deepEqual(cards.map((card) => unescaped(card.match(/<a class="step" href="([^"]+)"/)[1])), ["home.html?journey=onboarding&step=1", "home.html?journey=onboarding&step=2", "search-flow.html?journey=onboarding&step=3"]);
    });

    it("draws one hidden bar per step a page holds in a journey, under the header", () => {
      const page = pagesOf()["home.html"];
      const bars = barsOf(page);
      assert.deepEqual(bars.map((bar) => [attributeOf(bar, "data-journey"), attributeOf(bar, "data-step")]), [["onboarding", "1"], ["onboarding", "2"]]);
      for (const bar of bars) assert.match(bar, /^<nav class="journey-bar"[^>]* hidden/);
      assert.ok(page.indexOf("</header>") < page.indexOf('class="journey-bar"'));
      assert.ok(page.indexOf('class="journey-bar"') < page.indexOf('<section class="review"'));
    });

    it("names the journey, the step of the total, and the titles of the steps around", () => {
      const [first, second] = barsOf(pagesOf()["home.html"]);
      assert.deepEqual(hrefsOf(second), ["onboarding.html", "home.html?journey=onboarding&step=1", "search-flow.html?journey=onboarding&step=3"]);
      assert.equal(textOf(second, "journey-title"), "Onboarding");
      assert.match(second, /Step 2 of 3/);
      assert.equal(textOf(second, "prev"), "Previous step Home");
      assert.equal(textOf(second, "next"), "Next step Search flow");
      assert.deepEqual(hrefsOf(first), ["onboarding.html", "home.html?journey=onboarding&step=2"]);
      assert.doesNotMatch(first, /class="prev"/);
      const last = barsOf(pagesOf()["search-flow.html"])[0];
      assert.deepEqual(hrefsOf(last), ["onboarding.html", "home.html?journey=onboarding&step=2"]);
      assert.doesNotMatch(last, /class="next"/);
    });

    it("writes the bar in the language", () => {
      const second = barsOf(pagesOf({ lang: "fr" })["home.html"])[1];
      assert.match(second, /Étape 2 sur 3/);
      assert.match(textOf(second, "next"), /^Étape suivante/);
    });

    it("draws no bar and no script for it on a page no journey holds, nor on the journey itself", () => {
      const pages = pagesOf();
      for (const name of ["button.html", "onboarding.html", "index.html", "dialog.html"]) {
        assert.deepEqual(barsOf(pages[name]), [], name);
        assert.ok(!pages[name].includes("URLSearchParams"), name);
      }
    });

    it("leaves a step that names no record without a link", () => {
      edit(tmp, `${UI}/journeys/onboarding.md`, "| search-flow | narrows", "| ghost | narrows");
      const second = barsOf(pagesOf()["home.html"])[1];
      assert.doesNotMatch(second, /class="next"/);
    });

    describe("the script", () => {
      const run = (html, search) => {
        const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
        const bars = barsOf(html).map((bar) => ({ dataset: { journey: attributeOf(bar, "data-journey"), step: attributeOf(bar, "data-step") }, hidden: true }));
        const stub = { querySelectorAll: (selector) => (selector.includes("journey-bar") ? bars : []), getElementById: () => null, querySelector: () => null };
        const tail = script.slice(script.indexOf("const query = new URLSearchParams"));
        new Function("document", "location", "URLSearchParams", tail)(stub, { search, hash: "" }, URLSearchParams);
        return bars.map((bar) => bar.hidden);
      };

      it("shows the bar of the journey and step the address names, and none without them", () => {
        const page = pagesOf()["home.html"];
        assert.deepEqual(run(page, "?journey=onboarding&step=2"), [true, false]);
        assert.deepEqual(run(page, "?journey=onboarding&step=1"), [false, true]);
        assert.deepEqual(run(page, ""), [true, true]);
        assert.deepEqual(run(page, "?journey=other&step=1"), [true, true]);
        assert.deepEqual(run(page, "?journey=onboarding"), [true, true]);
      });

      it("leaves the tab of the hash to the tabs", () => {
        const html = pagesOf()["home.html"];
        assert.ok(html.includes("location.hash.slice(1)"));
        assert.ok(!html.slice(html.indexOf("const query = new URLSearchParams")).includes("location.hash"));
      });
    });
  });

  describe("the brand and the system on a page of a language", () => {
    const PLAIN = ["## Verdicts", "", "| Screen | State | Version | Verdict | Comment |", "| --- | --- | --- | --- | --- |"];
    /** Reviews these `[record, state]` pairs at their version, and neither the brand nor the system. */
    const settling = (pairs) => put(tmp, REVIEW_FILE, record(["id: first-pass", "kind: review", "status: proposed", "version: 1", "scope: system", "screens: [home]"], "# First pass", [...PLAIN, ...pairs.map(([id, state, version]) => `| ${id} | ${state} | ${version} | ok | |`)].join("\n")));
    const awaitingPairs = () => itemsOf(pagesOf()["index.html"]).flatMap((item) => [...item.html.matchAll(/<li class="pstate" data-state="([^"]+)"/g)].map((match) => [item.record, match[1], item.version]));
    const groupsOf = (html) => [...drawerOf(html).matchAll(/<details class="step-group" data-step="(\w+)"( open)?>/g)].map((match) => [match[1], Boolean(match[2])]);
    const awaitingBrandAndSystem = (...also) => settling([...awaitingPairs().filter(([id]) => !also.includes(id) && id !== "brand" && id !== "system"), ...(also.includes("home") ? [] : HOME_STATES.map((state) => ["home", state, "1"]))]);
    const ruleOf = (html, selector) => html.match(new RegExp(`^${selector.replaceAll(".", "\\.")} \\{([^}]*)\\}`, "m"))?.[1] ?? "";

    it("names them in the language wherever a title shows, the records themselves untouched", () => {
      awaitingBrandAndSystem();
      for (const [lang, names] of [["en", ["Brand identity", "Design system"]], ["fr", ["Identité visuelle", "Charte graphique"]]]) {
        const pages = pagesOf({ lang });
        [["brand", names[0]], ["system", names[1]]].forEach(([id, name]) => {
          assert.match(headerOf(pages[`${id}.html`]), new RegExp(`<h1>${name}</h1>`), `${lang} ${id} h1`);
          assert.match(pages[`${id}.html`], new RegExp(`<title>${name}</title>`), `${lang} ${id} title`);
          assert.match(todoOf(pages["index.html"]), new RegExp(`<a href="${id}.html">${name}</a>`), `${lang} ${id} overview`);
          assert.match(itemsOf(pages["index.html"]).find((item) => item.record === id).html, new RegExp(`<summary><span>${name}</span>`), `${lang} ${id} drawer`);
        });
      }
      assert.match(read(`${UI}/brand.md`), /^# Brand$/m);
      assert.match(headerOf(pagesOf({ lang: "fr" })["button.html"]), /<h1>Button<\/h1>/);
    });

    it("makes the step summary the link of a step that holds one record and no set, with no child list of records, only the anchors of its sections", () => {
      const html = pagesOf({ lang: "fr" })["index.html"];
      for (const [step, id, name] of [["identity", "brand", "Identité"], ["foundations", "system", "Charte"]]) {
        const each = stepOf(html, step);
        assert.match(each.html, new RegExp(`<summary><span class="stepno">\\d</span><a class="step-name" href="${id}.html">${name}</a>`), step);
        assert.doesNotMatch(each.html, /<ul>|<li data-/, step);
      }
      assert.match(stepsOf(pagesOf({ lang: "fr" })["brand.html"]).find((each) => each.step === "identity").html, /<a class="step-name" href="brand.html" aria-current="page">/);
      assert.match(stepOf(html, "components").html, /<ul>/);
    });

    it("keeps the list of a step that holds a set beside its one record", () => {
      const html = pagesOf({ sets: [{ id: "layout", rows: [], fingerprint: "f", axes: [], problems: [], variants: [{ name: "a", axes: [], round: 1, files: [{ path: "system.md", text: "" }] }] }] })["index.html"];
      assert.match(stepOf(html, "foundations").html, /<li data-id="system">/);
    });

    it("keeps the review button below a scrolling list, never over it", () => {
      const html = pagesOf()["index.html"];
      assert.match(ruleOf(html, ".nav-scroll"), /overflow: auto/);
      assert.match(ruleOf(html, ".nav-scroll"), /flex: 1/);
      const nav = navOf(html);
      const scroll = nav.match(/<div class="nav-scroll"[^>]*>([\s\S]*)<\/div><div class="review-foot">/);
      assert.ok(scroll, "the list in its own area, the button after it");
      assert.ok(scroll[1].includes('<ol class="steps">') && !scroll[1].includes("open-review"));
      assert.doesNotMatch(ruleOf(html, ".review-foot"), /sticky/);
    });

    it("writes the count in the review button in light text", () => {
      assert.match(ruleOf(pagesOf()["index.html"], ".open-review .pending"), /color: #fff/);
    });

    it("names the headings of the brand in French, the Project one and the Glossary", () => {
      assert.equal(LABELS.fr.sections.Project, "Projet");
      assert.equal(LABELS.fr.sections.Glossary, "Glossaire");
      const brand = pagesOf({ lang: "fr" })["brand.html"];
      assert.match(brand, /<h2[^>]*>Projet<\/h2>/);
      assert.doesNotMatch(brand, /<h2[^>]*>Project<\/h2>/);
      assert.match(pagesOf()["brand.html"], /<h2[^>]*>Project<\/h2>/);
    });

    it("names the no-rights state in French and the columns of the glossary table in each language", () => {
      assert.equal(LABELS.fr.stateNames["no-rights"], "sans droits");
      const glossary = "## Glossary\n\n| Concept | Word | Forbidden |\n| --- | --- | --- |\n| Patient | patient | client |";
      put(tmp, `${UI}/brand.md`, read(`${UI}/brand.md`) + "\n\n" + glossary + "\n");
      const heads = (html) => [...html.matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map((match) => match[1]);
      assert.deepEqual(heads(pagesOf({ lang: "fr" })["brand.html"]), ["Concept", "Mot", "Interdit"]);
      assert.deepEqual(heads(pagesOf()["brand.html"]), ["Concept", "Word", "Forbidden"]);
      assert.match(pagesOf({ lang: "fr" })["brand.html"], /<td>patient<\/td>/);
    });

    it("names the one state of the brand and of the system as the whole, linking the page with no anchor", () => {
      awaitingBrandAndSystem();
      for (const [lang, whole] of [["en", "Whole"], ["fr", "L'ensemble"]]) {
        const index = pagesOf({ lang })["index.html"];
        for (const id of ["brand", "system"]) {
          assert.match(rowOf(index, id, "default"), new RegExp(`<a class="pick" href="${id}.html">${whole.replace("'", "(?:'|&#39;)")}</a>`), `${lang} ${id}`);
        }
      }
      assert.match(rowOf(pagesOf({ lang: "fr" })["index.html"], "brand", "default"), /data-state="default"/);
    });

    it("keeps the state name and the anchor of any other record", () => {
      assert.match(rowOf(pagesOf({ lang: "fr" })["index.html"], "button", "default"), /<a class="pick" href="button.html#tab-default">par défaut<\/a>/);
    });

    it("opens every group of the drawer when it holds three records or fewer", () => {
      awaitingBrandAndSystem("button");
      assert.equal(itemsOf(pagesOf()["index.html"]).length, 3);
      assert.deepEqual(groupsOf(pagesOf()["index.html"]), [["identity", true], ["foundations", true], ["components", true]]);
    });

    it("opens only the group of the page when the drawer holds four records", () => {
      awaitingBrandAndSystem("search-flow", "home");
      assert.equal(itemsOf(pagesOf()["index.html"]).length, 4);
      assert.deepEqual(groupsOf(pagesOf()["index.html"]), [["identity", true], ["foundations", false], ["screens", false]]);
    });
  });

  describe("the language", () => {
    it("labels the verdicts OK and Revise in English, by default", () => {
      const row = rowOf(pagesOf()["home.html"], "home", "error");
      assert.match(row, /data-verdict="ok"[^>]*>OK</);
      assert.match(row, /data-verdict="revise"[^>]*>Revise</);
      assert.match(pagesOf()["home.html"], /<html lang="en">/);
    });

    it("labels them OK and À revoir in French, the stored values staying ok and revise", () => {
      const home = pagesOf({ lang: "fr" })["home.html"];
      const row = rowOf(home, "home", "error");
      assert.match(row, /data-verdict="ok"[^>]*>OK</);
      assert.match(row, /data-verdict="revise"[^>]*>À revoir</);
      assert.match(home, /<html lang="fr">/);
    });

    it("falls back to English on a language it has no table for", () => {
      assert.deepEqual(pagesOf({ lang: "de" }), pagesOf({ lang: "en" }));
    });

    it("holds the same keys in each language", () => {
      assert.deepEqual(Object.keys(LABELS.fr).sort(), Object.keys(LABELS.en).sort());
      assert.deepEqual(Object.keys(LABELS).sort(), ["en", "fr"]);
    });

    it("writes every chrome string of a page in the language, none left in English", () => {
      const pages = Object.values(pagesOf({ lang: "fr" })).join("\n");
      assert.ok(!pages.includes("undefined"));
      for (const [key, english] of Object.entries(LABELS.en)) {
        if (typeof english === "string" && english !== LABELS.fr[key]) assert.ok(!pages.includes(`>${english}<`) && !pages.includes(`"${english}"`), key);
      }
    });

    it("passes the language through the command, and falls back to English on an unknown one", () => {
      assert.equal(JSON.parse(written("--lang", "fr").out).lang, "fr");
      assert.ok(read(`${SHOWCASE}/home.html`).includes("À revoir"));
      assert.equal(JSON.parse(written("--lang", "de").out).lang, "en");
      assert.ok(!read(`${SHOWCASE}/home.html`).includes("À revoir"));
    });
  });
});
