const assert = require("node:assert/strict");
const path = require("node:path");
const { describe, it } = require("node:test");
const { LIB } = require("../fixtures/aidd-ui/project.js");
const { charteOf, SECTIONS } = require(path.join(LIB, "charte.cjs"));

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
    assert.deepEqual(SECTIONS, ["palette", "roles", "typographie", "espacements", "arrondis", "tailles", "points-de-rupture", "autres"]);
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
