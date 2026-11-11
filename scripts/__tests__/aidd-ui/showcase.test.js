const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { UI, LIB, makeTmp, removeTmp, filesUnder, engine, validate, writeProject, put, edit, record } = require("../fixtures/aidd-ui/project.js");
const { load } = require(path.join(LIB, "project.cjs"));
const { showcaseOf, LABELS } = require(path.join(LIB, "showcase.cjs"));

// The showcase is a pure module that renders pages and a command that writes them: the pages are
// judged as text, and the command as a subprocess, as the skill calls it.
const PAGE_IDS = ["brand", "button", "dialog", "home", "icon-search", "old-button", "onboarding", "search-flow", "search-field", "system"];
const SHOWCASE = `${UI}/showcase`;
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const REVIEW_FILE = `${UI}/reviews/first-pass.md`;
const HOME_STATES = ["default", "empty", "loading", "error"];

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
/** Rewrites the review of the fixture with these rows, `[screen, state, version, verdict, comment]`. */
const verdicts = (...rows) => {
  const table = ["## Verdicts", "", "| Screen | State | Version | Verdict | Comment |", "| --- | --- | --- | --- | --- |", ...rows.map((cells) => `| ${cells.join(" | ")} |`)].join("\n");
  put(tmp, REVIEW_FILE, record(["id: first-pass", "kind: review", "status: proposed", "version: 1", "scope: system", "screens: [home]"], "# First pass", table));
};
const statesIn = (html) => [...html.matchAll(/<article class="state" data-state="([^"]+)"/g)].map((match) => match[1]);
const articleOf = (html, state) => html.match(new RegExp(`<article class="state" data-state="${state}"[\\s\\S]*?</article>`))[0];
const groupOf = (html, group) => html.match(new RegExp(`<section data-group="${group}">[\\s\\S]*?</section>`))[0];
const linksOf = (html, kind) => [...html.match(new RegExp(`<section class="links" data-links="${kind}">[\\s\\S]*?</section>`))[0].matchAll(/href="([^"]+)\.html"/g)].map((match) => match[1]);
const capture = (name) => put(tmp, `${UI}/screens/${name}`, PNG);

