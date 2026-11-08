const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { UI, makeTmp, removeTmp, filesUnder, engine, validate, writeProject, edit, editTokens, propose, put } = require("../fixtures/aidd-ui/project.js");

// The record templates are what the skill's model starts from, so each is filled the way an
// action says and the design system around it must still validate. A placeholder the table does
// not know fails the test: a template cannot grow a slot nothing here fills.
const PLUGIN = path.resolve(__dirname, "../../../plugins/aidd-ui");
const SKILLS = path.join(PLUGIN, "skills");
const FOLDERS = ["01-journeys", "02-brand", "03-foundations", "04-components"];
const SKILL = (name) => path.join(SKILLS, name);
const JOURNEYS = SKILL("01-journeys");
const OWNER = { system: "03-foundations", brand: "02-brand", component: "04-components", asset: "04-components", render: "04-components" };

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
};

const TEMPLATES = {
  system: "system-template.md",
  brand: "brand-template.md",
  component: "component-template.md",
  asset: "asset-template.md",
  render: "render-template.html",
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
  it("holds no resolver JSON for the model to copy: the engine writes it", () => {
    for (const file of FOLDERS.flatMap((name) => filesUnder(SKILL(name)))) assert.equal(/resolutionOrder|"\$ref"|"modifiers"/.test(fs.readFileSync(file, "utf8")), false, path.relative(SKILLS, file));
  });

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

describe("aidd-ui skills", () => {
  const texts = (name) => filesUnder(SKILL(name)).map((file) => ({ file: path.relative(SKILL(name), file), text: fs.readFileSync(file, "utf8") }));

  it("are the four the plugin lists and holds", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(PLUGIN, ".claude-plugin/plugin.json"), "utf8"));
    assert.deepEqual(manifest.skills, FOLDERS.map((name) => `./skills/${name}`));
    assert.deepEqual(fs.readdirSync(SKILLS).sort(), FOLDERS);
  });

  it("name no other skill, hold no date or em-dash, in any file", () => {
    for (const folder of FOLDERS) {
      const own = new Set([folder, ...fs.readdirSync(path.join(SKILL(folder), "actions")).map((name) => name.replace(/\.md$/, ""))]);
      for (const { file, text } of texts(folder)) {
        assert.equal(/[a-z-]+:\d{2}-[a-z-]+/.test(text), false, `${folder}/${file} names a skill as plugin:folder`);
        for (const [numbered] of text.matchAll(/\b\d{2}-[a-z]+(?:-[a-z]+)*\b/g)) assert.ok(own.has(numbered), `${folder}/${file} names ${numbered}, which is not part of this skill`);
        assert.equal(/\d{4}[-_]\d{2}[-_]\d{2}/.test(text), false, `${folder}/${file} holds a date`);
        assert.equal(text.includes("\u2014"), false, `${folder}/${file} holds an em-dash`);
      }
    }
  });

  it("keeps every sentence of every skill to twelve words at most", () => {
    const MAX = 12;
    const offenders = [];
    for (const file of FOLDERS.flatMap((name) => filesUnder(SKILL(name))).filter((each) => each.endsWith(".md"))) {
      const text = fs.readFileSync(file, "utf8").replace(/```[\s\S]*?```/g, (fence) => fence.replace(/[^\n]/g, "")).replace(/^---\n[\s\S]*?\n---\n/, (front) => front.replace(/[^\n]/g, ""));
      text.split("\n").forEach((line, index) => {
        if (line.startsWith("#") || line.startsWith("---")) return;
        for (const cell of line.startsWith("|") ? line.split("|") : [line]) {
          for (const raw of cell.split(/(?<=[.!?])\s+/)) {
            const sentence = raw.replace(/^\s*([-*]|\d+\.)\s*/, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
            const words = sentence.split(/\s+/).filter(Boolean).length;
            if (words > MAX) offenders.push(`${path.relative(SKILLS, file)}:${index + 1} ${words} words: ${sentence.trim().slice(0, 60)}`);
          }
        }
      });
    }
    assert.deepEqual(offenders, []);
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
    assert.deepEqual([...authors.keys()].sort(), ["asset", "atom", "brand", "journey", "molecule", "organism", "system", "wireframe"]);
  });

  it("end saying the user validates each element after its render, in the skills that raise elements", () => {
    for (const folder of ["03-foundations", "04-components"]) {
      const conclude = fs.readFileSync(path.join(SKILL(folder), "actions/03-conclude.md"), "utf8");
      for (const line of ["each element created or raised is `proposed` until published", "the user publishes with `node <engine> publish <id>`", "the user does so after looking at its render"]) assert.ok(conclude.includes(line), `${folder}: ${line}`);
    }
  });
});

