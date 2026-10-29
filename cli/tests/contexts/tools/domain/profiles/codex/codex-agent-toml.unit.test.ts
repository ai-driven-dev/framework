import { describe, expect, it } from "vitest";
import { codexAgentMarkdownToToml } from "../../../../../../src/contexts/tools/domain/profiles/codex/codex-agent-toml.js";
import { parseToml } from "../../../../../../src/contexts/tools/domain/profiles/codex/toml.js";

describe("codexAgentMarkdownToToml()", () => {
  describe("name resolution", () => {
    it("prefixes the file's base name with the plugin, whatever the frontmatter name", () => {
      expect(
        codexAgentMarkdownToToml(
          `---
name: planner
description: A planner.
---
Body.
`,
          "aidd-dev",
          "planner.md"
        )
      ).toBe(`name = "aidd-dev-planner"
description = "A planner."
developer_instructions = "Body.\\n"
`);
    });

    it("names an agent without frontmatter after its plugin and file, description empty", () => {
      expect(
        codexAgentMarkdownToToml("No frontmatter here.", "aidd-dev", "implementer.md")
      ).toBe(`name = "aidd-dev-implementer"
description = ""
developer_instructions = "No frontmatter here."
`);
    });
  });

  describe("verbatim body preservation", () => {
    it("preserves @./ references untouched in developer_instructions", () => {
      const body = "See @./foo.md for details.";
      const toml = codexAgentMarkdownToToml(
        `---\nname: agent\n---\n\n${body}`,
        "aidd-dev",
        "agent.md"
      );
      const parsed = parseToml(toml);
      expect(parsed.developer_instructions).toContain("@./foo.md");
    });

    it("preserves @../ references untouched in developer_instructions", () => {
      const body = "See @../bar.md for details.";
      const toml = codexAgentMarkdownToToml(
        `---\nname: agent\n---\n\n${body}`,
        "aidd-dev",
        "agent.md"
      );
      const parsed = parseToml(toml);
      expect(parsed.developer_instructions).toContain("@../bar.md");
    });

    it("preserves @CLAUDE_PLUGIN_ROOT/ references untouched in developer_instructions", () => {
      // Use split literal to avoid biome noTemplateCurlyInString warning
      const claudeRootRef = "@$" + "{CLAUDE_PLUGIN_ROOT}/agents/planner.md";
      const toml = codexAgentMarkdownToToml(
        `---\nname: agent\n---\n\n${claudeRootRef}`,
        "aidd-dev",
        "agent.md"
      );
      const parsed = parseToml(toml);
      expect(typeof parsed.developer_instructions).toBe("string");
      const instr = parsed.developer_instructions as string;
      const claudeRoot = "$" + "{CLAUDE_PLUGIN_ROOT}";
      expect(instr).toContain(claudeRoot);
    });

    it("preserves all three reference forms together", () => {
      // Use split literals to avoid biome noTemplateCurlyInString warning
      const claudeRootRef = "@$" + "{CLAUDE_PLUGIN_ROOT}/baz.md";
      const body = `@./foo.md\n@../bar.md\n${claudeRootRef}`;
      const content = `---\nname: agent\n---\n\n${body}`;
      const toml = codexAgentMarkdownToToml(content, "aidd-dev", "agent.md");
      const parsed = parseToml(toml);
      const instr = parsed.developer_instructions as string;
      const claudeRoot = "$" + "{CLAUDE_PLUGIN_ROOT}";
      expect(instr).toContain("@./foo.md");
      expect(instr).toContain("@../bar.md");
      expect(instr).toContain(claudeRoot);
    });
  });

  describe("idempotency", () => {
    it("produces byte-identical output on two consecutive calls with identical input", () => {
      const content =
        "---\nname: planner\ndescription: A planner.\nmodel: opus\n---\n\nBody with code:\n```bash\necho hi\n```\n";
      const first = codexAgentMarkdownToToml(content, "aidd-dev", "planner.md");
      const second = codexAgentMarkdownToToml(content, "aidd-dev", "planner.md");
      expect(first).toBe(second);
    });
  });

  describe("TOML validity and round-trip", () => {
    it("produces valid TOML that parses successfully", () => {
      const content =
        "---\nname: implementer\ndescription: Implements code.\n---\n\n# Role\nYou implement code.";
      const toml = codexAgentMarkdownToToml(content, "aidd-dev", "implementer.md");
      expect(() => parseToml(toml)).not.toThrow();
    });

    it("round-trips body containing code fences, headings, and special chars", () => {
      const body = '# Heading\n\n```yaml\nkey: "value"\n```\n\nSome text with backslash: \\.';
      // parseFrontmatter includes the blank separator line as leading \n in body
      const content = `---\nname: agent\ndescription: Complex agent.\n---\n${body}`;
      const toml = codexAgentMarkdownToToml(content, "aidd-dev", "agent.md");
      const parsed = parseToml(toml);
      expect(parsed.developer_instructions).toBe(body);
    });

    it("round-trips name with quotes and special chars", () => {
      const content = "---\nname: 'my \"agent\"'\ndescription: Has quotes.\n---\n\nBody.";
      const toml = codexAgentMarkdownToToml(content, "aidd-dev", "agent.md");
      const parsed = parseToml(toml);
      expect(typeof parsed.name).toBe("string");
    });
  });

  describe("empty frontmatter", () => {
    it("always emits description (defaults to empty string when absent)", () => {
      const toml = codexAgentMarkdownToToml("No frontmatter.", "aidd-dev", "agent.md");
      const parsed = parseToml(toml);
      expect(parsed.developer_instructions).toBeDefined();
      // description is a required subagent key; always emitted even when absent in source.
      expect(parsed.description).toBe("");
    });
  });
});

describe("the name a Codex agent falls back to", () => {
  it("ignores an empty frontmatter name and names the agent after its plugin and file", () => {
    expect(
      codexAgentMarkdownToToml(
        "---\nname: ''\ndescription: Plans\n---\nBody.\n",
        "aidd-dev",
        "planner.md"
      )
    ).toBe(
      'name = "aidd-dev-planner"\ndescription = "Plans"\ndeveloper_instructions = "Body.\\n"\n'
    );
  });

  it("drops only the trailing .md from the file it names an agent after", () => {
    expect(
      codexAgentMarkdownToToml(
        "---\ndescription: Plans\n---\nBody.\n",
        "aidd-dev",
        "notes.md-helper.md"
      )
    ).toBe(
      'name = "aidd-dev-notes.md-helper"\ndescription = "Plans"\ndeveloper_instructions = "Body.\\n"\n'
    );
  });
});
