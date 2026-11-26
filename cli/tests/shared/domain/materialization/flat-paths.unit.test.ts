import { describe, expect, it } from "vitest";
import {
  belowSection,
  flatAgentFilePath,
  flatArtifactLayout,
  flatHooksPathWithLoaderEntry,
  flatMcpKeyPrefix,
  flatRulesPlacement,
  flatSectionPath,
  flatSkillPath,
  genericFlatHooksFile,
  genericFlatHooksScriptPath,
  ownsFlatArtifact,
  rulesGlobOf,
  statesRuleScope,
} from "../../../../src/shared/domain/materialization/flat-paths.js";

const nested = flatArtifactLayout(".opencode/", { skills: "nested", agent: { ext: ".md" } });
const single = flatArtifactLayout(".agents/", {
  skills: "single-level",
  agent: { folderFile: "agent.md" },
});

describe("a flat artifact layout", () => {
  it("places a skill under its plugin, or prefixed with it on a single-level scan", () => {
    expect([
      flatSkillPath(nested, "aidd-dev", "skills/commit/SKILL.md"),
      flatSkillPath(single, "aidd-dev", "commit/SKILL.md"),
    ]).toStrictEqual([
      ".opencode/skills/aidd-dev/commit/SKILL.md",
      ".agents/skills/aidd-dev-commit/SKILL.md",
    ]);
  });

  it("keeps a non-skill top-level child's own name under a nested plugin", () => {
    expect(flatSkillPath(nested, "aidd-telemetry", "shared/attribution.cjs")).toBe(
      ".opencode/skills/aidd-telemetry/shared/attribution.cjs"
    );
  });

  it("names an agent after its plugin and its file, in a file or in a folder", () => {
    expect([
      flatAgentFilePath(nested, "aidd-dev", "agents/executor.md"),
      flatAgentFilePath(single, "aidd-dev", "executor.md"),
      flatAgentFilePath(
        flatArtifactLayout(".github/", { skills: "single-level", agent: { ext: ".agent.md" } }),
        "aidd-dev",
        "executor.md"
      ),
    ]).toStrictEqual([
      ".opencode/agents/aidd-dev-executor.md",
      ".agents/agents/aidd-dev-executor/agent.md",
      ".github/agents/aidd-dev-executor.agent.md",
    ]);
  });

  it.each([nested, single])("owns what it places, whichever the layout", (layout) => {
    const placed = [
      flatSkillPath(layout, "aidd", "plan/SKILL.md"),
      flatAgentFilePath(layout, "aidd", "a.md"),
    ];
    expect(placed.map((path) => ownsFlatArtifact(layout, path, "aidd"))).toStrictEqual([
      true,
      true,
    ]);
  });

  it("does not own a sibling plugin's nested skill whose name starts with its own", () => {
    expect([
      ownsFlatArtifact(nested, flatSkillPath(nested, "aidd-x", "plan/SKILL.md"), "aidd"),
      ownsFlatArtifact(nested, flatSkillPath(nested, "aidd", "plan/SKILL.md"), "aidd-x"),
    ]).toStrictEqual([false, false]);
  });

  it("does not own an artifact whose file name merely begins with the plugin name", () => {
    expect([
      ownsFlatArtifact(single, ".agents/skills/aiddx-plan/SKILL.md", "aidd"),
      ownsFlatArtifact(single, ".agents/agents/aiddx-a/agent.md", "aidd"),
      ownsFlatArtifact(nested, ".opencode/agents/aiddx-a.md", "aidd"),
    ]).toStrictEqual([false, false, false]);
  });
});

describe("a rule at the top of a flat layout's rules folder", () => {
  const topLevel = flatArtifactLayout(".kilo/", {
    skills: "nested",
    rules: "top-level-no-frontmatter",
    agent: { ext: ".md" },
  });

  it("is owned by the plugin whose name prefixes it, and only by it", () => {
    expect([
      ownsFlatArtifact(topLevel, ".kilo/rules/aidd-dev-01-a.md", "aidd-dev"),
      ownsFlatArtifact(topLevel, ".kilo/rules/aidd-dev-01-a.md", "aidd-pm"),
      ownsFlatArtifact(nested, ".opencode/rules/aidd-dev/01-a.md", "aidd-dev"),
    ]).toStrictEqual([true, false, false]);
  });

  it("is listed by a glob only when a written path holds one", () => {
    const placement = { prefix: ".kilo/rules/aidd-dev-", glob: ".kilo/rules/aidd-dev-*.md" };

    expect([
      rulesGlobOf(placement, [".kilo/agents/aidd-dev-a.md", ".kilo/rules/aidd-dev-01-a.md"]),
      rulesGlobOf(placement, [".kilo/rules/aidd-pm-01-a.md"]),
      rulesGlobOf(null, [".kilo/rules/aidd-dev-01-a.md"]),
    ]).toStrictEqual([placement.glob, null, null]);
  });
});

describe("a rule at the top of a rules folder a layout names", () => {
  const steering = flatArtifactLayout(".kiro/", {
    skills: "single-level",
    rules: "top-level",
    rulesDir: ".kiro/steering/",
    agent: { ext: ".md" },
  });

  it("lands there, named by its plugin and its group, and is owned by that plugin alone", () => {
    expect([
      flatSectionPath(steering, "rules", { plugin: "aidd-dev", name: "01-a/b.md" }),
      ownsFlatArtifact(steering, ".kiro/steering/aidd-dev-01-a-b.md", "aidd-dev"),
      ownsFlatArtifact(steering, ".kiro/steering/aidd-dev-01-a-b.md", "aidd-pm"),
      flatRulesPlacement(steering, "aidd-dev")?.glob,
    ]).toStrictEqual([
      ".kiro/steering/aidd-dev-01-a-b.md",
      true,
      false,
      ".kiro/steering/aidd-dev-*.md",
    ]);
  });
});

