const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { fixLedger, UI, PATHS, LIB, makeTmp, removeTmp, writeProject, generateStylesheet, edit, editTokens } = require("../fixtures/aidd-ui/project.js");

// V11 and V12 read a screen's render through the tokens the stylesheet resolves; the colours here
// are synthetic, chosen for the contrast ratio each case needs.
const { load } = require(path.join(LIB, "project.cjs"));
const tokens = require(path.join(LIB, "tokens.cjs"));
const renders = require(path.join(LIB, "renders.cjs"));

const { SYSTEM, HOME, HOME_RENDER, BUTTON_RENDER, DARK } = PATHS;
const HOME_TOKENS = "tokens: [space.md, color.text.default]";

let tmp;
const ledger = fixLedger();

beforeEach(() => {
  tmp = makeTmp("aidd-ui-renders-");
  writeProject(tmp);
});

afterEach(() => removeTmp(tmp));

/** Every problem both checks find, as `file: message`. */
function problems() {
  const project = load(tmp);
  return ledger.note([...tokens.check(project), ...renders.check(project)]).map((problem) => `${problem.file}: ${problem.message}`);
}

const srgb = (hex, alpha) => ({
  $type: "color",
  $value: { colorSpace: "srgb", components: [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255), hex, ...(alpha === undefined ? {} : { alpha }) },
});
const length = (value, unit) => ({ $type: "dimension", $value: { value, unit } });

const editJson = (file, change) => {
  const full = path.join(tmp, file);
  const value = JSON.parse(fs.readFileSync(full, "utf8"));
  change(value);
  fs.writeFileSync(full, JSON.stringify(value));
};

/** Adds `group.name` tokens to tokens.json, and `dark` ones to the dark theme, declared by home. */
function addTokens(group, base, dark = {}) {
  editTokens(tmp, (tree) => (tree[group] = base));
  if (Object.keys(dark).length) {
    editJson(DARK, (tree) => (tree[group] = dark));
    generateStylesheet(tmp);
  }
  edit(tmp, HOME, HOME_TOKENS, `tokens: [space.md, color.text.default, ${Object.keys(base).map((name) => `${group}.${name}`).join(", ")}]`);
}

/** Adds a style block and its markup to the home screen's render, before </body>. */
const addToHome = (css, markup = "") => edit(tmp, HOME_RENDER, "</body>", `<style>\n${css}\n</style>\n${markup}\n</body>`);

const WHITE = "#ffffff";
const BLACK = "#000000";
const PAIR = ".note { color: var(--ink-fg); background: var(--ink-bg); }";
const inks = (fg, bg, dark) => addTokens("ink", { fg: srgb(fg), bg: srgb(bg) }, dark);
const everyTheme = (tail) => ["light", "dark"].map((theme) => `${home}: ${theme}: ${tail}`);
const raw = (name, value) => `var(--ink-${name}) (${value})`;
const home = HOME_RENDER;

