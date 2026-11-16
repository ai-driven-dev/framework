import { describe, expect, it } from "vitest";
import { claude } from "../../../../../../src/contexts/tools/domain/profiles/claude/profile.js";

describe("claude content", () => {
  describe("rewriteContent()", () => {
    it("routes a numbered command folder under commands/aidd/<phase>/, with or without the @ prefix", () => {
      expect(
        claude.rewriteContent?.(
          "Run .claude/commands/04_code/implement.md, then @.claude/commands/02_context/plan.md.\n"
        )
      ).toBe(
        "Run .claude/commands/aidd/04/implement.md, then @.claude/commands/aidd/02/plan.md.\n"
      );
    });
  });
});
