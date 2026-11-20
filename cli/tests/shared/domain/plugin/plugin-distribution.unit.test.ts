import { describe, expect, it } from "vitest";
import { PluginDistribution } from "../../../../src/shared/domain/plugin/plugin-distribution.js";
import { TOOL } from "../../testing/registered-tools.builder.js";

const files = [{ relativePath: "skills/a/SKILL.md", content: "a" }];
const none = { skills: [], commands: [], agents: [], rules: [], hooks: [], mcp: [] };
const distribution = new PluginDistribution({
  manifest: { name: "p", version: "1.0.0", strict: false },
  format: TOOL.claude,
  files,
  components: { ...none, skills: files },
});

describe("PluginDistribution.withStrict", () => {
  it("returns a copy whose manifest carries the strict flag", () => {
    expect(distribution.withStrict(true).manifest).toEqual({
      name: "p",
      version: "1.0.0",
      strict: true,
    });
  });

  it("keeps the format, files and components", () => {
    const strict = distribution.withStrict(true);

    expect(strict.format).toBe(TOOL.claude);
    expect(strict.files).toBe(files);
    expect(strict.components).toBe(distribution.components);
  });

  it("leaves the original untouched", () => {
    distribution.withStrict(true);

    expect(distribution.manifest.strict).toBe(false);
  });
});