describe("locating a plugin's flat hooks file", () => {
  it("returns per-plugin hooks file path", () => {
    expect(genericFlatHooksFile(".github/hooks/", "aidd-dev")).toBe(
      ".github/hooks/aidd-dev.hooks.json"
    );
  });

  it("uses the full plugin name", () => {
    expect(genericFlatHooksFile(".github/hooks/", "my-awesome-plugin")).toBe(
      ".github/hooks/my-awesome-plugin.hooks.json"
    );
  });

  it("works with different prefixes", () => {
    expect(genericFlatHooksFile(".claude/hooks/", "aidd-dev")).toBe(
      ".claude/hooks/aidd-dev.hooks.json"
    );
  });
});

describe("locating a plugin's flat hook script", () => {
  it("returns per-plugin script path under hooks/plugin/", () => {
    expect(genericFlatHooksScriptPath(".github/hooks/", "aidd-dev", "check.sh")).toBe(
      ".github/hooks/aidd-dev/check.sh"
    );
  });

  it("works with different prefixes", () => {
    expect(genericFlatHooksScriptPath(".cursor/hooks/", "aidd-dev", "check.sh")).toBe(
      ".cursor/hooks/aidd-dev/check.sh"
    );
  });
});

describe("placing a hook script beside a loader entry", () => {
  it("namespaces a plain hook script under <perPluginHooksDir>/<plugin>/", () => {
    expect(
      flatHooksPathWithLoaderEntry({
        perPluginHooksDir: ".opencode/hooks/",
        loaderEntry: null,
        plugin: "aidd-context",
        hooksRelativePath: "hooks/update_memory.js",
      })
    ).toBe(".opencode/hooks/aidd-context/update_memory.js");
  });

  it("routes a script matching the loader entry's name flat, renamed to the plugin", () => {
    const loaderEntry = { dir: ".opencode/plugin/", baseName: "opencode-plugin.js" };
    expect(
      flatHooksPathWithLoaderEntry({
        perPluginHooksDir: ".opencode/hooks/",
        loaderEntry,
        plugin: "aidd-telemetry",
        hooksRelativePath: "hooks/opencode-plugin.js",
      })
    ).toBe(".opencode/plugin/aidd-telemetry.js");
  });

  it("does not match the loader entry's name for a nested script of the same basename", () => {
    // "hooks/lib/opencode-plugin.js" is not "hooks/opencode-plugin.js": the exception
    // matches the top-level script only, not anything sharing its leaf name deeper down.
    const loaderEntry = { dir: ".opencode/plugin/", baseName: "opencode-plugin.js" };
    expect(
      flatHooksPathWithLoaderEntry({
        perPluginHooksDir: ".opencode/hooks/",
        loaderEntry,
        plugin: "aidd-telemetry",
        hooksRelativePath: "hooks/lib/opencode-plugin.js",
      })
    ).toBe(".opencode/hooks/aidd-telemetry/lib/opencode-plugin.js");
  });

  it("falls back to full namespacing when no loader entry is declared", () => {
    expect(
      flatHooksPathWithLoaderEntry({
        perPluginHooksDir: ".codex/hooks/",
        loaderEntry: null,
        plugin: "aidd-dev",
        hooksRelativePath: "hooks/check.sh",
      })
    ).toBe(".codex/hooks/aidd-dev/check.sh");
  });

  it("keeps two plugins' same-named hook script from colliding", () => {
    const a = flatHooksPathWithLoaderEntry({
      perPluginHooksDir: ".opencode/hooks/",
      loaderEntry: null,
      plugin: "plugin-a",
      hooksRelativePath: "hooks/x.js",
    });
    const b = flatHooksPathWithLoaderEntry({
      perPluginHooksDir: ".opencode/hooks/",
      loaderEntry: null,
      plugin: "plugin-b",
      hooksRelativePath: "hooks/x.js",
    });
    expect(a).not.toBe(b);
  });

  it("strips only a leading hooks/ segment, never one deeper in the path", () => {
    expect(
      flatHooksPathWithLoaderEntry({
        perPluginHooksDir: ".opencode/hooks/",
        loaderEntry: null,
        plugin: "aidd-dev",
        hooksRelativePath: "scripts/hooks/x.js",
      })
    ).toBe(".opencode/hooks/aidd-dev/scripts/hooks/x.js");
  });
});

describe("prefixing a plugin's MCP keys", () => {
  it("returns plugin name with trailing dash", () => {
    expect(flatMcpKeyPrefix("aidd-dev")).toBe("aidd-dev-");
  });

  it("uses the full plugin name", () => {
    expect(flatMcpKeyPrefix("my-awesome-plugin")).toBe("my-awesome-plugin-");
  });
});

describe("the name a section file carries", () => {
  it("is its path below the section, the path itself when it sits outside", () => {
    expect([belowSection("rules", "rules/a/b.md"), belowSection("rules", "a/b.md")]).toStrictEqual([
      "a/b.md",
      "a/b.md",
    ]);
  });
});

describe("a layout that states a rule's scope", () => {
  it("is the one whose tool reads no frontmatter", () => {
    const flat = flatArtifactLayout(".k/", {
      skills: "nested",
      agent: { ext: ".md" },
      rules: "top-level-no-frontmatter",
    });

    expect([statesRuleScope(flat), statesRuleScope(nested)]).toStrictEqual([true, false]);
  });
});