describe("aidd-ui V11 contrast", () => {
  it("passes a pair above the threshold", () => {
    inks(BLACK, WHITE);
    addToHome(PAIR);
    assert.deepEqual(problems(), []);
  });

  it("names an opaque pair below it, in every theme that shows it", () => {
    inks("#aaaaaa", WHITE);
    addToHome(PAIR);
    assert.deepEqual(problems(), everyTheme(`.note: ${raw("fg", "#aaaaaa")} on ${raw("bg", WHITE)} is 2.32:1, below 4.5`));
  });

  it("reads each theme with its own values: fails in light only", () => {
    inks("#aaaaaa", WHITE, { fg: srgb(BLACK) });
    addToHome(PAIR);
    assert.deepEqual(problems(), [`${home}: light: .note: ${raw("fg", "#aaaaaa")} on ${raw("bg", WHITE)} is 2.32:1, below 4.5`]);
  });

  it("reads each theme with its own values: fails in dark only", () => {
    inks(BLACK, WHITE, { fg: srgb("#aaaaaa") });
    addToHome(PAIR);
    assert.deepEqual(problems(), [`${home}: dark: .note: ${raw("fg", "#aaaaaa")} on ${raw("bg", WHITE)} is 2.32:1, below 4.5`]);
  });

  it("fails 4.48 and passes 4.54", () => {
    inks("#777777", WHITE);
    addToHome(PAIR);
    assert.deepEqual(problems(), everyTheme(`.note: ${raw("fg", "#777777")} on ${raw("bg", WHITE)} is 4.48:1, below 4.5`));
    edit(tmp, `${UI}/tokens.json`, '"#777777"', '"#767676"');
    generateStylesheet(tmp);
    assert.deepEqual(problems(), []);
  });

  it("composes a translucent background over the body's", () => {
    addTokens("ink", { fg: srgb(WHITE), bg: srgb(BLACK, 0.5), page: srgb(WHITE) });
    addToHome("body { background: var(--ink-page); }\n.note { color: var(--ink-fg); background: var(--ink-bg); }");
    assert.deepEqual(problems(), everyTheme(`.note: ${raw("fg", WHITE)} on ${raw("bg", "color(srgb 0 0 0 / 0.5)")} is 3.98:1, below 4.5`));
  });

  it("composes a transparent background over the body's", () => {
    addTokens("ink", { fg: srgb(WHITE), page: srgb(WHITE) });
    addToHome("body { background: var(--ink-page); }\n.note { color: var(--ink-fg); background: transparent; }");
    assert.deepEqual(problems(), everyTheme(`.note: ${raw("fg", WHITE)} on transparent is 1.00:1, below 4.5`));
  });

  it("composes a translucent text over its background", () => {
    addTokens("ink", { fg: srgb(BLACK, 0.2), bg: srgb(WHITE) });
    addToHome(PAIR);
    assert.deepEqual(problems(), everyTheme(`.note: ${raw("fg", "color(srgb 0 0 0 / 0.2)")} on ${raw("bg", WHITE)} is 1.61:1, below 4.5`));
  });

  it("skips a translucent background when the body has none", () => {
    addTokens("ink", { fg: srgb(WHITE), bg: srgb(BLACK, 0.5) });
    addToHome(PAIR);
    assert.deepEqual(problems(), []);
  });

  it("reads background-color as well", () => {
    inks("#aaaaaa", WHITE);
    addToHome(".note { color: var(--ink-fg); background-color: var(--ink-bg); }");
    assert.deepEqual(problems(), everyTheme(`.note: ${raw("fg", "#aaaaaa")} on ${raw("bg", WHITE)} is 2.32:1, below 4.5`));
  });

  it("skips a rule without both colours", () => {
    inks("#aaaaaa", WHITE);
    addToHome(".a { color: var(--ink-fg); }\n.b { background: var(--ink-bg); }");
    assert.deepEqual(problems(), []);
  });

  it("skips a value it cannot read", () => {
    inks("#aaaaaa", WHITE);
    addToHome(".note { color: inherit; background: var(--ink-bg); }");
    assert.deepEqual(problems(), []);
  });

  it("leaves a component's render alone", () => {
    inks("#aaaaaa", WHITE);
    edit(tmp, `${UI}/components/button.md`, "tokens: [", "tokens: [ink.fg, ink.bg, ");
    edit(tmp, BUTTON_RENDER, "</body>", `<style>\n${PAIR}\n</style>\n</body>`);
    assert.deepEqual(problems(), []);
  });
});

