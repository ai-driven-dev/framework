import { describe, expect, it } from "vitest";
import { FrameworkPlaceholderInPluginError } from "../../../../../src/contexts/translate/contract/translate.error.js";
import { applyPlan } from "../../../../../src/contexts/translate/domain/rules/component-pipeline.js";

const PLAN = { source: "skills/a/SKILL.md", path: "out/a/SKILL.md", content: "body" };

describe("applying a component plan", () => {
  it("writes the content as it is when the layout names no rule", () => {
    expect(applyPlan(PLAN)).toEqual({ relativePath: "out/a/SKILL.md", content: "body" });
  });

  it("refuses the tools placeholder before any other rule reads the content", () => {
    const seen: string[] = [];
    const plan = {
      ...PLAN,
      content: "see @{{TOOLS}}/x",
      guard: { plugin: "p", name: "a/SKILL.md" },
      links: {
        kind: "tool" as const,
        syntax: [
          {
            from: /.+/s,
            to: (text: string) => {
              seen.push(text);
              return text;
            },
          },
        ],
      },
    };
    expect(() => applyPlan(plan)).toThrow(FrameworkPlaceholderInPluginError);
    expect(seen).toEqual([]);
  });

  it("reads the links, then shapes, then rewrites the script", () => {
    const trail: string[] = [];
    const step = (name: string) => (text: string) => {
      trail.push(name);
      return `${text}>${name}`;
    };
    const out = applyPlan({
      ...PLAN,
      links: { kind: "tool", syntax: [{ from: /.+/s, to: step("links") }] },
      shape: step("shape"),
      script: step("script"),
    });
    expect(trail).toEqual(["links", "shape", "script"]);
    expect(out.content).toBe("body>links>shape>script");
  });

  it("writes the plugin-root variable the tool expands before the script rewrite sees it", () => {
    const out = applyPlan({
      ...PLAN,
      content: "run $" + "{CLAUDE_PLUGIN_ROOT}/a",
      rootToken: "$" + "{PLUGIN_ROOT}",
      script: (text) => `${text}!`,
    });
    expect(out.content).toBe("run $" + "{PLUGIN_ROOT}/a!");
  });

  it("names a skill entry after its folder when the layout asks", () => {
    const out = applyPlan({
      ...PLAN,
      content: "---\nname: old\n---\nbody",
      namedAfterFolder: true,
    });
    expect(out.content).toContain("name: 'a'");
  });
});
