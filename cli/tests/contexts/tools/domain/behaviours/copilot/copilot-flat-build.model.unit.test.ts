import { describe, expect, it } from "vitest";
import { copilot } from "../../../../../../src/composition/tool-profiles/copilot.js";
import { artifactPath } from "../../../../../../src/contexts/tools/contract/artifact-path.js";
import { parseFrontmatter } from "../../../../../../src/shared/domain/markdown.js";
import { builtAgent } from "../../../../../shared/testing/built-agent.builder.js";
import { present } from "../../../../../shared/testing/present.builder.js";
import { supported } from "../../../testing/build-artifacts.builder.js";

// Built, not written literally: biome reads a string holding "${...}" as a lost template.
const ROOT = "$" + "{CLAUDE_PLUGIN_ROOT}";

const AGENT_SOURCE = [
  "---",
  "name: planner",
  "description: Plans the work",
  "model: opus",
  "color: blue",
  "---",
  `Read @${ROOT}/skills/01-plan/SKILL.md`,
  `Ask @${ROOT}/agents/reviewer.md`,
  `Run @${ROOT}/hooks/journal.cjs`,
  "",
].join("\n");

const HOOKS_JSON = JSON.stringify({
  hooks: {
    SessionStart: [{ hooks: [{ type: "command", command: "node journal.cjs", timeout: 30 }] }],
  },
});

describe("building Copilot's flat contract", () => {
  it("lands a plugin's hooks declaration beside the other hooks and its scripts under the plugin's own folder", () => {
    const hooks = supported(present(copilot.buildContracts.flat)().artifacts.hooks);

    expect({
      declaration: artifactPath(hooks, "aidd-dev", "hooks/aidd-dev.hooks.json"),
      script: artifactPath(hooks, "aidd-dev", "hooks/journal.cjs"),
    }).toStrictEqual({
      declaration: ".github/hooks/aidd-dev.hooks.json",
      script: ".github/hooks/aidd-dev/journal.cjs",
    });
  });

  it("flattens a plugin's hooks declaration into the one-entry-per-event shape Copilot reads", () => {
    const hooks = supported(present(copilot.buildContracts.flat)().artifacts.hooks);

    expect(hooks.hooksFile?.at).toStrictEqual({ own: ".github/hooks/" });
    expect(
      hooks.hooksFile?.merge(null, { json: HOOKS_JSON, plugin: "aidd-dev", locate: (path) => path })
        .content
    ).toBe(
      `${JSON.stringify(
        {
          version: 1,
          hooks: {
            SessionStart: [{ type: "command", command: "node journal.cjs", timeout: 30 }],
          },
        },
        null,
        2
      )}\n`
    );
  });

  it("adds a plugin's mcp servers to the workspace .vscode/mcp.json under servers", () => {
    const mcp = supported(present(copilot.buildContracts.flat)().artifacts.mcp);

    expect({
      path: artifactPath(mcp, "aidd-dev", ".mcp.json"),
      mcpServersKey: mcp.mcpServersKey,
    }).toStrictEqual({
      path: ".vscode/mcp.json",
      mcpServersKey: "servers",
    });
  });

  it("renames a skill folder after its plugin, only for a path that starts with skills/", () => {
    const skills = supported(present(copilot.buildContracts.flat)().artifacts.skills);

    expect(artifactPath(skills, "aidd-dev", "skills/01-plan/SKILL.md")).toBe(
      ".github/skills/aidd-dev-01-plan/SKILL.md"
    );
    expect(artifactPath(skills, "aidd-dev", "docs/skills/x.md")).toBe(
      ".github/skills/aidd-dev-docs/skills/x.md"
    );
    expect(skills.rewriteSkillName).toBe(true);
  });

  it("names a flat agent from its path, dropping agents/ only at the start", () => {
    const agents = supported(present(copilot.buildContracts.flat)().artifacts.agents);

    expect(artifactPath(agents, "aidd-dev", "docs/agents/x.md")).toBe(
      ".github/agents/aidd-dev-docs/agents/x.agent.md"
    );
  });

  it("keeps only the fields Copilot reads of a hook entry", () => {
    const hooks = supported(present(copilot.buildContracts.flat)().artifacts.hooks);
    const incoming = JSON.stringify({
      hooks: {
        PostToolUse: [
          {
            matcher: "Write",
            hooks: [{ type: "command", command: "node a.cjs", timeout: 5, extra: 1 }],
          },
        ],
      },
    });

    const written = JSON.parse(
      hooks.hooksFile?.merge(null, { json: incoming, plugin: "aidd-dev", locate: (path) => path })
        .content ?? ""
    );

    expect(written.hooks.PostToolUse).toStrictEqual([
      { type: "command", command: "node a.cjs", matcher: "Write", timeout: 5 },
    ]);
  });

  it("renames a flat agent after its plugin, drops what Copilot cannot read, and points its references at their flat destinations", () => {
    const transform = builtAgent(present(copilot.buildContracts.flat)(), "flat");

    expect(transform?.(AGENT_SOURCE, "aidd-dev", "planner.md")).toBe(
      [
        "---",
        "name: 'aidd-dev-planner'",
        "description: 'Plans the work'",
        "model: 'opus'",
        "include-custom-instructions: true",
        "---",
        "Read [SKILL.md](../skills/aidd-dev-01-plan/SKILL.md)",
        "Ask [reviewer.md](./aidd-dev-reviewer.agent.md)",
        "Run [journal.cjs](../../hooks/journal.cjs)",
        "",
      ].join("\n")
    );
  });

  it("drops only the trailing .md from the name it gives a flat agent", () => {
    const transform = builtAgent(present(copilot.buildContracts.flat)(), "flat");

    expect(
      transform?.("---\ndescription: Helps\n---\nBody.\n", "aidd-dev", "notes.md-helper.md")
    ).toBe(
      "---\nname: 'aidd-dev-notes.md-helper'\ndescription: 'Helps'\ninclude-custom-instructions: true\n---\nBody.\n"
    );
  });

  it.each([true, false])(
    "preserves repository instruction selection %s in flat agents",
    (include) => {
      const transform = builtAgent(present(copilot.buildContracts.flat)(), "flat");
      const result = transform?.(
        `---\nname: reviewer\ninclude-custom-instructions: ${include}\n---\nReview.\n`,
        "aidd-dev",
        "reviewer.md"
      );
      expect(parseFrontmatter(result ?? "").frontmatter["include-custom-instructions"]).toBe(
        include
      );
    }
  );
});
