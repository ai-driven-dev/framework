import { describe, expect, it } from "vitest";
import { AgentsCapability } from "../../../../../src/contexts/tools/domain/capabilities/agents-capability.js";

const identity = (fm: Record<string, unknown>) => fm;

describe("AgentsCapability", () => {
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

  describe("buildOutputPath", () => {
    it("combines directory, agents folder, name, and tool suffix", () => {
      const cap = new AgentsCapability(markdownParams);
      expect(cap.buildOutputPath("my-agent")).toBe(".claude/agents/my-agent.claude.md");
    });

    it("uses toml params when format is toml", () => {
      const cap = new AgentsCapability(tomlParams);
      expect(cap.buildOutputPath("my-agent")).toBe(".codex/agents/my-agent.codex.md");
    });
  });

  describe("accepts", () => {
    it("returns true when path starts with directory", () => {
      const cap = new AgentsCapability(markdownParams);
      expect(cap.accepts(".claude/agents/foo.md")).toBe(true);
    });

    it("returns false when path does not start with directory", () => {
      const cap = new AgentsCapability(markdownParams);
      expect(cap.accepts(".cursor/agents/foo.md")).toBe(false);
    });
  });

  describe("serialize (markdown)", () => {
    it("produces frontmatter-delimited markdown content", () => {
      const cap = new AgentsCapability(markdownParams);
      const result = cap.serialize({ name: "my-agent", description: "A test" }, "Body text.");
      expect(result).toContain("---");
      expect(result).toContain("name: 'my-agent'");
      expect(result).toContain("Body text.");
    });
  });

  it("writes through the host's own serializer when it declares one", () => {
    const cap = new AgentsCapability({
      ...tomlParams,
      serialize: (fm, body) => `${fm.name}|${body}`,
    });
    expect(cap.serialize({ name: "a" }, "b")).toBe("a|b");
  });

  describe("deserialize", () => {
    it("parses frontmatter and body from markdown content", () => {
      const cap = new AgentsCapability(markdownParams);
      const content = "---\nname: my-agent\ndescription: A test\n---\nBody text.";
      const { frontmatter, body } = cap.deserialize(content);
      expect(frontmatter).toEqual({ name: "my-agent", description: "A test" });
      expect(body).toBe("Body text.");
    });

    it("returns empty frontmatter when no delimiter present", () => {
      const cap = new AgentsCapability(markdownParams);
      const { frontmatter, body } = cap.deserialize("plain body");
      expect(frontmatter).toEqual({});
      expect(body).toBe("plain body");
    });
  });

  describe("equals", () => {
    it("returns true for identical params", () => {
      const a = new AgentsCapability(markdownParams);
      const b = new AgentsCapability({ ...markdownParams });
      expect(a.equals(b)).toBe(true);
    });

    it("returns false when directory differs", () => {
      const a = new AgentsCapability(markdownParams);
      const b = new AgentsCapability({ ...markdownParams, directory: ".cursor/" });
      expect(a.equals(b)).toBe(false);
    });

    it("returns false when format differs", () => {
      const a = new AgentsCapability(markdownParams);
      const b = new AgentsCapability({ ...markdownParams, format: "toml" });
      expect(a.equals(b)).toBe(false);
    });
  });
});

describe("AgentsCapability install paths", () => {
  const markdown = new AgentsCapability({
    directory: ".claude/",
    toolSuffix: ".claude.md",
    format: "markdown",
    frontmatter: identity,
  });
  const toml = new AgentsCapability({
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
    const delegating = new AgentsCapability({
      directory: ".x/",
      toolSuffix: ".x.md",
      format: "markdown",
      frontmatter: identity,
      buildInstallPath: (fileName) => `custom/${fileName}`,
    });

    expect(delegating.buildInstallPath("planner.x.md")).toBe("custom/planner.x.md");
  });
});

describe("AgentsCapability file acceptance", () => {
  const cap = new AgentsCapability({
    directory: ".claude/",
    toolSuffix: ".claude.md",
    format: "markdown",
    frontmatter: identity,
  });
  const suffixes = [".claude.md", ".cursor.md", ".codex.md"];

  it("accepts its own suffix and a suffix belonging to no tool", () => {
    expect(cap.acceptsFileName("planner.claude.md", suffixes)).toBe(true);
    expect(cap.acceptsFileName("planner.md", suffixes)).toBe(true);
  });

  it("refuses another tool's suffix wherever the file sits", () => {
    expect(cap.acceptsFileName("a/b/planner.cursor.md", suffixes)).toBe(false);
  });
});

describe("AgentsCapability frontmatter conversion", () => {
  const cap = new AgentsCapability({
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

describe("AgentsCapability equality", () => {
  const base = {
    directory: ".claude/",
    toolSuffix: ".claude.md",
    format: "markdown" as const,
    frontmatter: identity,
  };

  it("differs on the tool suffix", () => {
    expect(
      new AgentsCapability(base).equals(new AgentsCapability({ ...base, toolSuffix: ".x.md" }))
    ).toBe(false);
  });

  it("differs on the user file extension", () => {
    expect(
      new AgentsCapability({ ...base, userFileExt: ".md" }).equals(
        new AgentsCapability({ ...base, userFileExt: ".toml" })
      )
    ).toBe(false);
  });
});
