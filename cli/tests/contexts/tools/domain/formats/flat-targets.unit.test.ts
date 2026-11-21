import { describe, expect, it } from "vitest";
import { flatTargetsOf } from "../../../../../src/contexts/tools/domain/formats/flat-targets.js";

const target = flatTargetsOf(
  (plugin, rel) => `A/${plugin}/${rel}`,
  (plugin, rel) => `S/${plugin}/${rel}`
);

describe("where a flat build puts what a relative link points at", () => {
  it("sends an agent and a skill where the tool keeps its own", () => {
    expect([target("p", "agents/x.md"), target("p", "skills/y/SKILL.md")]).toStrictEqual([
      "A/p/agents/x.md",
      "S/p/skills/y/SKILL.md",
    ]);
  });

  it("leaves anything else where the plugin has it", () => {
    expect(target("p", "hooks/z.cjs")).toBe("hooks/z.cjs");
  });
});
