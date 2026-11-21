const assert = require("node:assert/strict");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { UI, LIB, makeTmp, removeTmp, writeProject, put, record } = require("../fixtures/aidd-ui/project.js");
const { load } = require(path.join(LIB, "project.cjs"));
const { showcaseOf } = require(path.join(LIB, "showcase.cjs"));

// Record ids are unique per kind, not across kinds: a journey and a wireframe may share one. Each is its
// own page, and every link to the journey opens the journey.

let tmp;

beforeEach(() => {
  tmp = makeTmp("aidd-ui-showcase-journey-pages-");
  writeProject(tmp);
});

afterEach(() => removeTmp(tmp));

const RENDER = '<html><head></head><body><main data-state="default">x</main></body></html>';
const JOURNEY_FILE = "_journey-share.html";

const shared = () => {
  put(tmp, `${UI}/wireframes/share.md`, record(["id: share", "kind: wireframe", "status: proposed", "version: 1", "states: [default]"], "# Share wireframe"));
  put(tmp, `${UI}/wireframes/share.html`, RENDER);
  put(tmp, `${UI}/journeys/share.md`, record(["id: share", "kind: journey", "status: proposed", "version: 1"], "# Share journey", "## Steps\n\n| Screen | Action |\n| --- | --- |\n| share | opens |"));
};
const pagesOf = () => showcaseOf({ project: load(tmp), tokens: ":root { --accent: #123456; }\n", captures: new Set(), lang: "en", sets: [] });
const titleOf = (html) => html.match(/<title>(.*?)<\/title>/)[1];
const anchorsOf = (html) => [...html.matchAll(/<a\b[^>]*?href="([^"]+)"[^>]*>(.*?)<\/a>/gs)].map((match) => ({ href: match[1].split(/[#?]/)[0], text: match[2].replace(/<[^>]+>/g, "") }));

describe("aidd-ui showcase journey pages", () => {
  it("writes a journey and a wireframe sharing an id as two pages, each with its own title", () => {
    shared();
    const pages = pagesOf();
    assert.equal(titleOf(pages["share.html"]), "Share wireframe");
    assert.equal(titleOf(pages[JOURNEY_FILE]), "Share journey");
  });

  it("points every link named for the journey at the journey page, and every link named for the wireframe at the wireframe page", () => {
    shared();
    const pages = pagesOf();
    const links = Object.values(pages).flatMap(anchorsOf);
    const toJourney = links.filter((each) => each.text.includes("Share journey"));
    const toWireframe = links.filter((each) => each.text.includes("Share wireframe"));
    assert.ok(toJourney.length >= 2, "card and sidebar at least");
    assert.ok(toJourney.every((each) => each.href === JOURNEY_FILE), JSON.stringify(toJourney.filter((each) => each.href !== JOURNEY_FILE)));
    assert.ok(toWireframe.length && toWireframe.every((each) => each.href === "share.html"), JSON.stringify(toWireframe));
  });

  it("sends a step of the journey to the screen it names, never to the journey sharing its id", () => {
    shared();
    const card = pagesOf()[JOURNEY_FILE].match(/<a class="step" href="([^"]+)">/);
    assert.equal(card[1], "share.html?journey=share&amp;step=1");
  });

  it("opens the journey from the stepper", () => {
    shared();
    const stepper = pagesOf()["index.html"].match(/<ol class="stepper">[\s\S]*?<\/ol>/)[0];
    assert.match(stepper, new RegExp(`<li data-step="journeys"[^>]*><a href="${JOURNEY_FILE}">`));
  });

  it("marks only the page shown as current in the sidebar, and opens only its own record in the drawer", () => {
    shared();
    const pages = pagesOf();
    const current = (html) => anchorsOf(html.match(/<nav aria-label[\s\S]*?<\/nav>/)[0]).length && [...html.match(/<nav aria-label[\s\S]*?<\/nav>/)[0].matchAll(/<a[^>]*href="([^"]+)"[^>]*aria-current="page"/g)].map((match) => match[1]);
    assert.deepEqual(current(pages[JOURNEY_FILE]), [JOURNEY_FILE]);
    assert.deepEqual(current(pages["share.html"]), ["share.html"]);
    assert.doesNotMatch(pages[JOURNEY_FILE], /<details class="item"[^>]*data-here/);
    assert.match(pages["share.html"], /<details class="item" data-record="share"[^>]*data-here/);
  });
});
