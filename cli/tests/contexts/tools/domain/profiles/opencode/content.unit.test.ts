import { describe, expect, it } from "vitest";
import { applyLinkSyntax } from "../../../../../../src/contexts/tools/contract/link-syntax.js";
import { opencode } from "../../../../../../src/contexts/tools/domain/profiles/opencode/opencode.profile.js";

const rewrite = (text: string) => applyLinkSyntax(text, opencode.linkSyntax);

describe("opencode link syntax", () => {
  it("routes a numbered command folder under commands/aidd/<phase>/, with or without the @ prefix", () => {
    expect(
      rewrite(
        "Run .opencode/commands/04_code/implement.md, then @.opencode/commands/02-plan/plan.md.\n"
      )
    ).toBe(
      "Run .opencode/commands/aidd/04/implement.md, then @.opencode/commands/aidd/02/plan.md.\n"
    );
  });
});
