const assert = require("node:assert/strict");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { UI, LIB, makeTmp, removeTmp, writeProject, put, record } = require("../fixtures/aidd-ui/project.js");
const { load } = require(path.join(LIB, "project.cjs"));
const { showcaseOf, LABELS } = require(path.join(LIB, "showcase.cjs"));

// The overview is a map by step: journeys as a filmstrip of their screens, identity and charter as one card,
// elements as a dense list by category, screens as a grid of thumbnails. One card per record, each card one
// link, the numbers those of the drawer, the thumbnails static and lazy.

let tmp;

beforeEach(() => {
  tmp = makeTmp("aidd-ui-showcase-overview-");
  writeProject(tmp);
});

afterEach(() => removeTmp(tmp));

const RENDER = '<html><head></head><body><main data-state="default">x</main></body></html>';
const SCREEN = (id, wireframe) => record([`id: ${id}`, "kind: screen", "status: proposed", "version: 1", ...(wireframe ? [`wireframe: ${wireframe}`] : []), "states: [default, error]"], `# ${id}`);
const WIREFRAME = (id) => record([`id: ${id}`, "kind: wireframe", "status: proposed", "version: 1", "states: [default]"], `# ${id}`);
const JOURNEY = (id, rows, status = "proposed") => record([`id: ${id}`, "kind: journey", `status: ${status}`, "version: 1"], `# ${id}`, `## Steps\n\n| Screen | Action |\n| --- | --- |\n${rows.map((row) => `| ${row} | opens |`).join("\n")}`);

const crowd = () => {
  for (const [screen, wireframe] of [["start-screen", "start"], ["other-screen", "other"]]) {
    put(tmp, `${UI}/wireframes/${wireframe}.md`, WIREFRAME(wireframe));
    put(tmp, `${UI}/wireframes/${wireframe}.html`, RENDER);
    put(tmp, `${UI}/screens/${screen}.md`, SCREEN(screen, wireframe));
    put(tmp, `${UI}/screens/${screen}.html`, RENDER.replace("</main>", "</main><main data-state=\"error\">e</main>"));
  }
  put(tmp, `${UI}/wireframes/bare.md`, WIREFRAME("bare"));
  put(tmp, `${UI}/wireframes/bare.html`, RENDER);
  put(tmp, `${UI}/journeys/second.md`, JOURNEY("second", ["start", "bare", "missing"]));
};

const variant = (name) => ({ name, intent: `Intent of ${name}`, axes: [["Tone", name]], files: [{ path: "screens/ecran-start.md", text: "---\nid: ecran-start\nkind: screen\n---\n\n# Start here\n\nText.\n" }] });
const SET = { id: "ecran-start", rows: [], axes: ["Tone"], variants: [variant("calm"), variant("bold")], problems: [], fingerprint: "f1" };
const pagesOf = (sets = [], lang = "en") => showcaseOf({ project: load(tmp), tokens: ":root { --accent: #123456; }\n", captures: new Set(), lang, sets });

const overviewOf = (html) => html.match(/<div class="overview">[\s\S]*?<\/div>\s*<\/main>/)[0];
const sectionOf = (html, step) => overviewOf(html).match(new RegExp(`<section class="ov-step" data-step="${step}">[\\s\\S]*?</section>`))?.[0] ?? "";
const idsIn = (block) => [...block.matchAll(/<li data-(?:id|set)="([^"]+)"/g)].map((match) => match[1]);
const drawerOf = (html) => html.match(/<aside class="drawer" id="review"[\s\S]*?<\/aside>/)[0];

