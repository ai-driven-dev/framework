const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { UI, writeProject, generateStylesheet, edit, editTokens, put } = require("./fixtures/aidd-ui/project.js");

// Each rule has one mutation of the valid project, and the test asserts the whole problem
// list: dropping the rule turns its own test red and leaves every other one green.
const LIB = path.resolve(__dirname, "../../plugins/aidd-ui/hooks/lib");
const { load } = require(path.join(LIB, "project.cjs"));
const tokens = require(path.join(LIB, "tokens.cjs"));
const renders = require(path.join(LIB, "renders.cjs"));

const TOKENS = `${UI}/tokens.json`;
const SYSTEM = `${UI}/system.md`;
const BUTTON = `${UI}/components/button.md`;
const BUTTON_RENDER = `${UI}/components/button.html`;
const DIALOG = `${UI}/components/dialog.md`;
const DIALOG_RENDER = `${UI}/components/dialog.html`;
const HOME = `${UI}/screens/home.md`;
const HOME_RENDER = `${UI}/screens/home.html`;
const STYLESHEET = `${UI}/tokens.css`;
const STYLESHEET_LINK = '<link rel="stylesheet" href="../tokens.css">\n';
const RESOLVER = `${UI}/tokens.resolver.json`;
const DARK = `${UI}/themes/dark.json`;
const DESKTOP = `${UI}/breakpoints/desktop.json`;
const INSERTED_LINE = 28; // the line before </body> in button.html

let tmp;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aidd-ui-tokens-renders-"));
  writeProject(tmp);
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  assert.equal(fs.existsSync(tmp), false);
});

/** Every problem both checks find, as `file: message`. */
function problems() {
  const project = load(tmp);
  return [...tokens.check(project), ...renders.check(project)].map((problem) => `${problem.file}: ${problem.message}`);
}

/** Adds one token under a `misc` group. */
const addToken = (name, token) => editTokens(tmp, (tree) => (tree.misc = { ...tree.misc, [name]: token }));

/** Adds one element to button.html, on the line before </body>. */
const addToRender = (html) => edit(tmp, BUTTON_RENDER, "</body>", `${html}\n</body>`);

/** Rewrites a JSON file of the project through `change`, which edits it in place. */
const editJson = (file, change) => {
  const full = path.join(tmp, file);
  const value = JSON.parse(fs.readFileSync(full, "utf8"));
  change(value);
  fs.writeFileSync(full, JSON.stringify(value));
};

