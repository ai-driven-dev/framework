const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { UI, writeProject, edit, editTokens } = require("./fixtures/aidd-ui/project.js");

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
const INSERTED_LINE = 30; // the line before </body> in button.html

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
    assert.equal(names.size, 7);
  });

  describe("T1 JSON", () => {
    it("names a tokens file that is not JSON", () => {
      fs.writeFileSync(path.join(tmp, TOKENS), "{ not json");
      assert.deepEqual(problems(), [`${TOKENS}: not JSON`]);
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
  });

  describe("T6 themes", () => {
    const themes = (tree) => tree.color.brand.primary.$extensions["dev.ai-driven.themes"];

    it("names a theme system.md lacks", () => {
      editTokens(tmp, (tree) => {
        themes(tree).sepia = themes(tree).dark;
        delete themes(tree).dark;
      });
      assert.deepEqual(problems(), [`${TOKENS}: color.brand.primary: theme "sepia" is not in system.md`]);
    });

    it("names a theme value of the wrong shape", () => {
      editTokens(tmp, (tree) => (themes(tree).dark.components = [0.4, 0.6]));
      assert.deepEqual(problems(), [`${TOKENS}: color.brand.primary: theme "dark": components must be three numbers or "none"`]);
    });
  });

  describe("T7 component tokens", () => {
    it("names a component token absent from tokens.json", () => {
      edit(tmp, BUTTON, "tokens: [color.brand.primary,", "tokens: [space.huge, color.brand.primary,");
      assert.deepEqual(problems(), [`${BUTTON}: token "space.huge" is not in tokens.json`]);
    });
  });

  describe("T8 sizes in rem", () => {
    it("names a dimension in px", () => {
      editTokens(tmp, (tree) => (tree.space.md.$value = { value: 16, unit: "px" }));
      assert.deepEqual(problems(), [`${TOKENS}: space.md: sizes are in rem, not px`]);
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

  describe("V6 media and container queries", () => {
    it("leaves the lengths of @media and @container preludes alone", () => {
      addToRender("<style>@media (min-width: 768px) { .ui { color: var(--color-text-default); } }</style>");
      addToRender("<style>@container (width > 40rem) { .ui { color: var(--color-text-default); } }</style>");
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
