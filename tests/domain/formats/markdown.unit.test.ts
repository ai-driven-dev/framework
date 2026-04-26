import { describe, expect, it } from "vitest";
import { parseFrontmatter, serializeFrontmatter } from "../../../src/domain/formats/markdown.js";

describe("parseFrontmatter()", () => {
  it("parses frontmatter and body from a well-formed file", () => {
    const content = "---\nname: my-agent\ndescription: A test agent\n---\nBody text here.";
    const { frontmatter, body } = parseFrontmatter(content);
    expect(frontmatter).toEqual({ name: "my-agent", description: "A test agent" });
    expect(body).toBe("Body text here.");
  });

  it("returns empty frontmatter and full content when no delimiter", () => {
    const content = "Just a plain body with no frontmatter.";
    const { frontmatter, body } = parseFrontmatter(content);
    expect(frontmatter).toEqual({});
    expect(body).toBe(content);
  });

  it("returns empty frontmatter when closing delimiter is missing", () => {
    const content = "---\nname: broken\nno closing delimiter";
    const { frontmatter, body } = parseFrontmatter(content);
    expect(frontmatter).toEqual({});
    expect(body).toBe(content);
  });

  it("parses boolean values correctly", () => {
    const content = "---\nalwaysApply: false\nenabled: true\n---\nbody";
    const { frontmatter } = parseFrontmatter(content);
    expect(frontmatter.alwaysApply).toBe(false);
    expect(frontmatter.enabled).toBe(true);
  });

  it("parses array values correctly", () => {
    const content = "---\npaths:\n  - src/**/*.ts\n  - tests/**/*.ts\n---\nbody";
    const { frontmatter } = parseFrontmatter(content);
    expect(frontmatter.paths).toEqual(["src/**/*.ts", "tests/**/*.ts"]);
  });

  it("parses quoted string values", () => {
    const content = "---\nname: 'my agent'\n---\nbody";
    const { frontmatter } = parseFrontmatter(content);
    expect(frontmatter.name).toBe("my agent");
  });
});

describe("serializeFrontmatter()", () => {
  it("serializes frontmatter and body into delimited format", () => {
    const result = serializeFrontmatter({ name: "my-agent", description: "A test" }, "Body text.");
    expect(result).toContain("---");
    expect(result).toContain("name: 'my-agent'");
    expect(result).toContain("description: 'A test'");
    expect(result).toContain("Body text.");
  });

  it("returns body only (without leading newline) when frontmatter is empty", () => {
    const result = serializeFrontmatter({}, "\nBody only.");
    expect(result).toBe("Body only.");
  });

  it("serializes array values as YAML lists", () => {
    const result = serializeFrontmatter({ paths: ["src/**/*.ts"] }, "body");
    expect(result).toContain("paths:");
    expect(result).toContain('  - "src/**/*.ts"');
  });

  it("serializes boolean values without quotes", () => {
    const result = serializeFrontmatter({ alwaysApply: false }, "body");
    expect(result).toContain("alwaysApply: false");
  });

  it("round-trips: parse then serialize preserves content", () => {
    const original = "---\nname: 'my-agent'\ndescription: 'A test'\n---\nBody text.";
    const { frontmatter, body } = parseFrontmatter(original);
    const result = serializeFrontmatter(frontmatter, body);
    const reparsed = parseFrontmatter(result);
    expect(reparsed.frontmatter).toEqual(frontmatter);
    expect(reparsed.body).toBe(body);
  });
});
