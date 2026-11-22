const assert = require("node:assert/strict");
const path = require("node:path");
const { describe, it } = require("node:test");
const { LIB } = require("../fixtures/aidd-ui/project.js");
const { charteOf, contrastOf, SECTIONS } = require(path.join(LIB, "charte.cjs"));

const entry = (name, type) => ({ name, type, property: `--${name.replaceAll(".", "-")}` });
const sectionOf = (name, type, primitives = ["palette"]) => {
  const held = charteOf([entry(name, type)], primitives, new Map());
  return SECTIONS.filter((id) => held[id].length).join();
};

describe("the classification of the tokens of a charte", () => {
  const CASES = [
    ["palette.ink", "color", "palette"],
    ["palette", "color", "palette"],
    ["color.text", "color", "roles"],
    ["palettes.ink", "color", "roles"],
    ["font.body", "fontFamily", "typographie"],
    ["font.weight.bold", "fontWeight", "typographie"],
    ["font-size.sm", "dimension", "typographie"],
    ["type.scale.lg", "dimension", "typographie"],
    ["line-height.body", "number", "typographie"],
    ["space.md", "dimension", "espacements"],
    ["inset.card", "dimension", "espacements"],
    ["corner.surface", "dimension", "arrondis"],
    ["radius.pill", "dimension", "arrondis"],
    ["size.touch", "dimension", "tailles"],
    ["control.height", "dimension", "tailles"],
    ["duration.fast", "duration", "autres"],
    ["ease.out", "cubicBezier", "autres"],
    ["opacity.veil", "number", "autres"],
    ["space.md", "number", "autres"],
    ["misc.ring", undefined, "autres"],
    ["shadow.card", "shadow", "autres"],
  ];
  for (const [name, type, section] of CASES) it(`puts ${name} (${type ?? "untyped"}) in ${section}`, () => assert.equal(sectionOf(name, type), section));

  it("lists the breakpoints between the sizes and the rest, so the page and its navigation read one order", () => {
    assert.deepEqual(SECTIONS, ["roles", "palette", "typographie", "espacements", "arrondis", "tailles", "points-de-rupture", "autres"]);
  });

  it("keeps the order of the entries in each section, and puts each token in exactly one", () => {
    const all = [entry("palette.a", "color"), entry("color.x", "color"), entry("palette.b", "color"), entry("space.s", "dimension")];
    const held = charteOf(all, ["palette"], new Map());
    assert.deepEqual(held.palette.map((each) => each.name), ["palette.a", "palette.b"]);
    assert.equal(SECTIONS.reduce((sum, id) => sum + held[id].length, 0), all.length);
  });

  it("names, on a role, the token it cites", () => {
    const held = charteOf([entry("color.text", "color")], ["palette"], new Map([["color.text", ["palette.ink"]]]));
    assert.deepEqual(held.roles[0].cites, ["palette.ink"]);
  });
});

describe("the contrast of the roles of a charte", () => {
  const roles = (values) => Object.keys(values).map((name) => ({ name }));
  const gridOf = (values) => contrastOf(roles(values), new Map(Object.entries(values)));
  const cell = (grid, fg, bg) => grid.rows.find((row) => row.fg === fg).cells[grid.columns.indexOf(bg)];

  it("pairs a text-on role with the role it names, and any other text role with the background and the surface", () => {
    const grid = gridOf({ "color.background": "#ffffff", "color.surface": "#fafafa", "color.accent": "#e4572e", "color.text": "#000000", "color.text-on-accent": "#1f1a17" });
    assert.deepEqual(grid.columns, ["color.background", "color.surface", "color.accent"]);
    assert.deepEqual(grid.rows.map((row) => row.fg), ["color.text", "color.text-on-accent"]);
    assert.ok(cell(grid, "color.text", "color.background") && cell(grid, "color.text", "color.surface"));
    assert.equal(cell(grid, "color.text", "color.accent"), null);
    assert.ok(cell(grid, "color.text-on-accent", "color.accent"));
    assert.equal(cell(grid, "color.text-on-accent", "color.background"), null);
  });

  const CASES = [
    ["#000000", "#ffffff", "aa"],
    ["#7f7f7f", "#ffffff", "large"],
    ["#aaaaaa", "#ffffff", "fail"],
    ["#767676", "#ffffff", "aa"],
  ];
  for (const [front, back, verdict] of CASES) it(`judges a text of ${front} on ${back} as ${verdict}`, () => {
    assert.equal(cell(gridOf({ "color.background": back, "color.text": front }), "color.text", "color.background").verdict, verdict);
  });

  it("judges a border and a focus ring at 3 to 1, not 4.5", () => {
    const grid = gridOf({ "color.background": "#ffffff", "color.border": "#7f7f7f", "color.focus": "#cccccc" });
    assert.equal(cell(grid, "color.border", "color.background").verdict, "aa");
    assert.equal(cell(grid, "color.focus", "color.background").verdict, "fail");
  });

  it("measures the ratio, and leaves a pair whose colour it cannot read without a cell", () => {
    const grid = gridOf({ "color.background": "#ffffff", "color.text": "#7f7f7f", "color.text-muted": "var(--x)" });
    assert.ok(Math.abs(cell(grid, "color.text", "color.background").ratio - 4.004) < 0.001);
    assert.equal(cell(grid, "color.text-muted", "color.background"), null);
  });

  it("has no grid without a text role", () => {
    assert.deepEqual(gridOf({ "color.background": "#ffffff", "color.accent": "#e4572e" }).rows, []);
  });
});
