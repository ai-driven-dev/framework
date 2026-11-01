const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { UI, writeProject, edit, editTokens, put } = require("./fixtures/aidd-ui/project.js");

// The impact command is driven as a subprocess, as the skill calls it: its refs on the command
// line, its report as JSON on stdout.
const ENGINE = path.resolve(__dirname, "../../plugins/aidd-ui/hooks/aidd-ui.cjs");
const LIB = path.resolve(__dirname, "../../plugins/aidd-ui/hooks/lib");
const { load } = require(path.join(LIB, "project.cjs"));
const { reached } = require(path.join(LIB, "graph.cjs"));

const BUTTON = `${UI}/components/button.md`;

let tmp;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aidd-ui-impact-"));
  writeProject(tmp);
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  assert.equal(fs.existsSync(tmp), false);
});

/** The command's exit code, its stdout as JSON when it is some, and its stderr. */
function impact(...args) {
  const run = spawnSync(process.execPath, [ENGINE, "impact", ...args], { encoding: "utf8" });
  return { code: run.status, report: run.stdout ? JSON.parse(run.stdout) : null, out: run.stdout, err: run.stderr };
}

const BUTTON_AND_THOSE_USING_IT = ["button", "dialog", "old-button", "search-field"];
const RENDERS = ["components/button", "components/dialog", "components/old-button", "components/search-field", "screens/home"].map((name) => `${UI}/${name}.html`);

