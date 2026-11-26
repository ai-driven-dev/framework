import { describe, expect, it } from "vitest";
import { FrameworkPlaceholderInPluginError } from "../../../../src/contexts/translate/contract/translate.error.js";
import { assertNoToolsPlaceholder } from "../../../../src/contexts/translate/domain/tools-placeholder.js";

describe("refusing the tools placeholder", () => {
  it("accepts content that holds no tools placeholder", () => {
    expect(() =>
      assertNoToolsPlaceholder("plain text", "aidd-dev", "skills/x/SKILL.md")
    ).not.toThrow();
  });

  it("refuses content that holds one, naming the plugin and the file", () => {
    const refused = () =>
      assertNoToolsPlaceholder("see @{{TOOLS}}/skills", "aidd-dev", "skills/x/SKILL.md");

    expect(refused).toThrow(FrameworkPlaceholderInPluginError);
    expect(refused).toThrow(new FrameworkPlaceholderInPluginError("aidd-dev", "skills/x/SKILL.md"));
  });
});
