import { describe, expect, it } from "vitest";
import { opencode } from "../../../../../../src/contexts/tools/domain/profiles/opencode/profile.js";

describe("opencode.rewriteContent()", () => {
  it("routes a numbered command folder under commands/aidd/<phase>/, with or without the @ prefix", () => {
    expect(
      opencode.rewriteContent(
        "Run .opencode/commands/04_code/implement.md, then @.opencode/commands/02-plan/plan.md.\n"
      )
    ).toBe(
      "Run .opencode/commands/aidd/04/implement.md, then @.opencode/commands/aidd/02/plan.md.\n"
    );
  });
});
