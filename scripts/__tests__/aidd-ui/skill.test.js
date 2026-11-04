const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { UI, makeTmp, removeTmp, filesUnder, engine, validate, writeProject, edit, editTokens, propose, put } = require("../fixtures/aidd-ui/project.js");

// The record templates are what the skill's model starts from, so each is filled the way an
// action says and the design system around it must still validate. A placeholder the table does
// not know fails the test: a template cannot grow a slot nothing here fills.
const PLUGIN = path.resolve(__dirname, "../../../plugins/aidd-ui");
const SKILL = path.join(PLUGIN, "skills/01-system");

const PLACEHOLDER = /\{\{([^}]+)\}\}/g;
const COMMENT = /<!--[\s\S]*?-->\n?/g;
const TASK = "aidd_docs/tasks/ds-init";

const FILLS = {
  system: {
    platforms: "web",
    "themes, the base first": "light, dark",
    locales: "fr, ar",
    "primitive token groups": "color.brand",
    "UI folders of the code": "src/ui",
    "token file of the code, or one per app": "[src/ui/tokens.css]",
    "paths no record links": "src/ui/vendor",
    "breakpoint name": "mobile",
    "its media query, empty for the first": "",
  },
  brand: {
    "what the project is": "A search tool.",
    "who uses it": "Analysts.",
    "the domain it works in": "Public records.",
    "where it runs": "Web.",
    "how it sounds and looks": "Plain and calm.",
    "what it looks like and why": "A library catalogue.",
    "what it must never look like": "A casino.",
  },
  component: {
    "component id": "badge",
    "Component name": "Badge",
    "atom, molecule or composition": "atom",
    "ids it uses": "",
    "semantic tokens": "space.md, color.text.default",
    "variants": "default",
    "states": "default, focus",
    "accessible role": "status",
    "when to use it, and when not": "A short status beside a label; never for an action.",
    "how the keyboard drives it": "Tab focuses it, Enter activates it.",
  },
  asset: {
    "asset id": "logo",
    "Asset name": "Logo",
    "icon, image or illustration": "image",
    "file name beside this record": "logo.svg",
    "alternative text": "The search tool's logo",
  },
  render: {
    "BCP 47 language": "en",
    "ltr or rtl": "ltr",
    "component id": "badge",
    "spacing token CSS name": "space-md",
    "text token CSS name": "color-text-default",
    variant: "default",
    "first state": "default",
    "next state": "focus",
  },
};

const TEMPLATES = {
  system: "system-template.md",
  brand: "brand-template.md",
  component: "component-template.md",
  asset: "asset-template.md",
  render: "render-template.html",
};

const template = (name) => fs.readFileSync(path.join(SKILL, "assets", TEMPLATES[name]), "utf8");

/** A template as an action fills it: every placeholder answered, every comment deleted. */
function filled(name) {
  const text = template(name).split(COMMENT).join("").replace(PLACEHOLDER, (_, slot) => {
    assert.ok(Object.hasOwn(FILLS[name], slot), `${TEMPLATES[name]}: no fill for {{${slot}}}`);
    return FILLS[name][slot];
  });
  return text;
}

let tmp;

beforeEach(() => {
  tmp = makeTmp("aidd-ui-skill-");
  writeProject(tmp);
});

afterEach(() => removeTmp(tmp));