describe("aidd-ui impact", () => {
  describe("a write", () => {
    it("to a breakpoint file reaches everything, as one to a theme file does", () => {
      assert.equal(reached(load(tmp), [`${UI}/breakpoints/desktop.json`]), null);
      assert.equal(reached(load(tmp), [`${UI}/themes/dark.json`]), null);
    });
  });

  describe("from a token", () => {
    it("reaches the tokens aliasing it, the components declaring them, what uses those, and their renders and code", () => {
      const { code, report, err } = impact("color.brand.primary", "--root", tmp);
      assert.equal(code, 0);
      assert.equal(err, "");
      assert.deepEqual(report, {
        tokens: ["color.action.default", "color.brand.primary", "color.text.default"],
        elements: BUTTON_AND_THOSE_USING_IT,
        screens: ["home"],
        journeys: ["onboarding"],
        renders: RENDERS,
        code: ["src/ui/Button.tsx", "src/ui/HomePage.tsx", "src/ui/tokens.css"],
      });
    });

    it("reaches a token that cites it through the var() of a raw CSS value, and the component declaring that one", () => {
      editTokens(tmp, (tree) => (tree.misc = { ring: { $extensions: { "dev.ai-driven.css": "0 0 0 2px var(--color-brand-primary)" } } }));
      put(tmp, `${UI}/components/badge.md`, fs.readFileSync(path.join(tmp, BUTTON), "utf8").replace("id: button", "id: badge").replace(/tokens: \[.*\]/, "tokens: [misc.ring]"));
      const { report } = impact("color.brand.primary", "--root", tmp);
      assert.deepEqual(report.tokens, ["color.action.default", "color.brand.primary", "color.text.default", "misc.ring"]);
      assert.deepEqual(report.elements, ["badge", ...BUTTON_AND_THOSE_USING_IT]);
    });

    it("follows an alias of an alias, whatever the order of the tokens", () => {
      editTokens(tmp, (tree) => {
        const rest = { ...tree };
        for (const key of Object.keys(tree)) delete tree[key];
        Object.assign(tree, { chain: { second: { $type: "color", $value: "{color.text.default}" } }, ...rest });
      });
      assert.deepEqual(impact("color.brand.primary", "--root", tmp).report.tokens, ["chain.second", "color.action.default", "color.brand.primary", "color.text.default"]);
    });

    it("reaches a token that aliases it in a theme file, and the component declaring that one", () => {
      editTokens(tmp, (tree) => {
        tree.color.accent = { $value: { colorSpace: "srgb", components: [1, 0, 0], hex: "#ff0000" } };
        tree.color.focus = { $value: { colorSpace: "srgb", components: [0, 0, 1], hex: "#0000ff" } };
      });
      put(tmp, `${UI}/themes/dark.json`, JSON.stringify({ color: { focus: { $value: "{color.accent}" } } }));
      put(tmp, `${UI}/components/badge.md`, fs.readFileSync(path.join(tmp, BUTTON), "utf8").replace("id: button", "id: badge").replace(/tokens: \[.*\]/, "tokens: [color.focus]"));
      const { report } = impact("color.accent", "--root", tmp);
      assert.deepEqual(report.tokens, ["color.accent", "color.focus"]);
      assert.deepEqual(report.elements, ["badge"]);
    });

    it("reaches a token that aliases it in a breakpoint file, and the component declaring that one", () => {
      editTokens(tmp, (tree) => {
        tree.color.accent = { $value: { colorSpace: "srgb", components: [1, 0, 0], hex: "#ff0000" } };
        tree.color.focus = { $value: { colorSpace: "srgb", components: [0, 0, 1], hex: "#0000ff" } };
      });
      put(tmp, `${UI}/breakpoints/desktop.json`, JSON.stringify({ color: { focus: { $value: "{color.accent}" } } }));
      put(tmp, `${UI}/components/badge.md`, fs.readFileSync(path.join(tmp, BUTTON), "utf8").replace("id: button", "id: badge").replace(/tokens: \[.*\]/, "tokens: [color.focus]"));
      const { report } = impact("color.accent", "--root", tmp);
      assert.deepEqual(report.tokens, ["color.accent", "color.focus"]);
      assert.deepEqual(report.elements, ["badge"]);
    });

    it("reaches every code token file a monorepo lists, and none from an element alone", () => {
      edit(tmp, `${UI}/system.md`, "code-tokens: src/ui/tokens.css", "code-tokens: [src/ui/tokens.css, apps/landing/tokens.css]");
      put(tmp, "apps/landing/tokens.css", ":root {}\n");
      assert.deepEqual(impact("space.md", "--root", tmp).report.code, ["apps/landing/tokens.css", "src/ui/Button.tsx", "src/ui/HomePage.tsx", "src/ui/tokens.css"]);
      assert.deepEqual(impact("dialog", "--root", tmp).report.code, ["src/ui/HomePage.tsx"]);
    });

    it("takes a CSS name for the token it names", () => {
      assert.deepEqual(impact("--color-brand-primary", "--root", tmp).report, impact("color.brand.primary", "--root", tmp).report);
    });

    it("names an unknown CSS name as it was given", () => {
      assert.equal(impact("--color-brand-missing", "--root", tmp).err, 'aidd-ui: no token or element named "--color-brand-missing"\n');
    });

    it("reaches nothing beyond a token no record declares", () => {
      editTokens(tmp, (tree) => (tree.misc = { unused: { $type: "number", $value: 1 } }));
      assert.deepEqual(impact("misc.unused", "--root", tmp).report, { tokens: ["misc.unused"], elements: [], screens: [], journeys: [], renders: [], code: ["src/ui/tokens.css"] });
    });
  });

  describe("from an element", () => {
    it("reaches itself and everything using it, through uses and replaced-by, up to the journeys", () => {
      assert.deepEqual(impact("button", "--root", tmp).report, {
        tokens: [],
        elements: BUTTON_AND_THOSE_USING_IT,
        screens: ["home"],
        journeys: ["onboarding"],
        renders: RENDERS,
        code: ["src/ui/Button.tsx", "src/ui/HomePage.tsx"],
      });
    });

    it("follows a chain whatever the order of the files", () => {
      edit(tmp, `${UI}/components/dialog.md`, "uses: [button]", "uses: [search-field]");
      assert.deepEqual(impact("icon-search", "--root", tmp).report.elements, ["dialog", "icon-search", "search-field"]);
    });

    it("stops at a screen no journey cites", () => {
      edit(tmp, `${UI}/journeys/onboarding.md`, "| home | types a query |\n| home | opens a result |", "| about | reads |");
      assert.deepEqual(impact("dialog", "--root", tmp).report.journeys, []);
    });

    it("skips the render an element does not have and the code of a library", () => {
      fs.rmSync(path.join(tmp, `${UI}/components/dialog.html`));
      const { renders, code } = impact("dialog", "--root", tmp).report;
      assert.equal(renders.includes(`${UI}/components/dialog.html`), false);
      assert.deepEqual(code, ["src/ui/HomePage.tsx"]);
    });

    it("joins the reach of several refs, tokens and elements together", () => {
      assert.deepEqual(impact("icon-search", "space.md", "--root", tmp).report, {
        tokens: ["space.md"],
        elements: ["button", "dialog", "icon-search", "old-button", "search-field"],
        screens: ["home"],
        journeys: ["onboarding"],
        renders: RENDERS,
        code: ["src/ui/Button.tsx", "src/ui/HomePage.tsx", "src/ui/tokens.css"],
      });
    });
  });

  describe("the report", () => {
    it("is the same bytes on a second run", () => {
      assert.equal(impact("button", "color.brand.primary", "--root", tmp).out, impact("color.brand.primary", "button", "--root", tmp).out);
    });

    it("defaults to the current directory when no --root is given", () => {
      const run = spawnSync(process.execPath, [ENGINE, "impact", "dialog"], { cwd: tmp, encoding: "utf8" });
      assert.deepEqual(JSON.parse(run.stdout).screens, ["home"]);
    });
  });

  describe("a ref it cannot place", () => {
    it("names an unknown id or token on stderr and exits 2, printing no report", () => {
      assert.deepEqual(impact("button", "color.brand.missing", "--root", tmp), {
        code: 2,
        report: null,
        out: "",
        err: 'aidd-ui: no token or element named "color.brand.missing"\n',
      });
    });

    it("does not take a token group for a token", () => {
      assert.equal(impact("color.brand", "--root", tmp).code, 2);
    });

    it("exits 2 with the usage when no ref is given", () => {
      assert.deepEqual(impact("--root", tmp), { code: 2, report: null, out: "", err: "usage: node aidd-ui.cjs impact <id or token>… [--root <dir>]\n" });
    });
  });
});
