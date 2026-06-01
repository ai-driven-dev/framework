import { describe, expect, it } from "vitest";
import {
  flatMcpKeyPrefix,
  genericFlatAgentPath,
  genericFlatHooksFile,
  genericFlatHooksScriptPath,
  genericFlatSkillPath,
} from "../../../src/domain/formats/flat-paths.js";

describe("genericFlatAgentPath", () => {
  it("strips .md suffix and adds outputExt — bare (no plugin segment)", () => {
    expect(genericFlatAgentPath(".github/agents/", "aidd-dev", "implementer.md", ".agent.md")).toBe(
      ".github/agents/implementer.agent.md"
    );
  });

  it("does not double-strip when name has no .md", () => {
    expect(genericFlatAgentPath(".github/agents/", "aidd-dev", "reviewer", ".agent.md")).toBe(
      ".github/agents/reviewer.agent.md"
    );
  });

  it("preserves .md output ext for tools that keep .md", () => {
    expect(genericFlatAgentPath(".claude/agents/", "my-plugin", "agent.md", ".md")).toBe(
      ".claude/agents/agent.md"
    );
  });

  it("plugin param is ignored — same result regardless of plugin name", () => {
    expect(genericFlatAgentPath(".cursor/agents/", "my-plugin", "agent.md", ".md")).toBe(
      ".cursor/agents/agent.md"
    );
  });
});

describe("genericFlatSkillPath", () => {
  it("sits directly under skills root — bare (no plugin segment)", () => {
    expect(genericFlatSkillPath(".github/skills/", "aidd-dev", "commit/SKILL.md")).toBe(
      ".github/skills/commit/SKILL.md"
    );
  });

  it("preserves single-level rel path", () => {
    expect(genericFlatSkillPath(".github/skills/", "aidd-dev", "hello.md")).toBe(
      ".github/skills/hello.md"
    );
  });

  it("works with different prefixes", () => {
    expect(genericFlatSkillPath(".claude/skills/", "aidd-dev", "commit/SKILL.md")).toBe(
      ".claude/skills/commit/SKILL.md"
    );
  });
});

describe("genericFlatHooksFile", () => {
  it("returns per-plugin hooks file path", () => {
    expect(genericFlatHooksFile(".github/hooks/", "aidd-dev")).toBe(
      ".github/hooks/aidd-dev.hooks.json"
    );
  });

  it("uses the full plugin name", () => {
    expect(genericFlatHooksFile(".github/hooks/", "my-awesome-plugin")).toBe(
      ".github/hooks/my-awesome-plugin.hooks.json"
    );
  });

  it("works with different prefixes", () => {
    expect(genericFlatHooksFile(".claude/hooks/", "aidd-dev")).toBe(
      ".claude/hooks/aidd-dev.hooks.json"
    );
  });
});

describe("genericFlatHooksScriptPath", () => {
  it("returns per-plugin script path under hooks/plugin/", () => {
    expect(genericFlatHooksScriptPath(".github/hooks/", "aidd-dev", "check.sh")).toBe(
      ".github/hooks/aidd-dev/check.sh"
    );
  });

  it("works with different prefixes", () => {
    expect(genericFlatHooksScriptPath(".cursor/hooks/", "aidd-dev", "check.sh")).toBe(
      ".cursor/hooks/aidd-dev/check.sh"
    );
  });
});

describe("flatMcpKeyPrefix", () => {
  it("returns plugin name with trailing dash", () => {
    expect(flatMcpKeyPrefix("aidd-dev")).toBe("aidd-dev-");
  });

  it("uses the full plugin name", () => {
    expect(flatMcpKeyPrefix("my-awesome-plugin")).toBe("my-awesome-plugin-");
  });
});
