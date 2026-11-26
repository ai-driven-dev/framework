import { describe, expect, it } from "vitest";
import {
  flatCommandPlan,
  prefixCommandName,
} from "../../../../../src/contexts/translate/domain/rules/command-plan.js";
import {
  applyPlan,
  type ComponentPlan,
} from "../../../../../src/contexts/translate/domain/rules/component-pipeline.js";

const PLUGIN_ROOT = "$" + "{CLAUDE_PLUGIN_ROOT}";
const AT = { prefix: "tool-", pluginName: "craft" };

describe("the name a flat command carries", () => {
  it.each([
    ["aidd:04:implement", "implement"],
    ["other:implement", "implement"],
    ["implement", "implement"],
  ])("reads %s as %s, named by its plugin", (shipped, simple) => {
    const content = `---\nname: ${shipped}\ndescription: D\n---\nBody\n`;

    expect(prefixCommandName(content, { ...AT, source: "commands/04_code/run.md" })).toContain(
      `name: 'tool-craft:${simple}'`
    );
  });
});

describe("a flat command's plan", () => {
  const file = { relativePath: "commands/run.md", content: "---\nname: run\n---\nSee @./a.md\n" };
  const at = {
    plugin: "craft",
    path: ".tool/commands/craft/run.md",
    prefix: "tool-",
    linkSyntax: [{ from: /See/g, to: "Read" }],
  };
  const written = (plan: ComponentPlan): string => applyPlan(plan).content;

  it("is placed where it is told, named after its plugin and written in the tool's link syntax", () => {
    const plan = flatCommandPlan(file, at);

    expect([plan.path, written(plan)]).toEqual([
      ".tool/commands/craft/run.md",
      "---\nname: 'tool-craft:run'\n---\nRead @./a.md\n",
    ]);
  });

  it("also writes a link to a plugin file where that file lands, when told where", () => {
    const plan = flatCommandPlan(
      { ...file, content: `---\nname: run\n---\n@${PLUGIN_ROOT}/skills/x.md\n` },
      { ...at, target: (rel) => `.tool/placed/${rel}` }
    );

    expect(written(plan)).toBe(
      "---\nname: 'tool-craft:run'\n---\n[x.md](../../placed/skills/x.md)\n"
    );
  });
});