describe("aidd-ui V12 touch targets", () => {
  const BUTTON = ".go { min-height: var(--size-go); }";
  const sized = (value, unit) => addTokens("size", { go: unit === undefined ? { $type: "number", $value: value } : length(value, unit) });
  const target = (rule, markup = '<button class="go">Go</button>') => addToHome(rule, markup);

  it("passes a target at the default floor", () => {
    sized(24, "px");
    target(BUTTON);
    assert.deepEqual(problems(), []);
  });

  it("names a target below it", () => {
    sized(23, "px");
    target(BUTTON);
    assert.deepEqual(problems(), [`${home}: button (.go): min-height 23px is below the 24px floor of web`]);
  });

  it("reads a unitless size as px", () => {
    sized(16);
    target(BUTTON);
    assert.deepEqual(problems(), [`${home}: button (.go): min-height 16px is below the 24px floor of web`]);
  });

  it("reads rem as 16px", () => {
    sized(1, "rem");
    target(BUTTON);
    assert.deepEqual(problems(), [`${home}: button (.go): min-height 16px is below the 24px floor of web`]);
  });

  it("reads height, block-size and min-block-size too", () => {
    sized(16, "px");
    target(".go { height: var(--size-go); }\n.up { block-size: var(--size-go); }\n.in { min-block-size: var(--size-go); }", '<button class="go up in">Go</button>');
    assert.deepEqual(problems(), [
      `${home}: button (.go): height 16px is below the 24px floor of web`,
      `${home}: button (.up): block-size 16px is below the 24px floor of web`,
      `${home}: button (.in): min-block-size 16px is below the 24px floor of web`,
    ]);
  });

  it("does not check a target whose size is undeclared", () => {
    sized(16, "px");
    target(".go { color: var(--space-md); }");
    assert.deepEqual(problems(), []);
  });

  it("targets an element by its tag", () => {
    sized(16, "px");
    target("button { min-height: var(--size-go); }", "<button>Go</button>");
    assert.deepEqual(problems(), [`${home}: button (button): min-height 16px is below the 24px floor of web`]);
  });

  it("targets an element by one of its classes", () => {
    sized(16, "px");
    target(".other { min-height: var(--size-go); }\n.go { min-height: var(--size-go); }", '<a class="x go y" href="/">Go</a>');
    assert.deepEqual(problems(), [`${home}: a (.go): min-height 16px is below the 24px floor of web`]);
  });

  it("targets an element carrying a role", () => {
    sized(16, "px");
    target(".tab { min-height: var(--size-go); }", '<div class="tab" role="tab">Tab</div>');
    assert.deepEqual(problems(), [`${home}: div (.tab): min-height 16px is below the 24px floor of web`]);
  });

  it("leaves an element whose role is no control", () => {
    sized(16, "px");
    target(".saved { min-height: var(--size-go); }", '<span class="saved" role="status">Saved</span>');
    assert.deepEqual(problems(), []);
  });

  it("leaves an element that is not interactive", () => {
    sized(16, "px");
    target(".go { min-height: var(--size-go); }", '<p class="go">Text</p>');
    assert.deepEqual(problems(), []);
  });

  it("leaves a rule that names no element of the render", () => {
    sized(16, "px");
    target(".gone { min-height: var(--size-go); }\nli { min-height: var(--size-go); }");
    assert.deepEqual(problems(), []);
  });

  describe("floor raised by system.md", () => {
    const touch = (entries, platforms = "[web, mobile]") => {
      edit(tmp, SYSTEM, "platforms: [web]", `platforms: ${platforms}\ntouch-target: ${entries}`);
    };
    const renderFloor = () => renders.check(load(tmp)).filter((found) => found.rule === "V12").map((found) => found.message);

    beforeEach(() => {
      sized(40, "px");
      target(BUTTON);
    });

    it("keeps 24 where no platform raises it", () => {
      touch("[mobile=44]", "[web]");
      assert.deepEqual(renderFloor(), []);
    });

    it("takes the highest floor of the system's platforms", () => {
      touch("[mobile=44]");
      assert.deepEqual(renderFloor(), ["button (.go): min-height 40px is below the 44px floor of mobile"]);
    });

    it("takes the platforms of the screen over the system's", () => {
      touch("[mobile=44]");
      edit(tmp, HOME, "route: /", "route: /\nplatforms: [web]");
      assert.deepEqual(renderFloor(), []);
    });

    it("takes the highest floor of the screen's platforms, whatever their order", () => {
      touch("[mobile=44]");
      edit(tmp, HOME, "route: /", "route: /\nplatforms: [mobile, web]");
      assert.deepEqual(renderFloor(), ["button (.go): min-height 40px is below the 44px floor of mobile"]);
      edit(tmp, HOME, "platforms: [mobile, web]", "platforms: [web, mobile]");
      assert.deepEqual(renderFloor(), ["button (.go): min-height 40px is below the 44px floor of mobile"]);
    });

    it("lowers nothing below 24", () => {
      touch("[mobile=10]");
      edit(tmp, HOME, "route: /", "route: /\nplatforms: [mobile]");
      edit(tmp, `${UI}/tokens.json`, '"value": 40', '"value": 16');
      generateStylesheet(tmp);
      assert.deepEqual(renderFloor(), ["button (.go): min-height 16px is below the 24px floor of mobile"]);
    });
  });
});

