const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it } = require("node:test");
const { LIB } = require("../fixtures/aidd-ui/project.js");

const { escaped, documentOf, inlined, fingerprintOf, STYLESHEET_LINK, FONT_FLOOR } = require(path.join(LIB, "html.cjs"));

// The helpers every page of the engine builds on: text as HTML, a markdown file as a document, a render
// with its tokens inline, and the hash that tells one shown set from another.

describe("aidd-ui html helpers", () => {
  it("escapes text as HTML text and as an attribute value", () => {
    assert.equal(escaped(`a & b < c > "d"`), "a &amp; b &lt; c &gt; &quot;d&quot;");
  });

  it("renders a markdown file as a document: front matter as chips, headings, lists, inline code", () => {
    const html = documentOf("---\nid: brand\n---\n\n# Brand\n\n- one `two`\n");
    assert.match(html, /<span class="chip"><span class="key">id<\/span>brand<\/span>/);
    assert.match(html, /<h1>Brand<\/h1>/);
    assert.match(html, /<li>one <code>two<\/code><\/li>/);
  });

  it("replaces the stylesheet link of a render with the font floor and the tokens", () => {
    const doc = `<head>${STYLESHEET_LINK}</head>`;
    assert.equal(inlined(doc, ":root{}"), `<head><style>\n${FONT_FLOOR}\n:root{}</style></head>`);
    assert.equal(inlined(doc, null), `<head><style>\n${FONT_FLOOR}\n</style></head>`);
  });

  it("fingerprints what a set shows: the same text the same, any name, path or text changed otherwise", () => {
    const variants = (text) => [{ name: "a", files: [{ path: "brand.md", text }] }, { name: "b", files: [] }];
    assert.match(fingerprintOf(variants("x")), /^[0-9a-f]{64}$/);
    assert.equal(fingerprintOf(variants("x")), fingerprintOf(variants("x")));
    assert.notEqual(fingerprintOf(variants("x")), fingerprintOf(variants("y")));
  });

  it("is what the showcase imports, not the compare page", () => {
    const source = fs.readFileSync(path.join(LIB, "showcase.cjs"), "utf8");
    assert.match(source, /require\("\.\/html\.cjs"\)/);
    assert.doesNotMatch(source, /require\("\.\/page\.cjs"\)/);
  });
});
