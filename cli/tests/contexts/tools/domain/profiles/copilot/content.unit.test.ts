import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { copilot } from "../../../../../../src/contexts/tools/domain/profiles/copilot/profile.js";

/** What a reference to another framework file becomes once installed for Copilot. No other gate
 * sees it: `translate` never calls `rewriteContent`, and the byte-frozen golden cell is claude,
 * whose rewrite is the identity. The whole rewritten string is asserted, never a fragment. */
describe("a reference to another framework file, installed for Copilot", () => {
  const rewrite = (content: string) => copilot.rewriteContent(content);

  describe("an @-reference, which becomes a link", () => {
    it("points an agent reference at the installed .agent.md file", () => {
      expect(rewrite("See @{{TOOLS}}/agents/executor.md for details")).toBe(
        "See [.github/agents/executor.agent.md](../../.github/agents/executor.agent.md) for details"
      );
    });

    it("points a command reference at the flattened prompt file", () => {
      expect(rewrite("Run @{{TOOLS}}/commands/01-plan/02_step.md now")).toBe(
        "Run [.github/prompts/01-02-step.prompt.md](../../.github/prompts/01-02-step.prompt.md) now"
      );
    });

    it("points a rule reference at the instructions file, numeric prefix stripped", () => {
      expect(rewrite("Read @{{TOOLS}}/rules/1-style.md")).toBe(
        "Read [.github/instructions/style.instructions.md](../../.github/instructions/style.instructions.md)"
      );
    });

    it("keeps a skill reference's directory structure, which Copilot does not flatten", () => {
      expect(rewrite("Read @{{TOOLS}}/skills/01-plan/SKILL.md")).toBe(
        "Read [.github/skills/01-plan/SKILL.md](../../.github/skills/01-plan/SKILL.md)"
      );
    });

    it("points a docs reference into the project's docs directory", () => {
      expect(rewrite("Read @{{DOCS}}/memory/testing.md")).toBe(
        "Read [aidd_docs/memory/testing.md](../../aidd_docs/memory/testing.md)"
      );
    });

    it("gives a section nobody declared a prefixed path rather than dropping the link", () => {
      expect(rewrite("Unknown @{{TOOLS}}/hooks/thing.js")).toBe(
        "Unknown [.github/hooks/thing.js](../../.github/hooks/thing.js)"
      );
    });

    it("resolves a reference to a section directory to that directory", () => {
      expect(rewrite("Everything under @{{TOOLS}}/agents/ applies")).toBe(
        "Everything under [.github/agents/](../../.github/agents/) applies"
      );
    });

    it("resolves every other section's directory reference to its installed directory", () => {
      expect(rewrite("@{{TOOLS}}/commands/ @{{TOOLS}}/rules/ @{{TOOLS}}/skills/")).toBe(
        "[.github/prompts/](../../.github/prompts/) " +
          "[.github/instructions/](../../.github/instructions/) " +
          "[.github/skills/](../../.github/skills/)"
      );
    });

    it("keeps a nested directory reference's folder rather than flattening it", () => {
      expect(
        rewrite(
          "@{{TOOLS}}/agents/team/ @{{TOOLS}}/commands/01-plan/ @{{TOOLS}}/rules/01-standards/"
        )
      ).toBe(
        "[.github/agents/team/](../../.github/agents/team/) " +
          "[.github/prompts/01-plan/](../../.github/prompts/01-plan/) " +
          "[.github/instructions/01-standards/](../../.github/instructions/01-standards/)"
      );
    });

    it("keeps a reference to a section's .gitkeep under its own section path", () => {
      expect(
        rewrite(
          "@{{TOOLS}}/agents/.gitkeep @{{TOOLS}}/commands/.gitkeep @{{TOOLS}}/rules/.gitkeep @{{TOOLS}}/skills/.gitkeep"
        )
      ).toBe(
        "[.github/agents/.gitkeep](../../.github/agents/.gitkeep) " +
          "[.github/commands/.gitkeep](../../.github/commands/.gitkeep) " +
          "[.github/rules/.gitkeep](../../.github/rules/.gitkeep) " +
          "[.github/skills/.gitkeep](../../.github/skills/.gitkeep)"
      );
    });

    it("rewrites every reference in the content, not only the first", () => {
      expect(
        rewrite("@{{TOOLS}}/agents/a.md @{{TOOLS}}/agents/b.md @{{DOCS}}/a.md @{{DOCS}}/b.md")
      ).toBe(
        "[.github/agents/a.agent.md](../../.github/agents/a.agent.md) " +
          "[.github/agents/b.agent.md](../../.github/agents/b.agent.md) " +
          "[aidd_docs/a.md](../../aidd_docs/a.md) " +
          "[aidd_docs/b.md](../../aidd_docs/b.md)"
      );
    });

    it("leaves alone a placeholder that only resembles {{TOOLS}}", () => {
      expect(rewrite("See @{{TOOLX}}/agents/x.md")).toBe("See @{{TOOLX}}/agents/x.md");
    });
  });

  describe("a plain path reference, which stays plain text", () => {
    // Frontmatter cannot hold a markdown link, so the form without the @ replaces the
    // directory prefix and nothing else.
    it("replaces the agents prefix and leaves the filename alone", () => {
      expect(rewrite("Path: {{TOOLS}}/agents/executor.md")).toBe(
        "Path: .github/agents/executor.md"
      );
    });

    it("flattens a command path, because the installed file is flattened", () => {
      expect(rewrite("Path: {{TOOLS}}/commands/01-plan/02_step.md")).toBe(
        "Path: .github/prompts/01-02-step.prompt.md"
      );
    });

    it("replaces the rules and skills prefixes in one pass", () => {
      expect(rewrite("At {{TOOLS}}/rules/1-style.md and {{TOOLS}}/skills/x/SKILL.md")).toBe(
        "At .github/instructions/1-style.md and .github/skills/x/SKILL.md"
      );
    });

    it("replaces a bare tools or docs prefix for a section it does not know", () => {
      expect(rewrite("Bare {{TOOLS}}/other/thing.md and {{DOCS}}/x.md")).toBe(
        "Bare .github/other/thing.md and aidd_docs/x.md"
      );
    });

    it("resolves the plugins path a pinned release still ships", () => {
      // A real placeholder-carrying line, from framework-real's 00-sdlc skill.
      expect(rewrite("validator: `{{TOOLS}}/plugins/aidd-pm/skills/05-spec/x.yml`")).toBe(
        "validator: `.github/plugins/aidd-pm/skills/05-spec/x.yml`"
      );
    });
  });

  describe("content with nothing to rewrite", () => {
    it("is returned unchanged", () => {
      const content = "# A heading\n\nProse with a [link](https://example.com) and `code`.\n";
      expect(rewrite(content)).toBe(content);
    });
  });

  describe("capabilities.plugins", () => {
    it("declares where copilot's own user-scope settings file lives, for --scope user", () => {
      const activation = copilot.capabilities.plugins.nativeActivation;
      expect(activation?.userSettingsPath?.("/home/tester", () => undefined)).toBe(
        join("/home/tester", ".copilot", "settings.json")
      );
    });
  });
});
