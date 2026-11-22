import { describe, expect, it } from "vitest";
import {
  applyLinkSyntax,
  REFERENCE_CHARS,
} from "../../../../src/contexts/tools/contract/link-syntax.js";

describe("applying link syntax rules", () => {
  it("applies each rule in turn, so a later rule reads what an earlier one wrote", () => {
    expect(
      applyLinkSyntax("a", [
        { from: /a/g, to: "b" },
        { from: /b/g, to: "c" },
      ])
    ).toBe("c");
  });

  it("writes a group into a string and calls a function with the groups", () => {
    expect(
      applyLinkSyntax("x1 y2", [
        { from: /x(\d)/g, to: "[$1]" },
        { from: /y(\d)/g, to: (_match, digit) => `<${digit}>` },
      ])
    ).toBe("[1] <2>");
  });

  it("leaves a text no rule matches as it is", () => {
    expect(applyLinkSyntax("same", [{ from: /other/g, to: "x" }])).toBe("same");
  });
});

describe("where a reference ends", () => {
  it("ends a reference at a space, a quote, a backtick, a comma or a closing bracket", () => {
    const match = (text: string) => new RegExp(REFERENCE_CHARS).exec(text)?.[0];
    expect(match("a/b.md rest")).toBe("a/b.md");
    expect(match("a/b.md`x")).toBe("a/b.md");
    expect(match("a/b.md,x")).toBe("a/b.md");
    expect(match("a/b.md>x")).toBe("a/b.md");
    expect(match("a/b.md'x")).toBe("a/b.md");
    expect(match('a/b.md"x')).toBe("a/b.md");
  });
});
