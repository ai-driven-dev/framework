import { describe, expect, it } from "vitest";
import { parseFrontmatter, serializeFrontmatter } from "../../src/kernel/markdown.js";

function frontmatterOf(lines: readonly string[]): Record<string, unknown> {
  return parseFrontmatter(`---\n${lines.join("\n")}\n---\nbody`).frontmatter;
}

describe("parseFrontmatter, line by line", () => {
  describe("a key", () => {
    it("must start the line: an indented line under a scalar is ignored", () => {
      expect(frontmatterOf(["parent: value", "  child: v", "  other:"])).toStrictEqual({
        parent: "value",
      });
    });

    it("may carry trailing spaces before its list", () => {
      expect(frontmatterOf(["list:  ", "  - a"])).toStrictEqual({ list: ["a"] });
    });

    it("reads a value with no space after the colon", () => {
      expect(frontmatterOf(["key:value"])).toStrictEqual({ key: "value" });
    });

    it("drops the spaces around a value", () => {
      expect(frontmatterOf(["key:   value   "])).toStrictEqual({ key: "value" });
    });
  });

  describe("a list", () => {
    it("drops the spaces around an item", () => {
      expect(frontmatterOf(["tags:", "  -   a   "])).toStrictEqual({ tags: ["a"] });
    });

    it("ends at the next key, even one whose value looks like an item", () => {
      expect(frontmatterOf(["tags:", "  - a", "note: keep  - this"])).toStrictEqual({
        tags: ["a"],
        note: "keep  - this",
      });
    });
  });

  describe("a block scalar", () => {
    it("folds > onto one line with single spaces", () => {
      expect(frontmatterOf(["d: >", "  one", "  two", "next: x"])).toStrictEqual({
        d: "one two",
        next: "x",
      });
    });

    it("folds >- the same way", () => {
      expect(frontmatterOf(["d: >-", "  one", "  two"])).toStrictEqual({ d: "one two" });
    });

    it("keeps | line by line", () => {
      expect(frontmatterOf(["d: |", "  one", "  two"])).toStrictEqual({ d: "one\ntwo" });
    });

    it("keeps |- line by line", () => {
      expect(frontmatterOf(["d: |-", "  one", "  two"])).toStrictEqual({ d: "one\ntwo" });
    });

    it("drops a blank line closing the block", () => {
      expect(frontmatterOf(["d: >", "  one", "  "])).toStrictEqual({ d: "one" });
    });

    it("drops a blank line closing a literal block", () => {
      expect(frontmatterOf(["d: |", "  one", "  "])).toStrictEqual({ d: "one" });
    });
  });

  describe("a scalar", () => {
    it("reads ~ as null", () => {
      expect(frontmatterOf(["v: ~"])).toStrictEqual({ v: null });
    });

    it("keeps a number as text", () => {
      expect(frontmatterOf(["count: 42"])).toStrictEqual({ count: "42" });
    });

    it("keeps a bracketed value that is not JSON as text", () => {
      expect(frontmatterOf(["tools: [a, b]"])).toStrictEqual({ tools: "[a, b]" });
    });

    it("unquotes a single-quoted value and undoubles its apostrophes", () => {
      expect(frontmatterOf(["name: 'it''s'"])).toStrictEqual({ name: "it's" });
    });

    it("unquotes a double-quoted value and unescapes its quotes", () => {
      expect(frontmatterOf(['name: "say \\"hi\\""'])).toStrictEqual({ name: 'say "hi"' });
    });

    it("keeps a value that only ends with a quote", () => {
      expect(frontmatterOf(["a: abc'", 'b: abc"'])).toStrictEqual({ a: "abc'", b: 'abc"' });
    });

    it("keeps a value that only starts with a quote", () => {
      expect(frontmatterOf(["a: 'abc", 'b: "abc'])).toStrictEqual({ a: "'abc", b: '"abc' });
    });

    it("keeps a lone quote", () => {
      expect(frontmatterOf(["a: '", 'b: "'])).toStrictEqual({ a: "'", b: '"' });
    });
  });

  it("never reads the body as frontmatter", () => {
    const { frontmatter, body } = parseFrontmatter("---\nname: x\n---\nfoo: bar\n");
    expect({ frontmatter, body }).toStrictEqual({ frontmatter: { name: "x" }, body: "foo: bar\n" });
  });
});

describe("serializeFrontmatter, line by line", () => {
  it("quotes a value that only starts with a bracket", () => {
    expect(serializeFrontmatter({ a: "[open" }, "body")).toBe("---\na: '[open'\n---\nbody");
  });

  it("quotes a value that only ends with a bracket", () => {
    expect(serializeFrontmatter({ a: "closed]" }, "body")).toBe("---\na: 'closed]'\n---\nbody");
  });

  it("drops only the leading newline of a bare body, never one inside it", () => {
    expect(serializeFrontmatter({}, "a\nb")).toBe("a\nb");
  });
});
