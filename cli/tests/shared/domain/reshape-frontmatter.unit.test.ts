import { describe, expect, it } from "vitest";
import { reshapeFrontmatter } from "../../../src/shared/domain/markdown.js";

const DOC = "---\nname: old\nkind: a\n---\nBody\n";

describe("reshaping a document's frontmatter", () => {
  it("rewrites the frontmatter and keeps the body", () => {
    expect(reshapeFrontmatter(DOC, { frontmatter: (fm) => ({ ...fm, name: "new" }) })).toBe(
      "---\nname: 'new'\nkind: 'a'\n---\nBody\n"
    );
  });

  it("writes double quotes when the shape asks for them", () => {
    expect(reshapeFrontmatter(DOC, { frontmatter: (fm) => fm, quote: "double" })).toContain(
      'name: "old"'
    );
  });

  it("hands the document to the tool's own writer when it has one", () => {
    expect(
      reshapeFrontmatter(DOC, {
        frontmatter: (fm) => fm,
        serialize: (fm, body) => `${JSON.stringify(fm)}|${body}`,
      })
    ).toBe('{"name":"old","kind":"a"}|Body\n');
  });
});
