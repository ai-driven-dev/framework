import { describe, expect, it } from "vitest";
import { assertNoToolsPlaceholder } from "../../../../src/contexts/translate/domain/tools-placeholder.js";
import { FrameworkPlaceholderInPluginError } from "../../../../src/contexts/translate/domain/translate.error.js";

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
