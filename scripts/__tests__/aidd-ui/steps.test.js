const assert = require("node:assert/strict");
const path = require("node:path");
const { describe, it } = require("node:test");
const { LIB } = require("../fixtures/aidd-ui/project.js");
const { STEPS, CATEGORIES, stepOf, categoryOf, setStepOf, awaitingOf } = require(path.join(LIB, "steps.cjs"));

// The five steps of the method and the categories of the elements, decided from the records alone.

const rec = (frontMatter) => ({ frontMatter });
const set = (...paths) => ({ id: "s", variants: [{ name: "a", files: paths.map((each) => ({ path: each, text: "" })) }] });

describe("aidd-ui steps", () => {
  it("holds the five steps in the order of the method, and the categories in the order of the sidebar", () => {
    assert.deepEqual(STEPS, ["identity", "foundations", "components", "screens", "journeys"]);
    assert.deepEqual(CATEGORIES, ["input", "action", "display", "navigation", "group", "asset"]);
  });

  describe("the step of a record", () => {
    for (const [kind, step] of [["journey", "journeys"], ["brand", "identity"], ["system", "foundations"], ["atom", "components"], ["molecule", "components"], ["organism", "components"], ["asset", "components"], ["wireframe", "screens"], ["screen", "screens"]]) {
      it(`puts a ${kind} in ${step}`, () => assert.equal(stepOf(rec({ kind })), step));
    }
  });

  describe("the category of an element", () => {
    const ROLES = {
      input: ["textbox", "searchbox", "search", "combobox", "listbox", "option", "radiogroup", "radio", "checkbox", "switch", "slider", "spinbutton"],
      action: ["button", "link", "menuitem"],
      display: ["status", "alert", "img", "figure", "list", "listitem", "table", "grid", "row", "cell", "progressbar", "meter", "tooltip", "note", "heading", "article", "feed", "log", "timer"],
      navigation: ["navigation", "tablist", "tab", "menu", "menubar", "tree", "treegrid", "toolbar", "banner", "contentinfo"],
      group: ["form", "group", "region", "dialog", "alertdialog", "tabpanel", "complementary", "main"],
    };
    for (const [category, roles] of Object.entries(ROLES)) {
      for (const role of roles) it(`puts the role ${role} in ${category}`, () => assert.equal(categoryOf(rec({ kind: "atom", role })), category));
    }

    it("puts an element with a role no table names, or none, in group", () => {
      assert.equal(categoryOf(rec({ kind: "atom", role: "carousel" })), "group");
      assert.equal(categoryOf(rec({ kind: "atom" })), "group");
    });

    it("reads a role whatever its case", () => {
      assert.equal(categoryOf(rec({ kind: "atom", role: " Button " })), "action");
    });

    it("puts an asset in asset, whatever its role", () => {
      assert.equal(categoryOf(rec({ kind: "asset", role: "button" })), "asset");
      assert.equal(categoryOf(rec({ kind: "asset" })), "asset");
    });
  });

  describe("the step of a set", () => {
    for (const [paths, step] of [
      [["brand.md"], "identity"],
      [["system.md"], "foundations"],
      [["tokens.json"], "foundations"],
      [["tokens.css"], "foundations"],
      [["components/button.md"], "components"],
      [["wireframes/home.md"], "screens"],
      [["screens/home.md"], "screens"],
      [["preview.html", "system.md"], "identity"],
      [[], "identity"],
    ]) {
      it(`sends a set whose first file is ${paths[0] ?? "none"} to ${step}`, () => assert.equal(setStepOf(set(...paths)), step));
    }

    it("sends a set with no variant to identity", () => {
      assert.equal(setStepOf({ id: "s", variants: [] }), "identity");
    });
  });

  describe("what awaits review", () => {
    const rows = [
      { Screen: "home", State: "default", Version: "2", Verdict: "ok" },
      { Screen: "home", State: "hover", Version: "1", Verdict: "ok" },
      { Screen: "home", State: "focus", Version: "2", Verdict: "revise" },
      { Screen: "home", State: "error", Version: "2", Verdict: "pending" },
    ];
    const home = rec({ id: "home", kind: "screen", version: 2, states: ["default", "hover", "focus", "error", "empty"] });

    it("lists the states not settled, ok or revise, at the current version, in the record's order", () => {
      assert.deepEqual(awaitingOf(rows, home), ["hover", "error", "empty"]);
    });

    it("lists nothing for a record with no state", () => {
      assert.deepEqual(awaitingOf(rows, rec({ id: "x", kind: "atom", version: 1 })), []);
    });

    it("lists the one `default` state of a brand or a system, until a verdict at its version", () => {
      assert.deepEqual(awaitingOf(rows, rec({ id: "brand", kind: "brand", version: 1 })), ["default"]);
      assert.deepEqual(awaitingOf([{ Screen: "brand", State: "default", Version: "1", Verdict: "ok" }], rec({ id: "brand", kind: "brand", version: 1 })), []);
    });

    it("does not read the status", () => {
      assert.deepEqual(awaitingOf([], rec({ id: "x", kind: "atom", version: 1, status: "validated", states: ["default"] })), ["default"]);
    });
  });
});
