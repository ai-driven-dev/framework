const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { UI, makeTmp, removeTmp, engine, validate, writeProject, edit, editTokens, propose, put } = require("../fixtures/aidd-ui/project.js");

// The record templates are what the skill's model starts from, so each is filled the way an
// action says and the design system around it must still validate. A placeholder the table does
// not know fails the test: a template cannot grow a slot nothing here fills.
const PLUGIN = path.resolve(__dirname, "../../../plugins/aidd-ui");
const SKILLS = path.join(PLUGIN, "skills");
const FOLDERS = ["01-journeys", "02-brand", "03-foundations", "04-components", "05-screens", "06-review"];
const SKILL = (name) => path.join(SKILLS, name);
const JOURNEYS = SKILL("01-journeys");
const OWNER = { system: "03-foundations", brand: "02-brand", component: "04-components", asset: "04-components", render: "04-components", screen: "05-screens", "screen-render": "05-screens", review: "06-review" };

const PLACEHOLDER = /\{\{([^}]+)\}\}/g;
const COMMENT = /<!--[\s\S]*?-->\n?/g;
const TASK = "aidd_docs/tasks/ds-init";

const FILLS = {
  system: {
    platforms: "web",
    "themes, the base first": "light, dark",
    locales: "fr, ar",
    "palette and scale groups, never the semantic ones": "color.brand",
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
    "how it sounds and looks": "Plain and calm.",
    "what it looks like and why": "A library catalogue.",
    "what it must never look like": "A casino.",
  },
  component: {
    "component id": "badge",
    "Component name": "Badge",
    "atom, molecule or organism": "atom",
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
  screen: {
    "screen id": "search",
    "wireframe id": "search-flow",
    "components it shows": "search-field",
    "semantic tokens": "space.md, color.text.default, color.surface.default, color.action.default, size.control",
    states: "default, empty",
    breakpoints: "mobile",
    route: "/search",
    "the route's file, as path#Export@version": "src/ui/SearchPage.tsx#SearchPage@1",
    "Screen name": "Search",
    "what the screen shows, and its main action": "The query field and the results; the main action searches.",
  },
  review: {
    "review id": "first-round",
    "ids of the records reviewed": "search-flow",
    "Review name": "First round",
    "record id": "search-flow",
    state: "default",
    version: "1",
    "ok or revise": "ok",
    comment: "",
  },
  "screen-render": {
    "BCP 47 language": "en",
    "ltr or rtl": "ltr",
    "screen id": "search",
    "surface token CSS name": "color-surface-default",
    "spacing token CSS name": "space-md",
    "text token CSS name": "color-text-default",
    "control size token CSS name": "size-control",
    "text on action token CSS name": "color-surface-default",
    "action token CSS name": "color-action-default",
    "first state": "default",
    "next state": "empty",
    "first zone": "query",
    "next zone": "results",
    "main action": "Search",
  },
};

const TEMPLATES = {
  system: "system-template.md",
  brand: "brand-template.md",
  component: "component-template.md",
  asset: "asset-template.md",
  render: "render-template.html",
  screen: "screen-template.md",
  "screen-render": "render-template.html",
  review: "review-template.md",
};

const template = (name) => fs.readFileSync(path.join(SKILL(OWNER[name]), "assets", TEMPLATES[name]), "utf8");

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

describe("aidd-ui design system templates", () => {
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

  it("start every element, the system and the brand as proposed at version 1", () => {
    for (const name of ["component", "asset", "system", "brand"]) {
      const text = filled(name);
      assert.ok(text.includes("status: proposed\n"), name);
      assert.ok(text.includes("version: 1\n"), name);
    }
  });

  it("hold no history section: history.md is the engine's", () => {
    for (const name of ["system", "brand", "component", "asset"]) assert.equal(template(name).includes("## History"), false, name);
  });
});

describe("aidd-ui screens skill", () => {
  const SCREENS = path.join(PLUGIN, "skills/05-screens");
  const colour = (hex) => ({ $value: { colorSpace: "srgb", components: [0, 0, 0], hex } });
  // The template's pairs and control size need tokens a project holds: a light and a dark surface, a control height.
  const withTokens = () => {
    editTokens(tmp, (tree) => {
      tree.color.surface = { default: colour("#ffffff") };
      tree.size = { control: { $type: "dimension", $value: { value: 2.75, unit: "rem" } } };
    });
    put(tmp, "src/ui/SearchPage.tsx", "export const SearchPage = 1;\n");
    put(tmp, `${UI}/themes/dark.json`, JSON.stringify({ color: { brand: { primary: colour("#6699cc") }, surface: { default: colour("#0b1f33") } } }));
    assert.equal(engine("tokens", tmp).status, 0);
  };
  const variant = (id, root) => {
    put(tmp, `${UI}/drafts/${id}/${root}/screens/${id}.md`, filled("screen"));
    put(tmp, `${UI}/drafts/${id}/${root}/screens/${id}.html`, filled("screen-render"));
  };

  it("validates once filled, kept from a chosen set and recorded, its pairs and control size read", () => {
    withTokens();
    variant("search", "airy");
    variant("search", "dense");
    put(tmp, `${UI}/drafts/search/variants.md`, "| Variant | Intent | Density |\n| --- | --- | --- |\n| airy | calm | loose |\n| dense | fast | tight |\n");
    assert.equal(engine("showcase", "--root", tmp).status, 0);
    const page = fs.readFileSync(path.join(tmp, UI, "showcase/_set-search.html"), "utf8");
    assert.ok(page.includes("airy screens/search.html") && page.includes("dense screens/search.html"), "the page shows each variant's screen");
    assert.equal(page.includes("../tokens.css"), false, "the stylesheet is inlined");
    assert.deepEqual(JSON.parse(engine("keep", "search", "dense", "--root", tmp).stdout).written, [`${UI}/screens/search.html`, `${UI}/screens/search.md`]);
    assert.equal(engine("bump", "--task", TASK, "--created", "search", "--root", tmp).status, 0);
    assert.deepEqual(validate(tmp), { code: 0, out: ["VALID"], err: "" });
  });

  it("is held to its floor: a control below it fails V12 the template's size would pass", () => {
    withTokens();
    put(tmp, `${UI}/screens/search.md`, filled("screen"));
    put(tmp, `${UI}/screens/search.html`, filled("screen-render").replaceAll("--size-control", "--space-md"));
    edit(tmp, `${UI}/screens/search.md`, "size.control", "space.md");
    assert.equal(engine("bump", "--task", TASK, "--created", "search", "--root", tmp).status, 0);
    assert.ok(validate(tmp).out.some((line) => line.includes("V12")));
  });
});

describe("aidd-ui variant axes", () => {
  it("shows an axis in the templates, and the axis they show validates", () => {
    propose(tmp, `${UI}/components/dialog.md`);
    edit(tmp, `${UI}/components/dialog.md`, "variants: [default]", "variants: [size=sm, size=md, tone=danger]");
    edit(tmp, `${UI}/components/dialog.html`, 'data-variant="default" data-state="default"', 'data-size="sm" data-state="default"');
    edit(tmp, `${UI}/components/dialog.html`, 'data-variant="default" data-state="hover"', 'data-size="md" data-state="hover"');
    edit(tmp, `${UI}/components/dialog.html`, 'data-variant="default" data-state="focus"', 'data-tone="danger" data-state="focus"');
    assert.deepEqual(validate(tmp), { code: 0, out: ["VALID"], err: "" });
  });
});

describe("aidd-ui resolver", () => {
  it("has a breakpoint's query written in the template's table, and the engine turn it into the stylesheet", () => {
    assert.ok(template("system").includes("| Name | Query |"));
    propose(tmp, ...["components/button", "components/dialog", "components/search-field", "screens/home"].map((name) => `${UI}/${name}.md`));
    put(tmp, `${UI}/breakpoints/desktop.json`, JSON.stringify({ space: { md: { $value: { value: 1.5, unit: "rem" } } } }));
    edit(tmp, `${UI}/system.md`, "themes: [light, dark]", "themes: [light]");
    fs.rmSync(path.join(tmp, `${UI}/tokens.resolver.json`));
    assert.equal(engine("tokens", tmp).status, 0);
    assert.deepEqual(validate(tmp), { code: 0, out: ["VALID"], err: "" });
    assert.ok(fs.readFileSync(path.join(tmp, `${UI}/tokens.css`), "utf8").includes("@media (min-width: 64rem) {"));
  });
});

describe("aidd-ui change flow", () => {
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

describe("aidd-ui review skill", () => {
  it("validates once filled, with a row for each state, and holds no pending row", () => {
    const template = filled("review");
    assert.equal(/\| pending \|/.test(template), false);
    assert.match(template, /\nstatus: validated\nversion: 1\n/);
    put(tmp, `${UI}/reviews/first-round.md`, template.replace(/(\| search-flow \| default \| 1 \| ok \| *\|)/, "$1\n| search-flow | empty | 1 | revise | the empty state hides the query |"));
    assert.equal(engine("bump", "--task", TASK, "--created", "first-round", "--root", tmp).status, 0);
    assert.deepEqual(validate(tmp), { code: 0, out: ["VALID"], err: "" });
  });

  it("leaves a state without a row to R13", () => {
    put(tmp, `${UI}/reviews/first-round.md`, filled("review"));
    assert.equal(engine("bump", "--task", TASK, "--created", "first-round", "--root", tmp).status, 0);
    assert.deepEqual(validate(tmp).out.slice(1), [`${UI}/reviews/first-round.md R13 => add a row for search-flow / empty at version 1 to "## Verdicts"`]);
  });
});

describe("aidd-ui skills", () => {
  it("are the six the plugin lists and holds", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(PLUGIN, ".claude-plugin/plugin.json"), "utf8"));
    assert.deepEqual(manifest.skills, FOLDERS.map((name) => `./skills/${name}`));
    assert.deepEqual(fs.readdirSync(SKILLS).sort(), FOLDERS);
  });

  it("have one author for each kind of record", () => {
    const authors = new Map();
    for (const folder of FOLDERS) {
      const assets = path.join(SKILL(folder), "assets");
      if (!fs.existsSync(assets)) continue;
      for (const file of fs.readdirSync(assets).filter((name) => name.endsWith("-template.md"))) {
        const line = fs.readFileSync(path.join(assets, file), "utf8").split("\n").find((each) => each.startsWith("kind: "));
        for (const kind of line.slice("kind: ".length).replace(/[{}]/g, "").split(/,| or /).map((each) => each.trim()).filter(Boolean)) authors.set(kind, [...(authors.get(kind) ?? []), folder]);
      }
    }
    assert.deepEqual([...authors.entries()].filter(([, holders]) => holders.length !== 1), []);
    assert.deepEqual([...authors.keys()].sort(), ["asset", "atom", "brand", "journey", "molecule", "organism", "review", "screen", "system", "wireframe"]);
  });
});
const JOURNEY_FILLS = {
  journey: {
    "journey id": "first-search",
    "Journey name": "First search",
    "persona name": "a first-time analyst",
    "who walks it and what they want": "An analyst opening the product for the first time, looking for one answer.",
    "screen or wireframe id": "results",
    "action leading to the next step": "opens a result",
  },
  wireframe: {
    "wireframe id": "results",
    "Wireframe name": "Results",
    "components it expects": "search-field, result-card",
    states: "default, empty",
    zones: "query, list",
    "the goal of its step": "See what matches the query.",
  },
  "wireframe-render": {
    "BCP 47 language": "en",
    "wireframe id": "results",
    state: "default",
    "first zone": "query",
    "next zone": "list",
    "what this zone shows in this state, in plain HTML": "<p>Search</p>",
  },
};

