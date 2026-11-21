const assert = require("node:assert/strict");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { UI, LIB, makeTmp, removeTmp, writeProject } = require("../fixtures/aidd-ui/project.js");
const { load } = require(path.join(LIB, "project.cjs"));
const { showcaseOf } = require(path.join(LIB, "showcase.cjs"));

// The look of the showcase chrome: one set of role tokens in a light and a dark scheme, no colour written
// outside them, a visible focus ring, motion that gives way to the reader's preference.

let tmp;

beforeEach(() => {
  tmp = makeTmp("aidd-ui-showcase-look-");
  writeProject(tmp);
});

afterEach(() => removeTmp(tmp));

const SET = { id: "ecran-start", rows: [], axes: ["Tone"], variants: ["calm", "bold"].map((name) => ({ name, intent: name, axes: [["Tone", name]], files: [{ path: "screens/ecran-start.md", text: "---\nid: ecran-start\nkind: screen\n---\n\n# Start\n\nText.\n" }] })), problems: [], fingerprint: "f1" };
const pages = () => showcaseOf({ project: load(tmp), tokens: ":root { --accent: #123456; }\n", captures: new Set(), lang: "en", sets: [SET] });
const styleOf = (html) => html.match(/<style>([\s\S]*?)<\/style>/)[1];
const SCHEME = "@media (prefers-color-scheme: dark)";
const rootsOf = (css) => [...css.matchAll(/:root\s*\{[^}]*\}/g)].map((match) => match[0]);
const darkOf = (css) => css.slice(css.indexOf(SCHEME));
const declared = (block) => new Set([...block.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]));

const COLOURS = ["--bg", "--surface", "--sunken", "--stage", "--stage-dot", "--line", "--line-strong", "--control", "--text", "--text-2", "--muted", "--faint", "--accent", "--accent-hover", "--on-accent", "--accent-soft", "--ok", "--ok-soft", "--revise", "--revise-soft", "--on-status", "--focus", "--scrim", "--shadow-1", "--shadow-2", "--shadow-frame"];

describe("aidd-ui showcase look", () => {
  it("defines every colour role in the light scheme and again in the dark one", () => {
    const css = styleOf(pages()["index.html"]);
    assert.ok(css.includes(SCHEME), "a dark scheme");
    const light = declared(rootsOf(css.slice(0, css.indexOf(SCHEME)))[0]);
    const dark = declared(rootsOf(darkOf(css))[0]);
    for (const name of COLOURS) {
      assert.ok(light.has(name), `${name} in the light scheme`);
      assert.ok(dark.has(name), `${name} in the dark scheme`);
    }
    assert.match(rootsOf(darkOf(css))[0], /color-scheme: dark/);
  });

  it("writes no colour outside the role tokens, on any page of the chrome", () => {
    const all = pages();
    for (const name of ["index.html", "button.html", "_set-ecran-start.html", "brand.html"].filter((each) => all[each])) {
      const outside = styleOf(all[name]).replace(/:root\s*\{[^}]*\}/g, "");
      assert.deepEqual(outside.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\(/g) ?? [], [], name);
    }
  });

  it("defines every variable a page reads", () => {
    const all = pages();
    for (const name of ["index.html", "button.html", "_set-ecran-start.html"]) {
      const css = styleOf(all[name]);
      const defined = new Set([...declared(css), ...Object.values(all).flatMap((html) => [...declared(html.replace(/<style>[\s\S]*?<\/style>/, ""))])]);
      const read = [...css.matchAll(/var\((--[\w-]+)\s*[,)]/g)].map((match) => match[1]);
      assert.deepEqual([...new Set(read)].filter((each) => !defined.has(each)), [], name);
    }
  });

  it("gives way to the reader's preference for less motion", () => {
    const css = styleOf(pages()["index.html"]);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[^@]*transition-duration: \.01ms !important[^@]*animation-duration: \.01ms !important/);
  });

  it("rings the focused control in the focus role, inside a segment as well", () => {
    const css = styleOf(pages()["index.html"]);
    assert.match(css, /:focus-visible \{[^}]*outline: 2px solid var\(--focus\)[^}]*box-shadow: 0 0 0 4px var\(--focus-halo\)/);
    assert.match(css, /\.choose :focus-visible[^{]*\{[^}]*outline-offset: -2px/);
  });

  it("keeps the verdict bar in reach without cutting it: the review clips, never hides", () => {
    const css = styleOf(pages()["button.html"]);
    assert.match(css, /\.verdict-bar \{[^}]*position: sticky; bottom: 0/);
    assert.match(css, /\n\.review \{[^}]*overflow: clip/);
    assert.doesNotMatch(css.match(/\n\.review \{[^}]*\}/)[0], /overflow: hidden/);
  });

  it("promotes the next state once the current one has a verdict", () => {
    const css = styleOf(pages()["button.html"]);
    assert.match(css, /\.verdict-bar:has\(\.verdict\[aria-pressed="true"\]\) \.next-state \{[^}]*background: var\(--accent\)/);
  });

  it("shows an element at a compact ratio, a screen at the phone ratio", () => {
    const css = styleOf(pages()["index.html"]);
    assert.match(css, /\.thumb\.m \{[^}]*--w: 320px; --h: 240px/);
    assert.match(css, /\.thumb\.l \{[^}]*--w: 390px; --h: 520px/);
  });
});
