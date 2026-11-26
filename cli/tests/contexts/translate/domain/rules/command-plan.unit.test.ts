import { describe, expect, it } from "vitest";
import {
  flatCommandPlan,
  installedCommandPlan,
  prefixCommandName,
} from "../../../../../src/contexts/translate/domain/rules/command-plan.js";
import {
  applyPlan,
  type ComponentPlan,
} from "../../../../../src/contexts/translate/domain/rules/component-pipeline.js";
import { CLAUDE_ROOT_TOKEN } from "../../testing/engine-kit.builder.js";
import { kilo, opencode } from "../../testing/registered-profiles.builder.js";

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
      { ...file, content: `---\nname: run\n---\n@${CLAUDE_ROOT_TOKEN}/skills/x.md\n` },
      { ...at, target: (rel) => `.tool/placed/${rel}` }
    );

    expect(written(plan)).toBe(
      "---\nname: 'tool-craft:run'\n---\n[x.md](../../placed/skills/x.md)\n"
    );
  });
});

describe("a command as a tool's install places it", () => {
  const file = {
    relativePath: "commands/04_code/run.md",
    content: "---\nname: run\n---\nSee .TOOL/commands/04_code/run.md\n",
  };
  const written = (tool: typeof kilo | typeof opencode, root: string): string =>
    applyPlan(
      installedCommandPlan(
        { ...file, content: file.content.replace(".TOOL", root) },
        { tool, pluginName: "craft" },
        "aidd-"
      )
    ).content;

  it("writes a link in the tool's own syntax when its build carries no commands", () => {
    expect(written(kilo, ".kilo")).toContain("See .kilo/commands/aidd/04/run.md");
  });

  it("writes a link as its build does when its build carries commands", () => {
    expect(written(opencode, ".opencode")).toContain("See .opencode/commands/04_code/run.md");
  });
});