const FIXES = [
  "V11 | dark: .note: var(--ink-fg) (#777777) on var(--ink-bg) (#ffffff) is 4.48:1, below 4.5 | \".note\" | use tokens whose contrast reaches 4.5:1",
  "V11 | dark: .note: var(--ink-fg) (#aaaaaa) on var(--ink-bg) (#ffffff) is 2.32:1, below 4.5 | \".note\" | use tokens whose contrast reaches 4.5:1",
  "V11 | dark: .note: var(--ink-fg) (#ffffff) on transparent is 1.00:1, below 4.5 | \".note\" | use tokens whose contrast reaches 4.5:1",
  "V11 | dark: .note: var(--ink-fg) (#ffffff) on var(--ink-bg) (color(srgb 0 0 0 / 0.5)) is 3.98:1, below 4.5 | \".note\" | use tokens whose contrast reaches 4.5:1",
  "V11 | dark: .note: var(--ink-fg) (color(srgb 0 0 0 / 0.2)) on var(--ink-bg) (#ffffff) is 1.61:1, below 4.5 | \".note\" | use tokens whose contrast reaches 4.5:1",
  "V11 | light: .note: var(--ink-fg) (#777777) on var(--ink-bg) (#ffffff) is 4.48:1, below 4.5 | \".note\" | use tokens whose contrast reaches 4.5:1",
  "V11 | light: .note: var(--ink-fg) (#aaaaaa) on var(--ink-bg) (#ffffff) is 2.32:1, below 4.5 | \".note\" | use tokens whose contrast reaches 4.5:1",
  "V11 | light: .note: var(--ink-fg) (#ffffff) on transparent is 1.00:1, below 4.5 | \".note\" | use tokens whose contrast reaches 4.5:1",
  "V11 | light: .note: var(--ink-fg) (#ffffff) on var(--ink-bg) (color(srgb 0 0 0 / 0.5)) is 3.98:1, below 4.5 | \".note\" | use tokens whose contrast reaches 4.5:1",
  "V11 | light: .note: var(--ink-fg) (color(srgb 0 0 0 / 0.2)) on var(--ink-bg) (#ffffff) is 1.61:1, below 4.5 | \".note\" | use tokens whose contrast reaches 4.5:1",
  "V12 | a (.go): min-height 16px is below the 24px floor of web | \".go\" | give it at least 24px",
  "V12 | button (.go): height 16px is below the 24px floor of web | \".go\" | give it at least 24px",
  "V12 | button (.go): min-height 16px is below the 24px floor of web | \".go\" | give it at least 24px",
  "V12 | button (.go): min-height 23px is below the 24px floor of web | \".go\" | give it at least 24px",
  "V12 | button (.in): min-block-size 16px is below the 24px floor of web | \".in\" | give it at least 24px",
  "V12 | button (.up): block-size 16px is below the 24px floor of web | \".up\" | give it at least 24px",
  "V12 | button (button): min-height 16px is below the 24px floor of web | \"button\" | give it at least 24px",
  "V12 | div (.tab): min-height 16px is below the 24px floor of web | \".tab\" | give it at least 24px",
];

describe("aidd-ui fixes of V11 and V12", () => {
  it("pins the fix of every problem the cases above named", () => {
    assert.deepEqual(ledger.seen(), [...FIXES].sort());
  });
});
