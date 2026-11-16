import { describe, expect, it } from "vitest";
import { rewriteCodexContent } from "../../../../../../src/contexts/tools/domain/profiles/codex/profile.js";

describe("rewriteCodexContent()", () => {
  it("sends a skill reference to the agents directory Codex scans, under its aidd- prefix", () => {
    expect(rewriteCodexContent("Read .codex/skills/01-plan/SKILL.md\n")).toBe(
      "Read .agents/skills/aidd-01-plan/SKILL.md\n"
    );
  });

  it("routes a numbered command folder under commands/aidd/<phase>/, with or without the @ prefix", () => {
    expect(
      rewriteCodexContent(
        "Run .codex/commands/04_code/implement.md, then @.codex/commands/02-plan/plan.md.\n"
      )
    ).toBe("Run .codex/commands/aidd/04/implement.md, then @.codex/commands/aidd/02/plan.md.\n");
  });
});
