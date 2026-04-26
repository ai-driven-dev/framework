import { describe, expect, it } from "vitest";
import {
  baseReverseRewriteContent,
  baseRewriteContent,
} from "../../../src/domain/formats/placeholders.js";

describe("baseRewriteContent()", () => {
  it("replaces {{TOOLS}}/ with the tool directory", () => {
    const result = baseRewriteContent("{{TOOLS}}/agents/", ".claude/", "aidd_docs");
    expect(result).toBe(".claude/agents/");
  });

  it("replaces @{{TOOLS}}/ with @{directory}", () => {
    const result = baseRewriteContent("@{{TOOLS}}/agents/alexia.md", ".claude/", "aidd_docs");
    expect(result).toBe("@.claude/agents/alexia.md");
  });

  it("replaces {{DOCS}}/ with the docs directory", () => {
    const result = baseRewriteContent("{{DOCS}}/memory/", ".claude/", "aidd_docs");
    expect(result).toBe("aidd_docs/memory/");
  });

  it("replaces @{{DOCS}}/ with @{docsDir}/", () => {
    const result = baseRewriteContent("@{{DOCS}}/CATALOG.md", ".claude/", "aidd_docs");
    expect(result).toBe("@aidd_docs/CATALOG.md");
  });
});

describe("baseReverseRewriteContent()", () => {
  it("reverses tool directory back to {{TOOLS}}/", () => {
    const result = baseReverseRewriteContent(".claude/agents/", ".claude/", "aidd_docs");
    expect(result).toBe("{{TOOLS}}/agents/");
  });

  it("reverses @{directory} back to @{{TOOLS}}/", () => {
    const result = baseReverseRewriteContent("@.claude/agents/alexia.md", ".claude/", "aidd_docs");
    expect(result).toBe("@{{TOOLS}}/agents/alexia.md");
  });

  it("reverses docs directory back to {{DOCS}}/", () => {
    const result = baseReverseRewriteContent("aidd_docs/memory/", ".claude/", "aidd_docs");
    expect(result).toBe("{{DOCS}}/memory/");
  });

  it("round-trip: rewrite then reverse restores original content", () => {
    const original = "Use @{{TOOLS}}/agents/ and see {{DOCS}}/CATALOG.md";
    const rewritten = baseRewriteContent(original, ".claude/", "aidd_docs");
    const reversed = baseReverseRewriteContent(rewritten, ".claude/", "aidd_docs");
    expect(reversed).toBe(original);
  });
});