describe("aidd-ui showcase", () => {
  describe("the pages", () => {
    it("holds the home page and one page for each record that is not a review", () => {
      assert.deepEqual(Object.keys(pagesOf()).sort(), ["index.html", ...PAGE_IDS.map((id) => `${id}.html`)].sort());
    });

    it("reaches every page from the home page", () => {
      const index = pagesOf()["index.html"];
      for (const id of PAGE_IDS) assert.ok(index.includes(`href="${id}.html"`), id);
    });

    it("lists a wireframe under templates and a screen under pages", () => {
      const index = pagesOf()["index.html"];
      assert.ok(groupOf(index, "templates").includes('href="search-flow.html"'));
      assert.ok(groupOf(index, "pages").includes('href="home.html"'));
      assert.ok(!groupOf(index, "pages").includes("search-flow"));
    });

    it("orders the navigation brand and system, components by level, journeys, templates, pages", () => {
      const index = pagesOf()["index.html"];
      const order = [...index.matchAll(/<section data-group="([^"]+)">/g)].map((match) => match[1]);
      assert.deepEqual(order, ["system", "components", "journeys", "templates", "pages"]);
      const components = groupOf(index, "components");
      const levels = [...components.matchAll(/data-level="([^"]+)"/g)].map((match) => match[1]);
      assert.deepEqual(levels, ["asset", "atom", "molecule", "organism"]);
      assert.ok(components.match(/data-level="atom"[\s\S]*?<\/ul>/)[0].includes('href="button.html"'));
      assert.ok(components.match(/data-level="molecule"[\s\S]*?<\/ul>/)[0].includes('href="search-field.html"'));
    });

    it("lists what a record uses and what uses it, from every field that cites an id", () => {
      const pages = pagesOf();
      assert.deepEqual(linksOf(pages["home.html"], "uses"), ["dialog", "search-field"]);
      assert.deepEqual(linksOf(pages["home.html"], "used-by"), ["onboarding"]);
      assert.deepEqual(linksOf(pages["search-field.html"], "used-by"), ["home", "search-flow"]);
      assert.ok(!pages["home.html"].includes('href="first-pass.html"'));
    });

    it("marks a proposed record on its page and in the navigation, and a validated one nowhere", () => {
      const pages = pagesOf();
      assert.match(pages["search-flow.html"], /<span class="chip" data-status="proposed">/);
      assert.match(pages["home.html"].match(/<li data-id="search-flow">[\s\S]*?<\/li>/)[0], /class="tag"/);
      assert.doesNotMatch(pages["home.html"].match(/<li data-id="home">[\s\S]*?<\/li>/)[0], /class="tag"/);
      assert.match(pages["home.html"], /<span class="chip" data-status="validated">/);
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
      assert.match(html, /\.render iframe\[data-platform="mobile"\] \{ flex: 0 0 390px; inline-size: 390px; \}/);
      assert.doesNotMatch(html, /\[data-platform="web"\] \{/);
      assert.ok(!html.includes("height: 320px"));
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

    it("holds no script that reaches out or keeps state: no request, no listener, no storage", () => {
      for (const [name, html] of Object.entries(pagesOf())) {
        for (const reaching of ["http://", "https://", "fetch(", "XMLHttpRequest", "WebSocket", "localStorage", "sessionStorage", "indexedDB"]) assert.ok(!html.includes(reaching), `${name} ${reaching}`);
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
      assert.match(home, /<p class="count" data-ok="1" data-total="4">1\/4 OK<\/p>/);
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
      assert.match(home, /<p class="count" data-ok="1" data-total="4">1\/4 OK<\/p>/);
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

    it("holds the review only on a record with states and a render", () => {
      const pages = pagesOf();
      for (const id of ["home", "button", "search-flow"]) assert.match(pages[`${id}.html`], /<section class="review" data-record="/, id);
      for (const id of ["brand", "system", "onboarding", "icon-search", "index"]) assert.doesNotMatch(pages[`${id}.html`], /class="review"|id="copy"/, id);
    });

    it("hands the review of a record back as one copy, with the record, its version and the verdicts", () => {
      const home = pagesOf()["home.html"];
      assert.match(home, /<section class="review" data-record="home" data-version="1">/);
      for (const state of HOME_STATES) {
        const buttons = [...articleOf(home, state).matchAll(/<button type="button" class="verdict" data-verdict="(\w+)"/g)].map((match) => match[1]);
        assert.deepEqual(buttons, ["ok", "revise"], state);
      }
      assert.equal(home.match(/id="copy"/g).length, 1);
    });
  });

  describe("the home page batch", () => {
    const LISTABLE = { button: ["default", "hover", "focus", "disabled"], "search-field": ["default", "hover", "focus", "disabled"], dialog: ["default", "hover", "focus", "disabled"], "old-button": ["default"], "search-flow": ["default", "empty"] };
    const okRows = (...ids) => ids.flatMap((id) => LISTABLE[id].map((state) => [id, state, id === "old-button" ? "2" : "1", "ok", ""]));
    const batchOf = (html) => [...html.matchAll(/<li data-record="([^"]+)" data-version="(\d+)" data-states="([^"]*)">/g)].map((match) => ({ record: match[1], version: match[2], states: JSON.parse(match[3].replaceAll("&quot;", '"')) }));

    it("lists a record whose states are not all ok, checked, with only its states still to judge", () => {
      verdicts(["button", "default", "1", "ok", ""]);
      const index = pagesOf()["index.html"];
      const entries = batchOf(index);
      assert.deepEqual(entries.map((entry) => entry.record), ["button", "dialog", "old-button", "search-field", "search-flow"]);
      assert.deepEqual(entries[0], { record: "button", version: "1", states: ["hover", "focus", "disabled"] });
      assert.match(index, /<section class="batch" data-records="5">/);
      assert.equal(index.match(/<input type="checkbox" checked>/g).length, 5);
      assert.equal(index.match(/id="copy-all"/g).length, 1);
    });

    it("leaves out a record whose states are all ok", () => {
      verdicts(...okRows("button"));
      assert.ok(!batchOf(pagesOf()["index.html"]).some((entry) => entry.record === "button"));
    });

    it("leaves out a record with a state to revise at its version, which is judged on its own page", () => {
      verdicts(["button", "hover", "1", "revise", "too pale"]);
      assert.ok(!batchOf(pagesOf()["index.html"]).some((entry) => entry.record === "button"));
    });

    it("lists a record whose ok is of an older version only, with every state", () => {
      verdicts(["button", "default", "0", "ok", ""]);
      assert.deepEqual(batchOf(pagesOf()["index.html"]).find((entry) => entry.record === "button").states, ["default", "hover", "focus", "disabled"]);
    });

    it("leaves out a screen whose code is at its version", () => {
      verdicts();
      assert.ok(!batchOf(pagesOf()["index.html"]).some((entry) => entry.record === "home"));
    });

    it("holds no batch and no script when nothing is left to judge", () => {
      verdicts(...okRows("button", "search-field", "dialog", "old-button", "search-flow"));
      const index = pagesOf()["index.html"];
      assert.doesNotMatch(index, /class="batch"|id="copy-all"|<script>/);
    });

    it("writes the labels in the language, the stored verdict staying ok", () => {
      const index = pagesOf({ lang: "fr" })["index.html"];
      assert.match(index, /id="copy-all"[^>]*>Tout OK, copier</);
      assert.match(index, /<h2>Encore à juger<\/h2>/);
      assert.match(index, /Décochez une fiche pour la juger sur sa page\./);
    });

    it("writes the same page twice, the records in the order of their ids", () => {
      assert.equal(pagesOf()["index.html"], pagesOf()["index.html"]);
    });

    it("carries a script that compiles, on the home page, on the system page and on a record's page", () => {
      for (const name of ["index.html", "system.html", "button.html"]) {
        const script = pagesOf()[name].match(/<script>([\s\S]*)<\/script>/)[1];
        assert.doesNotThrow(() => new Function(script), name);
      }
      const scriptOf = (name) => pagesOf()[name].match(/<script>([\s\S]*)<\/script>/)[1];
      assert.ok(!scriptOf("system.html").includes('document.querySelector(".review")'));
      assert.ok(scriptOf("button.html").includes('document.querySelector(".review")'));
      assert.match(pagesOf()["index.html"].match(/<script>([\s\S]*)<\/script>/)[1], /verdict: "ok"/);
    });
  });

  describe("the language", () => {
    it("labels the verdicts OK and Revise in English, by default", () => {
      const article = articleOf(pagesOf()["home.html"], "default");
      assert.match(article, /data-verdict="ok"[^>]*>OK</);
      assert.match(article, /data-verdict="revise"[^>]*>Revise</);
      assert.match(pagesOf()["home.html"], /<html lang="en">/);
    });

    it("labels them OK and À revoir in French, the stored values staying ok and revise", () => {
      const home = pagesOf({ lang: "fr" })["home.html"];
      const article = articleOf(home, "default");
      assert.match(article, /data-verdict="ok"[^>]*>OK</);
      assert.match(article, /data-verdict="revise"[^>]*>À revoir</);
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