describe("aidd-ui tokens and renders", () => {
  it("passes the valid project", () => {
    assert.deepEqual(problems(), []);
  });

  it("names every token's CSS custom property", () => {
    const names = tokens.cssNames(load(tmp));
    assert.ok(names.has("--color-text-default"));
    assert.equal(names.size, 8);
  });

  describe("T1 JSON", () => {
    it("names a tokens file that is not JSON", () => {
      fs.writeFileSync(path.join(tmp, TOKENS), "{ not json");
      assert.deepEqual(problems(), [`${TOKENS}: not JSON`]);
    });

    it("reads a tokens file behind a byte order mark, as Windows editors write it", () => {
      const file = path.join(tmp, TOKENS);
      fs.writeFileSync(file, `﻿${fs.readFileSync(file, "utf8")}`);
      assert.deepEqual(problems(), []);
    });

    it("names a missing tokens file once, and nothing that depends on it", () => {
      fs.rmSync(path.join(tmp, TOKENS));
      assert.deepEqual(problems(), [`${TOKENS}: missing`]);
    });
  });

  describe("T2 names", () => {
    it("names a $ key that is not reserved", () => {
      editTokens(tmp, (tree) => (tree.color.$foo = 1));
      assert.deepEqual(problems(), [`${TOKENS}: color.$foo: "$foo" is not a reserved key`]);
    });

    it("names a token that holds tokens: its children would be dropped", () => {
      editTokens(tmp, (tree) => (tree.space.md.wide = { $type: "dimension", $value: { value: 2, unit: "rem" } }));
      assert.deepEqual(problems(), [`${TOKENS}: space.md: a token never contains tokens, name them beside it`]);
    });

    it("names a name holding a dot", () => {
      addToken("a.b", { $type: "number", $value: 1 });
      assert.deepEqual(problems(), [`${TOKENS}: misc.a.b: a name never holds ".", "{" or "}"`]);
    });
  });

  describe("T3 value and type", () => {
    const cases = [
      [{ $type: "number" }, "no $value"],
      [{ $value: 1 }, "no $type on it, its alias or a parent group"],
      [{ $type: "colour", $value: 1 }, '$type "colour" is not a DTCG type'],
    ];
    for (const [token, message] of cases) {
      it(`names a token with ${message}`, () => {
        addToken("x", token);
        assert.deepEqual(problems(), [`${TOKENS}: misc.x: ${message}`]);
      });
    }
  });

  describe("T4 primitive shapes", () => {
    const cases = [
      [{ $type: "color", $value: { colorSpace: "cmyk", components: [0, 0, 0] } }, 'colorSpace "cmyk" is not a DTCG colour space'],
      [{ $type: "color", $value: { colorSpace: "srgb", components: [0, 0] } }, 'components must be three numbers or "none"'],
      [{ $type: "color", $value: { colorSpace: "srgb", components: [0, 0, 0], hex: "#fff" } }, 'hex "#fff" must be # and six hex digits'],
      [{ $type: "dimension", $value: { value: 1, unit: "em" } }, 'unit "em" must be px or rem'],
      [{ $type: "duration", $value: { value: 1, unit: "min" } }, 'unit "min" must be ms or s'],
      [{ $type: "fontWeight", $value: 1200 }, "fontWeight 1200 must be 1 to 1000 or a keyword"],
      [{ $type: "cubicBezier", $value: [1.5, 0, 0.5, 1] }, "cubicBezier needs four numbers, x in 0..1"],
    ];
    for (const [token, message] of cases) {
      it(`names ${message}`, () => {
        addToken("x", token);
        assert.deepEqual(problems(), [`${TOKENS}: misc.x: ${message}`]);
      });
    }
  });

  describe("T5 aliases", () => {
    it("names an alias to no token", () => {
      addToken("x", { $type: "color", $value: "{color.missing}" });
      assert.deepEqual(problems(), [`${TOKENS}: misc.x: alias {color.missing} names no token`]);
    });

    it("names an alias to a group", () => {
      addToken("x", { $type: "color", $value: "{color.brand}" });
      assert.deepEqual(problems(), [`${TOKENS}: misc.x: alias {color.brand} names a group, not a token`]);
    });

    it("names an alias to a token of another type", () => {
      addToken("x", { $type: "dimension", $value: "{color.brand.primary}" });
      assert.deepEqual(problems(), [`${TOKENS}: misc.x: alias {color.brand.primary} is a color, not a dimension`]);
    });

    it("names each token of an alias cycle, and still checks the rest", () => {
      addToken("a", { $value: "{misc.b}" });
      addToken("b", { $value: "{misc.a}" });
      assert.deepEqual(problems(), [`${TOKENS}: misc.a: alias {misc.b} loops back to misc.a`, `${TOKENS}: misc.b: alias {misc.a} loops back to misc.b`]);
    });

    it("ends the walk from a token that leads into a cycle it is not part of", () => {
      addToken("a", { $value: "{misc.b}" });
      addToken("b", { $value: "{misc.a}" });
      addToken("c", { $value: "{misc.a}" });
      assert.deepEqual(problems(), [
        `${TOKENS}: misc.c: no $type on it, its alias or a parent group`,
        `${TOKENS}: misc.a: alias {misc.b} loops back to misc.a`,
        `${TOKENS}: misc.b: alias {misc.a} loops back to misc.b`,
      ]);
    });

    it("names a broken alias once, not again for its missing type", () => {
      addToken("x", { $value: "{color.missing}" });
      assert.deepEqual(problems(), [`${TOKENS}: misc.x: alias {color.missing} names no token`]);
    });
  });

  describe("T6 themes", () => {
    const contexts = (resolver) => resolver.modifiers.theme.contexts;

    it("names a missing resolver when system.md declares more than one theme", () => {
      fs.rmSync(path.join(tmp, RESOLVER));
      assert.deepEqual(problems(), [`${RESOLVER}: missing`]);
    });

    it("needs no resolver for one theme", () => {
      fs.rmSync(path.join(tmp, RESOLVER));
      edit(tmp, SYSTEM, "themes: [light, dark]", "themes: [light]");
      generateStylesheet(tmp);
      assert.deepEqual(problems(), []);
    });

    const resolverCases = [
      ["a version other than 2025.10", (r) => (r.version = "2024"), 'version must be "2025.10"'],
      ["no set holding tokens.json", (r) => (r.sets.base.sources = []), "no set holds tokens.json"],
      ["no theme modifier", (r) => delete r.modifiers.theme, 'no "theme" modifier with contexts'],
      ["a resolution order that never applies the themes", (r) => r.resolutionOrder.splice(1, 1), "resolutionOrder never applies #/modifiers/theme"],
      ["a default that is not the first theme", (r) => (r.modifiers.theme.default = "dark"), `the theme modifier's default must be "light", the first theme in system.md`],
      ["a theme without its context", (r) => delete contexts(r).dark, 'no context for theme "dark"'],
      ["a context system.md lacks", (r) => (contexts(r).sepia = []), 'context "sepia" is not a theme in system.md'],
      ["a source that is no file reference", (r) => contexts(r).dark.push({ color: {} }), 'context "dark": each source is {"$ref": "<file>"}'],
      ["a base context listing a source its block would never carry", (r) => contexts(r).light.push({ $ref: "themes/dark.json" }), 'context "light" is the base, held by tokens.json: it lists no source'],
    ];
    for (const [name, change, message] of resolverCases) {
      it(`names ${name}`, () => {
        editJson(RESOLVER, change);
        assert.deepEqual(problems(), [`${RESOLVER}: ${message}`]);
      });
    }

    it("names a theme file the resolver names but the project lacks", () => {
      fs.rmSync(path.join(tmp, DARK));
      assert.deepEqual(problems(), [`${DARK}: missing`]);
    });

    it("names a themed token tokens.json lacks", () => {
      editJson(DARK, (tree) => (tree.color.ghost = { $value: "{color.brand.primary}" }));
      assert.deepEqual(problems(), [`${DARK}: color.ghost: theme "dark" redefines no token of tokens.json`]);
    });

    it("names a themed token whose type differs from its base", () => {
      editJson(DARK, (tree) => (tree.color.brand.primary.$type = "dimension"));
      assert.deepEqual(problems(), [`${DARK}: color.brand.primary: $type "dimension" differs from tokens.json's "color"`]);
    });

    it("names a theme value of the wrong shape", () => {
      editJson(DARK, (tree) => (tree.color.brand.primary.$value.components = [0.4, 0.6]));
      assert.deepEqual(problems(), [`${DARK}: color.brand.primary: theme "dark": components must be three numbers or "none"`]);
    });

    it("names a theme value aliasing a token of another type", () => {
      editJson(DARK, (tree) => (tree.color.brand.primary.$value = "{space.md}"));
      assert.deepEqual(problems(), [`${DARK}: color.brand.primary: theme "dark": alias {space.md} is a dimension, not a color`]);
    });
  });

  describe("T6 raw CSS in a theme file", () => {
    const rawDark = (css) =>
      editJson(DARK, (tree) => {
        tree.color.brand.primary = { $extensions: { "dev.ai-driven.css": css } };
      });

    it("accepts a value DTCG cannot hold, and writes it in the theme block", () => {
      rawDark("color-mix(in oklab, black 20%, white)");
      generateStylesheet(tmp);
      assert.deepEqual(problems(), []);
      assert.match(fs.readFileSync(path.join(tmp, STYLESHEET), "utf8"), /--color-brand-primary: color-mix\(in oklab, black 20%, white\);/);
    });

    it("names a var() that names no token", () => {
      rawDark("var(--nope)");
      assert.deepEqual(problems(), [`${DARK}: color.brand.primary: var(--nope) names no token`]);
    });

    it("names an empty raw value", () => {
      rawDark(" ");
      assert.deepEqual(problems(), [`${DARK}: color.brand.primary: dev.ai-driven.css must be a CSS value`]);
    });
  });

  describe("T6 breakpoints", () => {
    const modifier = (resolver) => resolver.modifiers.breakpoint;
    const media = (resolver) => modifier(resolver).$extensions["dev.ai-driven.media"];

    const resolverCases = [
      ["a modifier without contexts", (r) => delete modifier(r).contexts, 'no "breakpoint" modifier with contexts'],
      ["a resolution order that never applies it", (r) => r.resolutionOrder.pop(), "resolutionOrder never applies #/modifiers/breakpoint"],
      ["a context system.md lacks", (r) => { modifier(r).contexts.tablet = []; media(r).tablet = "(min-width: 40rem)"; }, 'context "tablet" is not a breakpoint in system.md'],
      ["no default, so no input resolves it", (r) => delete modifier(r).default, "the breakpoint modifier's default must name the context tokens.json holds"],
      ["a default that is no context", (r) => (modifier(r).default = "tablet"), "the breakpoint modifier's default must name the context tokens.json holds"],
      ["a default context listing a source its block would never carry", (r) => modifier(r).contexts.mobile.push({ $ref: "breakpoints/desktop.json" }), 'context "mobile" is the default, held by tokens.json: it lists no source'],
      ["a media query for the default context", (r) => (media(r).mobile = "(max-width: 10rem)"), 'dev.ai-driven.media "mobile" names no context outside the default'],
      ["a media query for no context", (r) => (media(r).tablet = "(min-width: 40rem)"), 'dev.ai-driven.media "tablet" names no context outside the default'],
      ["a context without its media query", (r) => delete media(r).desktop, 'context "desktop" has no media string under dev.ai-driven.media'],
      ["an empty media query", (r) => (media(r).desktop = " "), 'context "desktop" has no media string under dev.ai-driven.media'],
      ["a source that is no file reference", (r) => modifier(r).contexts.desktop.push({ space: {} }), 'context "desktop": each source is {"$ref": "<file>"}'],
    ];
    for (const [name, change, message] of resolverCases) {
      it(`names ${name}`, () => {
        editJson(RESOLVER, change);
        assert.deepEqual(problems(), [`${RESOLVER}: ${message}`]);
      });
    }

    describe("in the order of system.md", () => {
      const TABLET = `${UI}/breakpoints/tablet.json`;
      /** Three breakpoints in system.md, with the resolver's contexts in `order`. */
      const threeBreakpoints = (declared, order, defaultContext) => {
        edit(tmp, `${UI}/system.md`, "breakpoints: [mobile, desktop]", `breakpoints: [${declared.join(", ")}]`);
        put(tmp, TABLET, JSON.stringify({ space: { md: { $type: "dimension", $value: { value: 1.25, unit: "rem" } } } }));
        const files = { tablet: [{ $ref: "breakpoints/tablet.json" }], desktop: [{ $ref: "breakpoints/desktop.json" }], mobile: [{ $ref: "breakpoints/desktop.json" }] };
        editJson(RESOLVER, (r) => {
          modifier(r).default = defaultContext;
          modifier(r).contexts = Object.fromEntries(order.map((name) => [name, name === defaultContext ? [] : files[name]]));
          modifier(r).$extensions["dev.ai-driven.media"] = Object.fromEntries(order.filter((name) => name !== defaultContext).map((name) => [name, `(width: ${name})`]));
        });
        generateStylesheet(tmp);
      };

      it("passes contexts in that order, smallest first", () => {
        threeBreakpoints(["mobile", "tablet", "desktop"], ["mobile", "tablet", "desktop"], "mobile");
        assert.deepEqual(problems(), []);
      });

      it("passes contexts in that order, largest first", () => {
        threeBreakpoints(["desktop", "tablet", "mobile"], ["desktop", "tablet", "mobile"], "desktop");
        assert.deepEqual(problems(), []);
      });

      it("names a swap, which would change which value wins", () => {
        threeBreakpoints(["mobile", "tablet", "desktop"], ["mobile", "desktop", "tablet"], "mobile");
        assert.deepEqual(problems(), [`${RESOLVER}: breakpoint contexts desktop, tablet must follow system.md, tablet, desktop: the order of the @media blocks decides which value wins`]);
      });

      it("passes a default listed before a context system.md places first: the default writes no block", () => {
        put(tmp, `${UI}/breakpoints/mobile.json`, JSON.stringify({ space: { md: { $value: { value: 0.75, unit: "rem" } } } }));
        editJson(RESOLVER, (r) => {
          modifier(r).default = "desktop";
          modifier(r).contexts = { desktop: [], mobile: [{ $ref: "breakpoints/mobile.json" }] };
          modifier(r).$extensions["dev.ai-driven.media"] = { mobile: "(max-width: 640px)" };
        });
        generateStylesheet(tmp);
        assert.deepEqual(problems(), []);
      });

      it("reads the order without a context system.md lacks", () => {
        threeBreakpoints(["mobile", "desktop"], ["mobile", "tablet", "desktop"], "mobile");
        assert.deepEqual(problems(), [`${RESOLVER}: context "tablet" is not a breakpoint in system.md`]);
      });
    });

    it("names a context file the project lacks", () => {
      fs.rmSync(path.join(tmp, DESKTOP));
      assert.deepEqual(problems(), [`${DESKTOP}: missing`]);
    });

    it("names a token tokens.json lacks", () => {
      editJson(DESKTOP, (tree) => (tree.space.ghost = { $value: { value: 1, unit: "rem" } }));
      assert.deepEqual(problems(), [`${DESKTOP}: space.ghost: breakpoint "desktop" redefines no token of tokens.json`]);
    });

    it("names a token whose type differs from its base", () => {
      editJson(DESKTOP, (tree) => (tree.space.md.$type = "color"));
      assert.deepEqual(problems(), [`${DESKTOP}: space.md: $type "color" differs from tokens.json's "dimension"`]);
    });

    it("names the missing type of a base token holding none, never \"undefined\"", () => {
      addToken("ring", { $extensions: { "dev.ai-driven.css": "0 0 0 2px red" } });
      editJson(DESKTOP, (tree) => (tree.misc = { ring: { $type: "shadow", $extensions: { "dev.ai-driven.css": "none" } } }));
      generateStylesheet(tmp);
      assert.deepEqual(problems(), [`${DESKTOP}: misc.ring: $type "shadow" has nothing to match, tokens.json's token has no $type`]);
    });

    it("names a value of the wrong shape", () => {
      editJson(DESKTOP, (tree) => (tree.space.md.$value.unit = "em"));
      assert.deepEqual(problems(), [`${DESKTOP}: space.md: breakpoint "desktop": unit "em" must be px or rem`]);
    });

    describe("set by a theme too", () => {
      const BOTH = (name) => `${DESKTOP}: ${name}: theme "dark" and breakpoint "desktop" both set it, so a themed region would ignore the breakpoint`;

      it("names a token both redefine", () => {
        editJson(DARK, (tree) => (tree.space = { md: { $value: { value: 3, unit: "rem" } } }));
        assert.deepEqual(problems(), [BOTH("space.md")]);
      });

      it("names a token the theme block redeclares as a dependent, which would freeze it", () => {
        editJson(DESKTOP, (tree) => (tree.color = { text: { default: { $value: { colorSpace: "srgb", components: [0, 0, 0], hex: "#000000" } } } }));
        assert.deepEqual(problems(), [BOTH("color.text.default")]);
      });

      it("names a breakpoint value citing a token a theme redefines, which a themed region would inherit stale", () => {
        addToken("accent", { $type: "color", $value: { colorSpace: "srgb", components: [1, 0, 0], hex: "#ff0000" } });
        editJson(DESKTOP, (tree) => (tree.misc = { accent: { $value: "{color.brand.primary}" } }));
        assert.deepEqual(problems(), [BOTH("misc.accent")]);
      });

      it("accepts a dependent citing one token of each: its var()s recompute", () => {
        addToken("both", { $type: "dimension", $extensions: { "dev.ai-driven.css": "calc(var(--space-md) + var(--color-brand-primary))" } });
        assert.deepEqual(problems(), []);
      });
    });

    describe("with one theme", () => {
      const oneTheme = () => {
        edit(tmp, SYSTEM, "themes: [light, dark]", "themes: [light]");
        editJson(RESOLVER, (r) => {
          delete r.modifiers.theme;
          r.resolutionOrder.splice(1, 1);
        });
      };

      it("takes a resolver for breakpoints alone", () => {
        oneTheme();
        generateStylesheet(tmp);
        assert.deepEqual(problems(), []);
        assert.ok(fs.readFileSync(path.join(tmp, STYLESHEET), "utf8").includes("@media (min-width: 64rem) {"));
      });

      it("still checks it", () => {
        oneTheme();
        editJson(RESOLVER, (r) => delete modifier(r).default);
        assert.deepEqual(problems(), [`${RESOLVER}: the breakpoint modifier's default must name the context tokens.json holds`]);
      });
    });

    it("needs no modifier", () => {
      editJson(RESOLVER, (r) => {
        delete r.modifiers.breakpoint;
        r.resolutionOrder.pop();
      });
      generateStylesheet(tmp);
      assert.deepEqual(problems(), []);
    });
  });

  describe("a loop across declarations", () => {
    const SELF = "cites itself, so the browser computes nothing: write a primitive value";
    const raw = (css, type = "dimension") => ({ $type: type, $extensions: { "dev.ai-driven.css": css } });

    it("names a theme value citing a token that aliases it", () => {
      editJson(DARK, (tree) => (tree.color.brand.primary.$value = "{color.text.default}"));
      assert.deepEqual(problems(), [`${DARK}: color.brand.primary: theme "dark": cites --color-text-default, which leads back to it`]);
    });

    it("names a theme's raw value citing itself, and says what to write", () => {
      editJson(DARK, (tree) => (tree.color.brand.primary = { $extensions: { "dev.ai-driven.css": "color-mix(in srgb, var(--color-brand-primary) 80%, black)" } }));
      assert.deepEqual(problems(), [`${DARK}: color.brand.primary: theme "dark": ${SELF}`]);
    });

    it("names a breakpoint value citing a token that depends on it", () => {
      addToken("gap", { $type: "dimension", $value: "{space.md}" });
      editJson(DESKTOP, (tree) => (tree.space.md = { $extensions: { "dev.ai-driven.css": "calc(var(--misc-gap) * 2)" } }));
      assert.deepEqual(problems(), [`${DESKTOP}: space.md: breakpoint "desktop": cites --misc-gap, which leads back to it`]);
    });

    it("names each raw token of a cycle in tokens.json", () => {
      addToken("a", raw("var(--misc-b)"));
      addToken("b", raw("var(--misc-a)"));
      assert.deepEqual(problems(), [`${TOKENS}: misc.a: cites --misc-b, which leads back to it`, `${TOKENS}: misc.b: cites --misc-a, which leads back to it`]);
    });

    it("names a raw token of tokens.json citing itself", () => {
      addToken("a", raw("calc(var(--misc-a) * 2)"));
      assert.deepEqual(problems(), [`${TOKENS}: misc.a: ${SELF}`]);
    });

    it("leaves a token depending on a cycle it is not part of to that cycle's names", () => {
      addToken("a", raw("var(--misc-b)"));
      addToken("b", raw("var(--misc-a)"));
      addToken("c", raw("var(--misc-a)"));
      assert.deepEqual(problems(), [`${TOKENS}: misc.a: cites --misc-b, which leads back to it`, `${TOKENS}: misc.b: cites --misc-a, which leads back to it`]);
    });

    it("accepts a theme inverting an alias, the base's citation being replaced", () => {
      editJson(DARK, (tree) => {
        tree.color.brand.primary.$value = "{color.text.default}";
        tree.color.text = { default: { $value: { colorSpace: "srgb", components: [1, 1, 1], hex: "#ffffff" } } };
      });
      generateStylesheet(tmp);
      assert.deepEqual(problems(), []);
    });

    it("accepts a theme value citing a token that does not lead back", () => {
      editJson(DARK, (tree) => (tree.color.action = { default: { $value: "{color.brand.primary}" } }));
      generateStylesheet(tmp);
      assert.deepEqual(problems(), []);
    });
  });

  describe("T7 cited tokens", () => {
    it("names a component token absent from tokens.json", () => {
      edit(tmp, BUTTON, "tokens: [color.action.default,", "tokens: [space.huge, color.action.default,");
      assert.deepEqual(problems(), [`${BUTTON}: token "space.huge" is not in tokens.json`]);
    });

    it("names a screen token absent from tokens.json", () => {
      edit(tmp, HOME, "tokens: [space.md,", "tokens: [space.huge, space.md,");
      assert.deepEqual(problems(), [`${HOME}: token "space.huge" is not in tokens.json`]);
    });
  });

  describe("raw CSS values", () => {
    it("names a var() in a raw value that names no token, since it is a dependency", () => {
      addToken("x", { $extensions: { "dev.ai-driven.css": "color-mix(in srgb, var(--color-brand-gone) 20%, white)" } });
      assert.deepEqual(problems(), [`${TOKENS}: misc.x: var(--color-brand-gone) names no token`]);
    });

    it("accepts a value DTCG cannot hold under its extension", () => {
      addToken("x", { $extensions: { "dev.ai-driven.css": "color-mix(in srgb, var(--color-brand-primary) 20%, white)" } });
      assert.deepEqual(problems(), []);
    });

    it("names an empty raw value", () => {
      addToken("x", { $extensions: { "dev.ai-driven.css": "" } });
      assert.deepEqual(problems(), [`${TOKENS}: misc.x: dev.ai-driven.css must be a CSS value`]);
    });

    it("names $root, which is not supported", () => {
      addToken("x", { $root: { $type: "number", $value: 1 }, y: { $type: "number", $value: 2 } });
      assert.deepEqual(problems(), [`${TOKENS}: misc.x.$root: "$root" is not supported, name the token`]);
    });
  });

  describe("T8 semantic tokens", () => {
    it("names a component citing a primitive token", () => {
      edit(tmp, BUTTON, "tokens: [color.action.default,", "tokens: [color.brand.primary, color.action.default,");
      assert.deepEqual(problems(), [`${BUTTON}: token "color.brand.primary" is a primitive, use a semantic token`]);
    });
  });

  describe("T10 generated stylesheet", () => {
    const REGENERATE = "with the engine's tokens command";

    it("names a stylesheet the tokens no longer generate", () => {
      edit(tmp, TOKENS, '"value": 1,', '"value": 2,');
      assert.deepEqual(problems(), [`${STYLESHEET}: out of date with the tokens, regenerate it ${REGENERATE}`]);
    });

    it("names a stylesheet a theme file no longer generates", () => {
      edit(tmp, DARK, "#6699cc", "#112233");
      assert.deepEqual(problems(), [`${STYLESHEET}: out of date with the tokens, regenerate it ${REGENERATE}`]);
    });

    it("names a stylesheet a breakpoint file no longer generates", () => {
      edit(tmp, DESKTOP, '"value": 1.5', '"value": 2');
      assert.deepEqual(problems(), [`${STYLESHEET}: out of date with the tokens, regenerate it ${REGENERATE}`]);
    });

    it("holds the media query verbatim, after the theme block", () => {
      const css = fs.readFileSync(path.join(tmp, STYLESHEET), "utf8");
      assert.ok(css.endsWith('@media (min-width: 64rem) {\n  :root, [data-theme="light"] {\n    --space-md: 1.5rem;\n  }\n}\n'));
      assert.ok(css.indexOf('[data-theme="dark"] {') < css.indexOf("@media"));
    });

    it("names a stylesheet edited by hand", () => {
      edit(tmp, STYLESHEET, "--space-md: 1rem;", "--space-md: 2rem;");
      assert.deepEqual(problems(), [`${STYLESHEET}: out of date with the tokens, regenerate it ${REGENERATE}`]);
    });

    it("names a missing stylesheet", () => {
      fs.rmSync(path.join(tmp, STYLESHEET));
      assert.deepEqual(problems(), [`${STYLESHEET}: missing, generate it ${REGENERATE}`]);
    });

    it("leaves the stylesheet alone while the tokens have an error: that error comes first", () => {
      editTokens(tmp, (tree) => (tree.space.md.$value = { value: 1, unit: "em" }));
      assert.deepEqual(problems(), [`${TOKENS}: space.md: unit "em" must be px or rem`]);
    });

    it("names a composite token without raw CSS, which no stylesheet can carry", () => {
      addToken("shadow", { $type: "shadow", $value: { color: "#000000" } });
      assert.deepEqual(problems(), [`${TOKENS}: misc.shadow: a shadow has no CSS of its own, give it a dev.ai-driven.css value`]);
    });

    it("accepts a composite token that has raw CSS", () => {
      addToken("shadow", { $type: "shadow", $value: { color: "#000000" }, $extensions: { "dev.ai-driven.css": "0 1px 2px black" } });
      assert.deepEqual(problems(), []);
    });
  });

  describe("V8 stylesheet linked", () => {
    it("names a component render that does not load tokens.css", () => {
      edit(tmp, BUTTON_RENDER, STYLESHEET_LINK, "");
      assert.deepEqual(problems(), [`${BUTTON_RENDER}: does not load ../tokens.css, add ${STYLESHEET_LINK.trim()}`]);
    });

    it("names a screen render that does not load tokens.css", () => {
      edit(tmp, HOME_RENDER, STYLESHEET_LINK, "");
      assert.deepEqual(problems(), [`${HOME_RENDER}: does not load ../tokens.css, add ${STYLESHEET_LINK.trim()}`]);
    });

    it("names a render that links another stylesheet", () => {
      edit(tmp, BUTTON_RENDER, "../tokens.css", "../other.css");
      assert.deepEqual(problems(), [`${BUTTON_RENDER}: does not load ../tokens.css, add ${STYLESHEET_LINK.trim()}`]);
    });
  });

  describe("V1 render present", () => {
    it("names a component without its render", () => {
      fs.rmSync(path.join(tmp, DIALOG_RENDER));
      assert.deepEqual(problems(), [`${DIALOG}: no render beside it, expected dialog.html`]);
    });
  });

  describe("V2 every variant and state rendered", () => {
    it("names a declared variant the render lacks", () => {
      edit(tmp, BUTTON_RENDER, 'data-variant="secondary"', 'data-variant="primary"');
      assert.deepEqual(problems(), [`${BUTTON_RENDER}: no data-variant="secondary"`]);
    });

    it("names a declared state the render lacks", () => {
      edit(tmp, DIALOG_RENDER, 'data-state="hover"', 'data-state="default"');
      assert.deepEqual(problems(), [`${DIALOG_RENDER}: no data-state="hover"`]);
    });
  });

  describe("V2 variant axes", () => {
    const withAxes = () => edit(tmp, BUTTON, "variants: [primary, secondary]", "variants: [primary, secondary, size=sm, tone=danger]");

    it("asks for data-<axis> on an element, for each axis=value", () => {
      withAxes();
      assert.deepEqual(problems(), [`${BUTTON_RENDER}: no data-size="sm"`, `${BUTTON_RENDER}: no data-tone="danger"`]);
    });

    it("accepts an element carrying them", () => {
      withAxes();
      addToRender('<button class="ui" data-size="sm" data-tone="danger">Search</button>');
      assert.deepEqual(problems(), []);
    });

    it("does not take data-variant, or a selector in a style block, for the axis shown", () => {
      withAxes();
      addToRender('<button class="ui" data-variant="size=sm" data-tone="danger">Search</button>');
      edit(tmp, BUTTON_RENDER, "</style>", '[data-size="sm"] { color: var(--color-text-default); }\n</style>');
      assert.deepEqual(problems(), [`${BUTTON_RENDER}: no data-size="sm"`]);
    });
  });

  describe("V2 attributes outside style", () => {
    it("does not take a selector in a style block for the state shown", () => {
      edit(tmp, DIALOG_RENDER, 'data-state="hover"', 'data-state="default"');
      edit(tmp, DIALOG_RENDER, "</style>", '[data-state="hover"] { color: var(--space-md); }\n</style>');
      assert.deepEqual(problems(), [`${DIALOG_RENDER}: no data-state="hover"`]);
    });
  });

  describe("V3 token references", () => {
    it("names a custom property no token defines", () => {
      addToRender('<p style="color: var(--color-missing)">x</p>');
      assert.deepEqual(problems(), [`${BUTTON_RENDER}: line ${INSERTED_LINE}: var(--color-missing) names no token`]);
    });

    it("accepts a custom property the render sets itself", () => {
      addToRender('<p style="--badge-dot: var(--color-text-default); color: var(--badge-dot)">x</p>');
      assert.deepEqual(problems(), []);
    });
  });

  describe("V4 colour literals", () => {
    for (const [literal, found] of [["#336699", "#336699"], ["rgb(0, 0, 0)", "rgb("], ["hsl(0, 0%, 0%)", "hsl("]]) {
      it(`names ${found}`, () => {
        addToRender(`<p style="color: ${literal}">x</p>`);
        assert.deepEqual(problems(), [`${BUTTON_RENDER}: line ${INSERTED_LINE}: colour literal "${found}", use a token`]);
      });
    }
  });

  describe("V4 colours in attributes", () => {
    for (const attribute of ['fill="#336699"', "stroke='#336699'", 'color="#336699"', 'bgcolor="#336699"']) {
      it(`names ${attribute}`, () => {
        addToRender(`<svg ${attribute}></svg>`);
        assert.deepEqual(problems(), [`${BUTTON_RENDER}: line ${INSERTED_LINE}: colour literal "#336699", use a token`]);
      });
    }

    it("names a colour function too", () => {
      addToRender('<svg fill="rgb(0, 0, 0)"></svg>');
      assert.deepEqual(problems(), [`${BUTTON_RENDER}: line ${INSERTED_LINE}: colour literal "rgb(", use a token`]);
    });

    for (const value of ["currentColor", "none", "transparent", "inherit", "var(--color-text-default)", "var(--color-text-default, #336699)", "var(--color-text-default, rgb(0, 0, 0))"]) {
      it(`allows ${value}`, () => {
        addToRender(`<svg fill="${value}"></svg>`);
        assert.deepEqual(problems(), []);
      });
    }

    it("reads no other attribute, and no attribute of the same name in the text", () => {
      addToRender('<svg data-fill="#336699" aria-label="#336699"></svg>');
      addToRender("<p>fill #336699</p>");
      assert.deepEqual(problems(), []);
    });

    it("holds the attribute to colours alone: a length there is not V6's", () => {
      addToRender('<svg fill="16px"></svg>');
      assert.deepEqual(problems(), []);
    });
  });

  describe("V4 to V6 scope", () => {
    it("reads copy as copy: a hash and a length in the text are no literal", () => {
      addToRender("<p>Rapport #412, 16px de large, margin-left</p>");
      assert.deepEqual(problems(), []);
    });

    it("reads a style block, with its line", () => {
      addToRender("<style>\n.x { color: #336699; }\n</style>");
      assert.deepEqual(problems(), [`${BUTTON_RENDER}: line ${INSERTED_LINE + 1}: colour literal "#336699", use a token`]);
    });
  });

  describe("V6 unit literals", () => {
    for (const literal of ["16px", "1.5rem", "200ms"]) {
      it(`names ${literal}`, () => {
        addToRender(`<p style="inset-block-start: ${literal}">x</p>`);
        assert.deepEqual(problems(), [`${BUTTON_RENDER}: line ${INSERTED_LINE}: literal "${literal}", only tokens carry values`]);
      });
    }
  });

  describe("V6 var() fallbacks", () => {
    it("leaves a length inside var() alone: the fallback belongs to the token", () => {
      addToRender('<p style="padding-block: var(--space-md, 16px)">x</p>');
      assert.deepEqual(problems(), []);
    });
  });

  describe("V6 media and container queries", () => {
    it("leaves the lengths of @media and @container preludes alone", () => {
      addToRender("<style>@media (min-width: 768px) { .ui { color: var(--color-text-default); } }</style>");
      addToRender("<style>@container (width > 40rem) { .ui { color: var(--color-text-default); } }</style>");
      assert.deepEqual(problems(), []);
    });
  });

  describe("V7 declared tokens", () => {
    it("names a render using a token its record does not declare", () => {
      edit(tmp, `${UI}/components/dialog.html`, "</body>", '<p style="color: var(--color-brand-primary)">x</p>\n</body>');
      assert.deepEqual(problems(), [`${DIALOG_RENDER}: line 18: var(--color-brand-primary) is a token dialog does not declare`]);
    });
  });

  describe("V7 tokens of the elements a record uses", () => {
    it("lets a molecule's render show the tokens of what it uses, transitively", () => {
      edit(tmp, `${UI}/components/search-field.html`, "</body>", '<p style="color: var(--color-action-default)">x</p>\n</body>');
      edit(tmp, `${UI}/components/dialog.md`, "uses: [button]", "uses: [search-field]");
      edit(tmp, `${UI}/components/dialog.html`, "</body>", '<p style="color: var(--color-action-default)">x</p>\n</body>');
      assert.deepEqual(problems(), []);
    });
  });

  describe("V5 logical properties", () => {
    it("names a physical property when rtl is declared", () => {
      addToRender('<p style="margin-left: 0">x</p>');
      assert.deepEqual(problems(), [`${BUTTON_RENDER}: line ${INSERTED_LINE}: physical property "margin-left", use its logical form`]);
    });

    it("allows it when only ltr is declared", () => {
      edit(tmp, SYSTEM, "directions: [ltr, rtl]", "directions: [ltr]");
      addToRender('<p style="margin-left: 0">x</p>');
      assert.deepEqual(problems(), []);
    });
  });
});
