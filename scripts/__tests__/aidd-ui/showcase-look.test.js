const assert = require("node:assert/strict");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { LIB, makeTmp, removeTmp, writeProject } = require("../fixtures/aidd-ui/project.js");
const { load } = require(path.join(LIB, "project.cjs"));
const { showcaseOf, THEME, LABELS } = require(path.join(LIB, "showcase.cjs"));

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
const rootsOf = (css) => [...css.matchAll(/:root[^{]*\{[^}]*\}/g)].map((match) => match[0]);
const darkOf = (css) => css.slice(css.indexOf(SCHEME));
const declared = (block) => new Set([...block.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]));

const COLOURS = ["--bg", "--surface", "--sunken", "--stage", "--stage-dot", "--line", "--line-strong", "--control", "--text", "--text-2", "--muted", "--faint", "--accent", "--accent-hover", "--on-accent", "--accent-soft", "--ok", "--on-ok", "--ok-soft", "--revise", "--revise-soft", "--focus", "--scrim", "--shadow-1", "--shadow-2", "--shadow-frame"];

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
      const outside = styleOf(all[name]).replace(/:root[^{]*\{[^}]*\}/g, "");
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

  describe("the hierarchy of the verdict bar", () => {
    const css = () => styleOf(pages()["button.html"]);
    const ruleOf = (sheet, selector) => sheet.match(new RegExp(`\\n${selector.replace(/[.[\]()"=^$*+?|\\]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";

    it("fills OK in the success colour, in a label that reads on it in both schemes", () => {
      const rule = ruleOf(css(), '.verdict-bar .verdict[data-verdict="ok"]');
      assert.match(rule, /background: var\(--ok\)/);
      assert.match(rule, /color: var\(--on-ok\)/);
      const colour = require(path.join(LIB, "colour.cjs"));
      const sheet = css();
      const read = (block, name) => block.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]+)`))[1];
      const [light, dark] = [rootsOf(sheet.slice(0, sheet.indexOf(SCHEME)))[0], rootsOf(darkOf(sheet))[0]];
      for (const block of [light, dark]) assert.ok(colour.contrast(colour.parse(read(block, "--on-ok")), colour.parse(read(block, "--ok"))) >= 4.5);
    });

    it("outlines Revise, with no fill", () => {
      const rule = ruleOf(css(), ".verdict-bar .verdict");
      assert.match(rule, /background: transparent/);
      assert.match(rule, /border: 1px solid var\(--control\)/);
    });

    it("sets the way on as a quiet link: no fill, no edge, underlined", () => {
      const rule = ruleOf(css(), ".verdict-bar .next-state, .verdict-bar .next-record");
      assert.match(rule, /background: none/);
      assert.match(rule, /border: 0/);
      assert.match(rule, /text-decoration: underline/);
      assert.doesNotMatch(css(), /\.next-(state|record)[^{]*\{[^}]*background: var\(--accent\)/);
    });

    it("keeps the bar sticky at the bottom of the viewport", () => {
      assert.match(ruleOf(css(), ".verdict-bar"), /position: sticky; bottom: 0/);
    });
  });

  describe("the choice of a theme", () => {
    const html = () => pages()["index.html"];
    const rootOfBlock = (block) => Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{3,8})\b/g)].map((match) => [match[1], match[2]]));
    const colour = require(path.join(LIB, "colour.cjs"));

    it("applies a stored light or dark choice before the first paint, from the head, and works with no storage", () => {
      const head = html().match(/<head>[\s\S]*?<\/head>/)[0];
      const init = head.match(/<script data-theme-init>([\s\S]*?)<\/script>/)[1];
      assert.ok(head.indexOf("data-theme-init") < head.indexOf("<style>"), "before the styles");
      const run = (storage) => {
        const root = { dataset: {} };
        new Function("document", "localStorage", init)({ documentElement: root }, storage);
        return root.dataset.theme;
      };
      assert.equal(run({ getItem: () => "dark" }), "dark");
      assert.equal(run({ getItem: () => "light" }), "light");
      assert.equal(run({ getItem: () => "auto" }), undefined);
      assert.equal(run({ getItem: () => { throw new Error("blocked"); } }), undefined);
      assert.equal(run(undefined), undefined);
    });

    it("sets the dark chrome under the system preference unless the light theme is chosen, and under the dark theme chosen", () => {
      const css = styleOf(html());
      const system = rootsOf(darkOf(css))[0];
      assert.match(system, /^:root:not\(\[data-theme="light"\]\)/);
      const chosen = rootsOf(css).find((block) => block.startsWith(':root[data-theme="dark"]'));
      assert.ok(chosen, "a block for the dark theme chosen");
      assert.deepEqual(rootOfBlock(chosen), rootOfBlock(system));
      assert.match(chosen, /color-scheme: dark/);
    });

    it("makes the dark chrome a soft grey, not near-black, and keeps its text readable on it", () => {
      const css = styleOf(html());
      const dark = rootOfBlock(rootsOf(darkOf(css))[0]);
      for (const name of ["--bg", "--surface"]) for (const channel of [1, 3, 5]) assert.ok(parseInt(dark[name].slice(channel, channel + 2), 16) >= 0x22, `${name} is not near-black`);
      for (const front of ["--text", "--muted", "--faint"]) {
        for (const back of ["--bg", "--surface", "--sunken"]) assert.ok(colour.contrast(colour.parse(dark[front]), colour.parse(dark[back])) >= 4.5, `${front} on ${back}`);
      }
    });

    it("puts one button in the header of the sidebar, named in the language, in the mode it starts in", () => {
      for (const lang of ["en", "fr"]) {
        const page = showcaseOf({ project: load(tmp), tokens: ":root { --accent: #123456; }\n", captures: new Set(), lang, sets: [SET] })["index.html"];
        const header = page.match(/<div class="brand">[\s\S]*?<\/div>/)[0];
        assert.equal([...page.matchAll(/id="theme-toggle"/g)].length, 1);
        assert.match(header, new RegExp(`<button type="button" id="theme-toggle" class="theme-toggle" data-mode="auto" title="${LABELS[lang].themeChange}"[^>]*>${LABELS[lang].themeModes.auto}</button>`));
        for (const word of ["auto", "light", "dark"]) assert.ok(LABELS[lang].themeModes[word] && LABELS.en.themeModes[word] !== LABELS.fr.themeModes[word]);
      }
    });

    describe("its script", () => {
      const harness = (stored, storage = { setItem: (name, value) => (stored[name] = value) }) => {
        const listeners = {};
        const button = { dataset: { mode: "auto", modes: JSON.stringify(LABELS.en.themeModes) }, textContent: "", addEventListener: (type, listener) => (listeners[type] = listener), setAttribute() {} };
        const root = { dataset: stored.theme ? { theme: stored.theme } : {} };
        new Function("document", "localStorage", THEME)({ getElementById: (id) => (id === "theme-toggle" ? button : null), documentElement: root }, storage);
        return { button, root, click: () => listeners.click() };
      };

      it("cycles system, light, dark and back, applying each and writing it down", () => {
        const stored = {};
        const { button, root, click } = harness(stored);
        assert.equal(button.textContent, LABELS.en.themeModes.auto);
        click();
        assert.deepEqual([root.dataset.theme, button.dataset.mode, stored["aidd-ui-theme"]], ["light", "light", "light"]);
        click();
        assert.deepEqual([root.dataset.theme, button.textContent, stored["aidd-ui-theme"]], ["dark", LABELS.en.themeModes.dark, "dark"]);
        click();
        assert.deepEqual([root.dataset.theme, button.dataset.mode, stored["aidd-ui-theme"]], [undefined, "auto", "auto"]);
      });

      it("starts from the theme the head applied", () => {
        const { button } = harness({ theme: "dark" });
        assert.equal(button.dataset.mode, "dark");
        assert.equal(button.textContent, LABELS.en.themeModes.dark);
      });

      it("still cycles when the storage refuses a write or does not exist", () => {
        for (const storage of [{ setItem: () => { throw new Error("full"); } }, undefined]) {
          const { root, click } = harness({}, storage);
          click();
          assert.equal(root.dataset.theme, "light");
        }
      });
    });
  });

  it("shows an element at a compact ratio, a screen at the phone ratio", () => {
    const css = styleOf(pages()["index.html"]);
    assert.match(css, /\.thumb\.m \{[^}]*--w: 320px; --h: 240px/);
    assert.match(css, /\.thumb\.l \{[^}]*--w: 390px; --h: 520px/);
  });
});