describe("aidd-ui engine references", () => {
  const { HELP } = require(path.join(PLUGIN, "hooks/lib/help.cjs"));
  const engineOf = (folder) => fs.readFileSync(path.join(SKILL(folder), "references/engine.md"), "utf8");

  it("hold the install table, the command names and the owed table, nothing the engine's help says", () => {
    for (const folder of FOLDERS) {
      const text = engineOf(folder);
      assert.deepEqual(text.split("\n").filter((line) => line.startsWith("#")), ["# Engine", "## Commands", "## Owed by a later step"], folder);
      assert.ok(text.includes("| Install | Path |"), folder);
      assert.ok(text.includes("`<engine>` is that path, run with `node`."), folder);
      assert.ok(text.includes("`node <engine> help <command>`"), folder);
      assert.equal(text.includes("```"), false, `${folder} holds a code block`);
    }
  });

  it("list only commands the engine's help knows", () => {
    for (const folder of FOLDERS) {
      const commands = engineOf(folder).split("## Commands")[1].split("## Owed")[0].split("\n").filter((line) => line.startsWith("- "));
      assert.ok(commands.length > 0, folder);
      for (const line of commands) assert.ok(Object.hasOwn(HELP, line.match(/^- `([^`]+)`$/)?.[1]), `${folder}: ${line}`);
    }
  });
});

describe("aidd-ui system answers", () => {
  const foundations = (file) => fs.readFileSync(path.join(SKILL("03-foundations"), file), "utf8");

  it("come from the code per extraction, never from the README or visible copy", () => {
    const write = foundations("actions/02-write.md");
    const step = write.slice(write.indexOf("2. If no `system.md`"), write.indexOf("3. From the code"));
    assert.ok(step.includes("[extraction](../references/extraction.md)"));
    assert.equal(/README|manifest|visible copy/.test(step), false);
  });

  it("name the apps the code roots serve as the platforms", () => {
    assert.ok(foundations("references/extraction.md").split("\n").some((line) => line.startsWith("| ") && line.includes("apps") && line.includes("`platforms`")));
  });
});

describe("aidd-ui owed problems", () => {
  const owed = (folder) => {
    const text = fs.readFileSync(path.join(SKILL(folder), "references/engine.md"), "utf8");
    return text.slice(text.indexOf("## Owed by a later step")).split("\n").filter((line) => line.startsWith("| ")).flatMap((line) => line.split("|")[1].match(/\b[A-Z]\d+\b/g) ?? []);
  };
  const rulesOf = (dir) => [...new Set(validate(dir).out.slice(1).flatMap((line) => line.split(" ").filter((word) => /^[A-Z]\d+$/.test(word)).slice(0, 1)))].sort();

  it("name, for the brand alone, the one rule it leaves", () => {
    for (const entry of fs.readdirSync(path.join(tmp, UI))) if (entry !== "brand.md") fs.rmSync(path.join(tmp, UI, entry), { recursive: true });
    fs.rmSync(path.join(tmp, "src"), { recursive: true });
    assert.deepEqual(rulesOf(tmp), ["T1"]);
    for (const rule of rulesOf(tmp)) assert.ok(owed("02-brand").includes(rule), rule);
  });

  it("name, for a token renamed by the foundations alone, the rules left to the components", () => {
    engine("bump", "--task", "aidd_docs/tasks/rename", "--change", "action colour renamed", "--breaking", "color.action.default", "--root", tmp);
    editTokens(tmp, (tree) => {
      tree.color.action.primary = tree.color.action.default;
      delete tree.color.action.default;
    });
    assert.deepEqual(rulesOf(tmp), ["T7", "V3"]);
    for (const rule of rulesOf(tmp)) assert.ok(owed("03-foundations").includes(rule), rule);
  });

  it("name, for the components, the rules a record leaves until its history row and its render exist", () => {
    assert.deepEqual(owed("04-components"), ["H1", "V1"]);
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
    put(tmp, `${UI}/wireframes/results.html`, render.replace(/<section[\s\S]*<\/section>/, (section) => `${section}\n${section.replace('data-state="default"', 'data-state="empty"')}`));
    assert.equal(engine("bump", "--task", TASK, "--created", "first-search", "results", "--root", tmp).status, 0);
    const { code, out } = validate(tmp);
    assert.deepEqual([code, out[0], out.slice(1).map((line) => line.split(" ").slice(0, 3).join(" "))], [0, "aidd-ui: 0 errors, 1 warning", [`${UI}/wireframes/results.md R18 warning`]]);
    for (const name of ["journey", "wireframe"]) assert.ok(/\nstatus: proposed\nversion: 1\n/.test(filledJourney(name)), name);
  });
});

describe("aidd-ui journeys skill", () => {
  it("ends saying each record stays proposed until its review, and names the components the design system lacks", () => {
    const conclude = fs.readFileSync(path.join(JOURNEYS, "actions/03-conclude.md"), "utf8");
    assert.ok(conclude.includes("each journey and wireframe written is `proposed` until its review"));
    assert.ok(conclude.includes("each component the R18 warnings name, for the design system to add"));
  });
});