describe("aidd-ui 01-system templates", () => {
  it("fill every placeholder of every template, and leave none behind", () => {
    for (const name of Object.keys(TEMPLATES)) {
      const text = filled(name);
      assert.equal(text.includes("{{"), false, name);
    }
  });

  it("validate once filled, among the rest of a design system", () => {
    // the template holds one breakpoint row; the model adds the others
    put(tmp, `${UI}/system.md`, filled("system").replace("| mobile |  |", "| mobile |  |\n| desktop | (min-width: 64rem) |"));
    put(tmp, `${UI}/brand.md`, filled("brand"));
    put(tmp, `${UI}/components/badge.md`, filled("component"));
    put(tmp, `${UI}/components/badge.html`, filled("render"));
    put(tmp, `${UI}/assets/logo.md`, filled("asset"));
    put(tmp, `${UI}/assets/logo.svg`, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="10" cy="10" r="7"/></svg>\n');
    assert.equal(engine("bump", "--task", TASK, "--created", "badge", "logo", "--root", tmp).status, 0);
    assert.deepEqual(validate(tmp), { code: 0, out: ["VALID"], err: "" });
  });

  it("start every element as proposed at version 1, the system and the brand with neither status nor version", () => {
    for (const name of ["component", "asset"]) {
      const text = filled(name);
      assert.ok(text.includes("status: proposed\n"), name);
      assert.ok(text.includes("version: 1\n"), name);
    }
    for (const name of ["system", "brand"]) assert.equal(/^(status|version):/m.test(filled(name)), false, name);
  });

  it("hold no history section: history.md is the engine's", () => {
    for (const name of ["system", "brand", "component", "asset"]) assert.equal(template(name).includes("## History"), false, name);
  });
});

describe("aidd-ui 01-system variant axes", () => {
  it("shows an axis in the templates, and the axis they show validates", () => {
    propose(tmp, `${UI}/components/dialog.md`);
    edit(tmp, `${UI}/components/dialog.md`, "variants: [default]", "variants: [size=sm, size=md, tone=danger]");
    edit(tmp, `${UI}/components/dialog.html`, 'data-variant="default" data-state="default"', 'data-size="sm" data-state="default"');
    edit(tmp, `${UI}/components/dialog.html`, 'data-variant="default" data-state="hover"', 'data-size="md" data-state="hover"');
    edit(tmp, `${UI}/components/dialog.html`, 'data-variant="default" data-state="focus"', 'data-tone="danger" data-state="focus"');
    assert.deepEqual(validate(tmp), { code: 0, out: ["VALID"], err: "" });
  });
});

describe("aidd-ui 01-system resolver", () => {
  it("holds no resolver JSON for the model to copy: the engine writes it", () => {
    for (const file of filesUnder(SKILL)) assert.equal(/resolutionOrder|"\$ref"|"modifiers"/.test(fs.readFileSync(file, "utf8")), false, path.relative(SKILL, file));
  });

  it("has a breakpoint's query written in the template's table, and the engine turn it into the stylesheet", () => {
    const template = fs.readFileSync(path.join(SKILL, "assets/system-template.md"), "utf8");
    assert.ok(template.includes("| Name | Query |"));
    propose(tmp, ...["components/button", "components/dialog", "components/search-field", "screens/home"].map((name) => `${UI}/${name}.md`));
    put(tmp, `${UI}/breakpoints/desktop.json`, JSON.stringify({ space: { md: { $value: { value: 1.5, unit: "rem" } } } }));
    edit(tmp, `${UI}/system.md`, "themes: [light, dark]", "themes: [light]");
    fs.rmSync(path.join(tmp, `${UI}/tokens.resolver.json`));
    assert.equal(engine("tokens", tmp).status, 0);
    assert.deepEqual(validate(tmp), { code: 0, out: ["VALID"], err: "" });
    assert.ok(fs.readFileSync(path.join(tmp, `${UI}/tokens.css`), "utf8").includes("@media (min-width: 64rem) {"));
  });
});

describe("aidd-ui 01-system change flow", () => {
  it("takes a token change reaching a screen under review to a design system that validates, the engine raising the versions", () => {
    const deprecated = fs.readFileSync(path.join(tmp, `${UI}/components/old-button.md`), "utf8");

    const report = JSON.parse(engine("impact", "color.action.default", "--root", tmp).stdout);
    assert.deepEqual([report.elements, report.screens], [["button", "dialog", "old-button", "search-field"], ["home"]]);

    const raised = JSON.parse(engine("bump", "--task", "aidd_docs/tasks/recolour", "--change", "new action colour", "color.action.default", "--root", tmp).stdout);
    assert.deepEqual(raised.changed.map((file) => path.posix.basename(file)), ["button.md", "dialog.md", "search-field.md", "history.md", "first-pass.md", "home.md"]);
    editTokens(tmp, (tree) => (tree.color.action.default.$value = { colorSpace: "srgb", components: [0.1, 0.1, 0.1], hex: "#1a1a1a" }));
    assert.equal(engine("tokens", tmp).status, 0);

    assert.deepEqual(validate(tmp), { code: 0, out: ["VALID"], err: "" });
    assert.equal(fs.readFileSync(path.join(tmp, `${UI}/components/old-button.md`), "utf8"), deprecated);
  });

  it("takes a token rename a deprecated element cites to a design system that validates, the engine raising that element too", () => {
    engine("bump", "--task", "aidd_docs/tasks/rename", "--change", "action colour renamed", "--breaking", "color.action.default", "--root", tmp);
    editTokens(tmp, (tree) => {
      tree.color.action.primary = tree.color.action.default;
      delete tree.color.action.default;
    });
    edit(tmp, `${UI}/components/button.md`, "color.action.default", "color.action.primary");
    edit(tmp, `${UI}/components/button.html`, "--color-action-default", "--color-action-primary");
    edit(tmp, `${UI}/components/old-button.md`, "color.action.default", "color.action.primary");
    edit(tmp, `${UI}/components/old-button.html`, "--color-action-default", "--color-action-primary");
    assert.equal(engine("tokens", tmp).status, 0);
    assert.deepEqual(validate(tmp), { code: 0, out: ["VALID"], err: "" });
  });
});

describe("aidd-ui 01-system skill", () => {
  const texts = () => filesUnder(SKILL).map((file) => ({ file: path.relative(SKILL, file), text: fs.readFileSync(file, "utf8") }));

  it("names no other skill, in any file", () => {
    const own = new Set(["01-system", ...fs.readdirSync(path.join(SKILL, "actions")).map((name) => name.replace(/\.md$/, ""))]);
    for (const { file, text } of texts()) {
      assert.equal(/[a-z-]+:\d{2}-[a-z-]+/.test(text), false, `${file} names a skill as plugin:folder`);
      for (const [numbered] of text.matchAll(/\b\d{2}-[a-z]+(?:-[a-z]+)*\b/g)) assert.ok(own.has(numbered), `${file} names ${numbered}, which is not part of this skill`);
    }
  });

  it("ends by saying a review is expected, naming no skill", () => {
    assert.ok(fs.readFileSync(path.join(SKILL, "actions/03-conclude.md"), "utf8").includes("that the code is untouched and a review is expected."));
  });

  it("holds no date, ticket id or em-dash", () => {
    for (const { file, text } of texts()) {
      assert.equal(/\d{4}[-_]\d{2}[-_]\d{2}/.test(text), false, `${file} holds a date`);
      assert.equal(text.includes("—"), false, `${file} holds an em-dash`);
    }
  });

  it("is the only skill the plugin lists and holds", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(PLUGIN, ".claude-plugin/plugin.json"), "utf8"));
    assert.deepEqual(manifest.skills, ["./skills/01-system"]);
    assert.deepEqual(fs.readdirSync(path.join(PLUGIN, "skills")), ["01-system"]);
  });
});
