const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { UI, writeProject, edit, editTokens, put } = require("./fixtures/aidd-ui/project.js");

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
const RESOLVER = `${UI}/tokens.resolver.json`;
const DARK = `${UI}/themes/dark.json`;
const INSERTED_LINE = 27; // the line before </body> in button.html

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
    /** Rewrites a JSON file of the project through `change`, which edits it in place. */
    const editJson = (file, change) => {
      const full = path.join(tmp, file);
      const value = JSON.parse(fs.readFileSync(full, "utf8"));
      change(value);
      fs.writeFileSync(full, JSON.stringify(value));
    };
    const contexts = (resolver) => resolver.modifiers.theme.contexts;

    it("names a missing resolver when system.md declares more than one theme", () => {
      fs.rmSync(path.join(tmp, RESOLVER));
      assert.deepEqual(problems(), [`${RESOLVER}: missing`]);
    });

    it("needs no resolver for one theme", () => {
      fs.rmSync(path.join(tmp, RESOLVER));
      edit(tmp, SYSTEM, "themes: [light, dark]", "themes: [light]");
      assert.deepEqual(problems(), []);
    });

    const resolverCases = [
      ["a version other than 2025.10", (r) => (r.version = "2024"), 'version must be "2025.10"'],
      ["no set holding tokens.json", (r) => (r.sets.base.sources = []), "no set holds tokens.json"],
      ["no theme modifier", (r) => delete r.modifiers.theme, 'no "theme" modifier with contexts'],
      ["a resolution order that never applies the themes", (r) => r.resolutionOrder.pop(), "resolutionOrder never applies #/modifiers/theme"],
      ["a default that is not the first theme", (r) => (r.modifiers.theme.default = "dark"), `the theme modifier's default must be "light", the first theme in system.md`],
      ["a theme without its context", (r) => delete contexts(r).dark, 'no context for theme "dark"'],
      ["a context system.md lacks", (r) => (contexts(r).sepia = []), 'context "sepia" is not a theme in system.md'],
      ["a source that is no file reference", (r) => contexts(r).dark.push({ color: {} }), 'context "dark": each source is {"$ref": "<file>"}'],
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
      edit(tmp, `${UI}/components/dialog.html`, "</body>", '<p style="color: var(--color-text-default)">x</p>\n</body>');
      assert.deepEqual(problems(), [`${DIALOG_RENDER}: line 17: var(--color-text-default) is a token dialog does not declare`]);
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
