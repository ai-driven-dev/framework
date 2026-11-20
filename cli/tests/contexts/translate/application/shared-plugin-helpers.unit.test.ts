import { describe, expect, it } from "vitest";
import { assertNoToolsPlaceholder } from "../../../../src/contexts/translate/application/shared-plugin-helpers.js";
import { FrameworkPlaceholderInPluginError } from "../../../../src/shared/domain/errors.js";

describe("assertNoToolsPlaceholder", () => {
  it("accepts content that holds no tools placeholder", () => {
    expect(() =>
      assertNoToolsPlaceholder("plain text", "aidd-dev", "skills/x/SKILL.md")
    ).not.toThrow();
  });

  it("refuses content that holds one, naming the plugin and the file", () => {
    const refused = () =>
      assertNoToolsPlaceholder("see @{{TOOLS}}/skills", "aidd-dev", "skills/x/SKILL.md");

    expect(refused).toThrow(FrameworkPlaceholderInPluginError);
    expect(refused).toThrow(/aidd-dev.*skills\/x\/SKILL\.md|skills\/x\/SKILL\.md.*aidd-dev/s);
  });
});