const JOURNEY_TEMPLATES = { journey: "journey-template.md", wireframe: "wireframe-template.md", "wireframe-render": "wireframe-render-template.html" };

/** A journeys template as an action fills it, a render repeating its section for each state. */
function filledJourney(name) {
  const text = fs.readFileSync(path.join(JOURNEYS, "assets", JOURNEY_TEMPLATES[name]), "utf8").split(COMMENT).join("");
  return text.replace(PLACEHOLDER, (_, slot) => {
    assert.ok(Object.hasOwn(JOURNEY_FILLS[name], slot), `${JOURNEY_TEMPLATES[name]}: no fill for {{${slot}}}`);
    return JOURNEY_FILLS[name][slot];
  });
}

describe("aidd-ui journeys templates", () => {
  it("validate once filled, a missing component a warning only, and start proposed at version 1", () => {
    const render = filledJourney("wireframe-render");
    put(tmp, `${UI}/journeys/first-search.md`, filledJourney("journey"));
    put(tmp, `${UI}/wireframes/results.md`, filledJourney("wireframe"));
    put(tmp, `${UI}/wireframes/results.html`, render.replace(/<section[\s\S]*<\/section>/, (section) => `${section}\n${section.replace('data-state="default"', 'data-state="empty"').replaceAll("<p>Search</p>", "<p>Nothing found</p>")}`));
    assert.equal(engine("bump", "--task", TASK, "--created", "first-search", "results", "--root", tmp).status, 0);
    const { code, out } = validate(tmp);
    assert.deepEqual([code, out[0], out.slice(1).map((line) => line.split(" ").slice(0, 3).join(" "))], [0, "aidd-ui: 0 errors, 1 warning", [`${UI}/wireframes/results.md R18 warning`]]);
    for (const name of ["journey", "wireframe"]) assert.ok(/\nstatus: proposed\nversion: 1\n/.test(filledJourney(name)), name);
  });
});
