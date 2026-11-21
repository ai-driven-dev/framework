import { describe, expect, it } from "vitest";
import { withRootToken } from "../../../../../src/contexts/translate/domain/rules/root-token.js";

// Written as split literals to avoid biome's noTemplateCurlyInString warning.
const CLAUDE_ROOT = "$" + "{CLAUDE_PLUGIN_ROOT}";

describe("withRootToken", () => {
  it("writes the token the tool expands where the content names the source one", () => {
    expect(withRootToken(`node ${CLAUDE_ROOT}/hooks/a.cjs`, "$" + "{PLUGIN_ROOT}")).toBe(
      "node $" + "{PLUGIN_ROOT}/hooks/a.cjs"
    );
  });

  it("returns the content as it is when the layout substitutes no token", () => {
    const content = `node ${CLAUDE_ROOT}/hooks/a.cjs`;

    expect(withRootToken(content, undefined)).toBe(content);
  });
});
