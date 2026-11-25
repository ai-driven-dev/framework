import { describe, expect, it } from "vitest";
import { cursor } from "../../../../../../src/composition/tool-profiles/cursor.js";
import { applyLinkSyntax } from "../../../../../../src/shared/domain/materialization/link-syntax.js";

const rewrite = (text: string) => applyLinkSyntax(text, cursor.linkSyntax);

describe("cursor content", () => {
  describe("link syntax", () => {
    it("routes a numbered command folder under commands/aidd/<phase>/, with or without the @ prefix", () => {
      const rewritten = rewrite(
        "Run .cursor/commands/04_code/implement.md, then @.cursor/commands/02-plan/plan.md.\n"
      );
      expect(rewritten).toBe(
        "Run .cursor/commands/aidd/04/implement.md, then @.cursor/commands/aidd/02/plan.md.\n"
      );
    });

    it("leaves a numbered command folder alone when nothing follows its slash", () => {
      const text = "See .cursor/commands/04_code/ for the list.\n";
      expect(rewrite(text)).toBe(text);
    });

    it("gives a referenced rule Cursor's .mdc extension", () => {
      const rewritten = rewrite("Read @.cursor/rules/01-standards/naming.md\n");
      expect(rewritten).toBe("Read @.cursor/rules/01-standards/naming.mdc\n");
    });
  });
});