describe("aidd-ui showcase overview", () => {
  it("lists the steps that hold something as sections in step order, journeys first, under the stepper", () => {
    crowd();
    const index = pagesOf([SET])["index.html"];
    assert.ok(index.indexOf('<ol class="stepper">') < index.indexOf('<div class="overview">'));
    const steps = [...overviewOf(index).matchAll(/<section class="ov-step" data-step="(\w+)">/g)].map((match) => match[1]);
    assert.deepEqual(steps, ["journeys", "identity", "foundations", "components", "screens"]);
  });

  it("draws one card per journey: its title, its status and a strip of its screens, the screen that dresses a wireframe before it", () => {
    crowd();
    const block = sectionOf(pagesOf()["index.html"], "journeys");
    const cards = [...block.matchAll(/<li data-id="([^"]+)">([\s\S]*?)<\/li>/g)];
    assert.deepEqual(cards.map((match) => match[1]).sort(), ["onboarding", "second"]);
    const second = cards.find((match) => match[1] === "second")[2];
    assert.equal(second.match(/<a /g).length, 1);
    assert.match(second, /<a class="ovcard" href="second\.html"/);
    assert.match(second, /data-status="proposed">Awaiting your agreement</);
    assert.deepEqual([...second.matchAll(/<iframe[^>]*title="([^"]*)"/g)].map((match) => match[1]), ["start-screen", "bare"], "a step with no record is a blank card, not a frame");
    assert.equal(second.match(/class="thumb s/g).length, 3);
    assert.match(cards.find((match) => match[1] === "onboarding")[2], /data-status="validated">/);
  });

  it("draws one card per screen, a wireframe a screen dresses leaving no card of its own, a variant set a card marked to choose", () => {
    crowd();
    const block = sectionOf(pagesOf([SET])["index.html"], "screens");
    const tiles = [...block.matchAll(/<ul class="ovcards screens">[\s\S]*?<\/ul>/g)].map((match) => match[0]).join("");
    assert.deepEqual(idsIn(tiles).sort(), ["bare", "ecran-start", "home", "other-screen", "start-screen"]);
    const apart = block.match(/<details class="sketches">[\s\S]*?<\/details>/)[0];
    assert.deepEqual(idsIn(apart).sort(), ["other", "search-flow", "start"], "a dressed wireframe stays one link away, outside the grid");
    assert.match(apart, /<summary>Wireframes \(3\)<\/summary>/);
    const set = block.match(/<li data-set="ecran-start">[\s\S]*?<\/li>/)[0];
    assert.match(set, /<a class="ovcard" href="_set-ecran-start\.html"/);
    assert.match(set, /Variants to choose/);
    assert.match(set, /data-total="2">0\/2 chosen</);
  });

  it("shows on a card the progress and the mark of the drawer, from the same counts", () => {
    crowd();
    const index = pagesOf()["index.html"];
    const drawer = drawerOf(index);
    const block = sectionOf(index, "screens");
    for (const id of ["start-screen", "other-screen", "bare"]) {
      const card = block.match(new RegExp(`<li data-id="${id}">[\\s\\S]*?</li>`))[0];
      const shown = card.match(/data-total="(\d+)">(\d+)\/\d+</);
      const held = drawer.match(new RegExp(`data-record="${id}"[\\s\\S]*?<span class="done">(\\d+)/(\\d+)</span>`));
      assert.deepEqual([shown[2], shown[1]], [held[1], held[2]], id);
      assert.match(card, new RegExp(`<span class="mark todo" data-record="${id}">To review</span>`), id);
    }
    const count = Number(block.match(/<h3>[^<]*<span>(\d+)<\/span>/)[1]);
    assert.equal((block.match(/class="mark todo"/g) ?? []).length, count, "one mark per record the step counts");
  });

  it("keeps the thumbnails static and cheap: lazy, sandboxed, hidden from assistive technology, never in a link of their own", () => {
    crowd();
    const index = pagesOf([SET])["index.html"];
    const frames = overviewOf(index).match(/<iframe[^>]*>/g);
    assert.ok(frames.length >= 6, "journey strips and screen cards");
    for (const frame of frames) assert.match(frame, /^<iframe tabindex="-1" loading="lazy" sandbox /, frame);
    assert.doesNotMatch(overviewOf(index), /loading="eager"/);
    for (const span of overviewOf(index).matchAll(/<span class="(?:thumb|strip)[^"]*"([^>]*)>/g)) assert.match(span[1], /aria-hidden="true"/);
    for (const anchor of overviewOf(index).matchAll(/<a [^>]*>[\s\S]*?<\/a>/g)) assert.doesNotMatch(anchor[0].slice(3), /<a |<button|<input|<select|<textarea/);
  });

  it("lists the elements as a dense list by category, each with the states reviewed, and no thumbnail", () => {
    const block = sectionOf(pagesOf()["index.html"], "components");
    const groups = [...block.matchAll(/<div class="group" data-sum>([\s\S]*?)<\/div>/g)];
    assert.ok(groups.length >= 1);
    const counted = groups.filter(([, group]) => group.includes('class="sum"'));
    assert.ok(counted.length >= 1, "a category with states shows its sum");
    for (const [, group] of counted) {
      assert.match(group, /<h4 data-category="\w+"><span>[^<]+<\/span><span class="sum">\d+\/\d+<\/span><span class="bar" aria-hidden="true"><i style="inline-size: \d+%"><\/i><\/span><\/h4>/);
      const done = [...group.matchAll(/class="progress" data-record="[^"]+" data-base="(\d+)" data-total="(\d+)"/g)];
      const sum = group.match(/class="sum">(\d+)\/(\d+)</);
      assert.deepEqual([Number(sum[1]), Number(sum[2])], [done.reduce((n, m) => n + Number(m[1]), 0), done.reduce((n, m) => n + Number(m[2]), 0)]);
    }
    assert.match(block, /<li data-id="button"><a href="button\.html">Button<\/a>/);
    assert.doesNotMatch(block, /<iframe/);
  });

  it("gives the charter a card of its colours and the identity a compact card, no empty thumbnail", () => {
    const index = pagesOf()["index.html"];
    assert.match(sectionOf(index, "identity"), /<li data-id="brand"><a class="ovcard" href="brand\.html"/);
    assert.doesNotMatch(sectionOf(index, "identity"), /thumb/);
    const charter = sectionOf(index, "foundations");
    assert.match(charter, /<li data-id="system"><a class="ovcard" href="system\.html"/);
    assert.match(charter, /<span class="palette" aria-hidden="true"><i style="background: [^"]+"><\/i>/);
  });

  it("writes its words in the language, and states them in both", () => {
    crowd();
    const index = pagesOf([SET], "fr")["index.html"];
    const block = sectionOf(index, "screens");
    assert.match(block, /À relire/);
    assert.match(block, /Variantes à choisir/);
    assert.match(sectionOf(index, "journeys"), /En attente de votre accord/);
    assert.match(sectionOf(index, "journeys"), /\d+ étapes/);
    for (const key of ["toReviewMark", "toReworkMark", "awaitingAgreement", "variantsToChoose", "stepsCount"]) assert.ok(LABELS.en[key] && LABELS.fr[key], key);
  });

  it("is the same twice on the same records", () => {
    crowd();
    assert.equal(pagesOf([SET])["index.html"], pagesOf([SET])["index.html"]);
  });
});
