import { describe, expect, it } from "vitest";
import { cursor } from "../../../../../../src/contexts/tools/domain/profiles/cursor/profile.js";

describe("cursor content", () => {
  describe("rewriteContent()", () => {
    it("routes a numbered command folder under commands/aidd/<phase>/, with or without the @ prefix", () => {
      const rewritten = cursor.rewriteContent?.(
        "Run .cursor/commands/04_code/implement.md, then @.cursor/commands/02-plan/plan.md.\n"
      );
      expect(rewritten).toBe(
        "Run .cursor/commands/aidd/04/implement.md, then @.cursor/commands/aidd/02/plan.md.\n"
      );
    });

    it("gives a referenced rule Cursor's .mdc extension", () => {
      const rewritten = cursor.rewriteContent?.("Read @.cursor/rules/01-standards/naming.md\n");
      expect(rewritten).toBe("Read @.cursor/rules/01-standards/naming.mdc\n");
    });
  });
});
