import { describe, expect, it } from "vitest";
import { AgentsSection } from "../../../../../src/contexts/tools/domain/sections/agents-section.js";

const identity = (fm: Record<string, unknown>) => fm;

describe("AgentsSection", () => {
  const markdownParams = {
    directory: ".claude/",
    toolSuffix: ".claude.md",
    format: "markdown" as const,
    frontmatter: identity,
  };

  const tomlParams = {
    directory: ".codex/",
    toolSuffix: ".codex.md",
    format: "toml" as const,
    frontmatter: identity,
  };

  describe("accepts", () => {
    it("returns true when path starts with directory", () => {
      const cap = new AgentsSection(markdownParams);
      expect(cap.accepts(".claude/agents/foo.md")).toBe(true);
    });

    it("returns false when path does not start with directory", () => {
      const cap = new AgentsSection(markdownParams);
      expect(cap.accepts(".cursor/agents/foo.md")).toBe(false);
    });
  });

  describe("serialize (markdown)", () => {
    it("produces frontmatter-delimited markdown content", () => {
      const cap = new AgentsSection(markdownParams);
      const result = cap.serialize({ name: "my-agent", description: "A test" }, "Body text.");
      expect(result).toContain("---");
      expect(result).toContain("name: 'my-agent'");
      expect(result).toContain("Body text.");
    });
  });

  it("writes through the host's own serializer when it declares one", () => {
    const cap = new AgentsSection({
      ...tomlParams,
      serialize: (fm, body) => `${fm.name}|${body}`,
    });
    expect(cap.serialize({ name: "a" }, "b")).toBe("a|b");
  });

  describe("deserialize", () => {
    it("parses frontmatter and body from markdown content", () => {
      const cap = new AgentsSection(markdownParams);
      const content = "---\nname: my-agent\ndescription: A test\n---\nBody text.";
      const { frontmatter, body } = cap.deserialize(content);
      expect(frontmatter).toEqual({ name: "my-agent", description: "A test" });
      expect(body).toBe("Body text.");
    });

    it("returns empty frontmatter when no delimiter present", () => {
      const cap = new AgentsSection(markdownParams);
      const { frontmatter, body } = cap.deserialize("plain body");
      expect(frontmatter).toEqual({});
      expect(body).toBe("plain body");
    });
  });

  describe("equals", () => {
    it("returns true for identical params", () => {
      const a = new AgentsSection(markdownParams);
      const b = new AgentsSection({ ...markdownParams });
      expect(a.equals(b)).toBe(true);
    });

    it("returns false when directory differs", () => {
      const a = new AgentsSection(markdownParams);
      const b = new AgentsSection({ ...markdownParams, directory: ".cursor/" });
      expect(a.equals(b)).toBe(false);
    });

    it("returns false when format differs", () => {
      const a = new AgentsSection(markdownParams);
      const b = new AgentsSection({ ...markdownParams, format: "toml" });
      expect(a.equals(b)).toBe(false);
    });
  });
});

describe("AgentsSection install paths", () => {
  const markdown = new AgentsSection({
    directory: ".claude/",
    toolSuffix: ".claude.md",
    format: "markdown",
    frontmatter: identity,
  });
  const toml = new AgentsSection({
    directory: ".codex/",
    toolSuffix: ".codex.md",
    format: "toml",
    frontmatter: identity,
  });

  it("installs a markdown agent under agents/ by its file name alone, the tool suffix dropped", () => {
    expect(markdown.buildInstallPath("a/b/planner.claude.md")).toBe(".claude/agents/planner.md");
  });

  it("leaves a markdown file carrying another tool's suffix as it is named", () => {
    expect(markdown.buildInstallPath("planner.cursor.md")).toBe(".claude/agents/planner.cursor.md");
  });

  it("installs a toml agent as .toml whether the source carried the tool suffix, .md, or neither", () => {
    expect(toml.buildInstallPath("sub/planner.codex.md")).toBe(".codex/agents/planner.toml");
    expect(toml.buildInstallPath("planner.md")).toBe(".codex/agents/planner.toml");
    expect(toml.buildInstallPath("planner.txt")).toBe(".codex/agents/planner.txt.toml");
  });

  it("asks the installer the tool declares before deriving a path itself", () => {
    const delegating = new AgentsSection({
      directory: ".x/",
      toolSuffix: ".x.md",
      format: "markdown",
      frontmatter: identity,
      buildInstallPath: (fileName) => `custom/${fileName}`,
    });

    expect(delegating.buildInstallPath("planner.x.md")).toBe("custom/planner.x.md");
  });
});

describe("AgentsSection file acceptance", () => {
  const cap = new AgentsSection({
    directory: ".claude/",
    toolSuffix: ".claude.md",
    format: "markdown",
    frontmatter: identity,
  });

  it("accepts its own suffix and a suffix belonging to no tool", () => {
    expect(cap.acceptsFileName("planner.claude.md")).toBe(true);
    expect(cap.acceptsFileName("planner.md")).toBe(true);
  });

  it("refuses another tool's suffix wherever the file sits", () => {
    expect(cap.acceptsFileName("a/b/planner.cursor.md")).toBe(false);
  });
});

describe("AgentsSection frontmatter conversion", () => {
  const cap = new AgentsSection({
    directory: ".x/",
    toolSuffix: ".x.md",
    format: "markdown",
    frontmatter: (fm) => ({ native: fm }),
  });

  it("writes through the host's own frontmatter, the declared name kept", () => {
    expect(cap.convertFrontmatter({ name: "planner", description: "d" })).toStrictEqual({
      native: { name: "planner", description: "d" },
    });
  });

  it("names an agent after its file when the frontmatter declares none", () => {
    expect(cap.convertFrontmatter({ description: "d" }, "agents/sub/planner.md")).toStrictEqual({
      native: { description: "d", name: "planner" },
    });
  });

  it("refuses a declared name that is not a string", () => {
    expect(cap.convertFrontmatter({ name: 7 })).toStrictEqual({ native: { name: undefined } });
  });
});

describe("AgentsSection equality", () => {
  const base = {
    directory: ".claude/",
    toolSuffix: ".claude.md",
    format: "markdown" as const,
    frontmatter: identity,
  };

  it("differs on the tool suffix", () => {
    expect(
      new AgentsSection(base).equals(new AgentsSection({ ...base, toolSuffix: ".x.md" }))
    ).toBe(false);
  });
});

describe("AgentsSection naming from a path", () => {
  const section = (format: "markdown" | "toml") =>
    new AgentsSection({
      directory: ".x/",
      toolSuffix: ".x.md",
      format,
      frontmatter: (fm) => fm,
    });

  it("keeps only the file name of a nested agent for the toml install path", () => {
    expect(section("toml").buildInstallPath("sub/dir/planner.x.md")).toBe(".x/agents/planner.toml");
    expect(section("toml").buildInstallPath("sub/dir/planner.md")).toBe(".x/agents/planner.toml");
    expect(section("toml").buildInstallPath("sub/dir/planner.txt")).toBe(
      ".x/agents/planner.txt.toml"
    );
  });

  it("keeps only the file name of a nested agent for the markdown install path", () => {
    expect(section("markdown").buildInstallPath("sub/planner.x.md")).toBe(".x/agents/planner.md");
  });

  it("names an agent after its file without a markdown extension anywhere else", () => {
    expect(section("markdown").convertFrontmatter({}, "a/b.mdx.md")).toStrictEqual({
      name: "b.mdx",
    });
  });

  it("leaves the name unset when neither the frontmatter nor a file gives one", () => {
    expect(section("markdown").convertFrontmatter({})).toStrictEqual({ name: undefined });
  });
});
