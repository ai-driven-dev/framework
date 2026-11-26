import { describe, expect, it } from "vitest";
import { PluginDistribution } from "../../../../src/shared/domain/plugin/plugin-distribution.js";
import { parsePluginName } from "../../../../src/shared/domain/plugin/plugin-name.js";
import { SYNTHETIC_TOOL } from "../../testing/synthetic-tool-id.builder.js";

const files = [{ relativePath: "skills/a/SKILL.md", content: "a" }];
const none = { skills: [], commands: [], agents: [], rules: [], hooks: [], mcp: [] };
const distribution = new PluginDistribution({
  manifest: { name: parsePluginName("p"), version: "1.0.0", strict: false },
  format: SYNTHETIC_TOOL,
  files,
  components: { ...none, skills: files },
});

describe("copying a distribution with the strict flag", () => {
  it("returns a copy whose manifest carries the strict flag", () => {
    expect(distribution.withStrict(true).manifest).toEqual({
      name: "p",
      version: "1.0.0",
      strict: true,
    });
  });

  it("keeps the format, files and components", () => {
    const strict = distribution.withStrict(true);

    expect(strict.format).toBe(SYNTHETIC_TOOL);
    expect(strict.files).toBe(files);
    expect(strict.components).toBe(distribution.components);
  });

  it("leaves the original untouched", () => {
    distribution.withStrict(true);

    expect(distribution.manifest.strict).toBe(false);
  });
});
