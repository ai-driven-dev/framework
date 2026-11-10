const assert = require("node:assert/strict");
const path = require("node:path");
const { describe, it } = require("node:test");
const { LIB } = require("../fixtures/aidd-ui/project.js");

const { parse, over, contrast } = require(path.join(LIB, "colour.cjs"));

const colour = (r, g, b, a = 1) => ({ r, g, b, a });
const WHITE = colour(1, 1, 1);
const BLACK = colour(0, 0, 0);
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.005, `${actual} is not ${expected}`);

describe("aidd-ui colour", () => {
  describe("parse", () => {
    it("reads a six-digit hex", () => {
      assert.deepEqual(parse("#336699"), colour(0.2, 0.4, 0.6));
    });

    it("reads a three-digit hex", () => {
      assert.deepEqual(parse("#f00"), colour(1, 0, 0));
    });

    it("reads rgb() with commas, channels over 255", () => {
      assert.deepEqual(parse("rgb(51, 102, 153)"), colour(0.2, 0.4, 0.6));
    });

    it("reads rgba() with its alpha", () => {
      assert.deepEqual(parse("rgba(51, 102, 153, 0.5)"), colour(0.2, 0.4, 0.6, 0.5));
    });

    it("reads rgb() with spaces and a slash alpha", () => {
      assert.deepEqual(parse("rgb(51 102 153 / 0.25)"), colour(0.2, 0.4, 0.6, 0.25));
    });

    it("reads color(srgb) channels as they are", () => {
      assert.deepEqual(parse("color(srgb 0.2 0.4 0.6)"), colour(0.2, 0.4, 0.6));
    });

    it("reads color(srgb) with its alpha", () => {
      assert.deepEqual(parse("color(srgb 0.2 0.4 0.6 / 0.5)"), colour(0.2, 0.4, 0.6, 0.5));
    });

    it("reads transparent as fully clear", () => {
      assert.equal(parse("transparent").a, 0);
    });

    it("ignores case and surrounding space", () => {
      assert.deepEqual(parse("  #FF0000 "), colour(1, 0, 0));
    });

    for (const other of ["hsl(210 50% 40%)", "color(display-p3 1 0 0)", "red", "var(--x)", "#12345", ""]) {
      it(`reads nothing of "${other}"`, () => {
        assert.equal(parse(other), null);
      });
    }
  });

  describe("over", () => {
    it("keeps an opaque colour", () => {
      assert.deepEqual(over(colour(0.2, 0.4, 0.6), WHITE), colour(0.2, 0.4, 0.6));
    });

    it("mixes a translucent colour with what is behind it", () => {
      assert.deepEqual(over(colour(0, 0, 0, 0.25), colour(1, 1, 1)), colour(0.75, 0.75, 0.75));
    });

    it("shows what is behind a fully clear colour", () => {
      assert.deepEqual(over(colour(0, 0, 0, 0), colour(0.2, 0.4, 0.6)), colour(0.2, 0.4, 0.6));
    });
  });

  describe("contrast", () => {
    it("is 21 for black on white, whichever side", () => {
      near(contrast(BLACK, WHITE), 21);
      near(contrast(WHITE, BLACK), 21);
    });

    it("is 1 for a colour on itself", () => {
      near(contrast(WHITE, WHITE), 1);
    });

    it("is 4.54 for #767676 on white", () => {
      near(contrast(parse("#767676"), WHITE), 4.54);
    });

    it("is 4.48 for #777777 on white", () => {
      near(contrast(parse("#777777"), WHITE), 4.48);
    });
  });
});
