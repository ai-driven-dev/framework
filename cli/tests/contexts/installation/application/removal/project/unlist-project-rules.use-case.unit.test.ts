import { describe, expect, it } from "vitest";
import { AssertProjectPathWithinRoot } from "../../../../../../src/contexts/installation/application/ownership/assert-project-path-within-root.use-case.js";
import { UnlistProjectRules } from "../../../../../../src/contexts/installation/application/removal/project/unlist-project-rules.use-case.js";
import { Manifest } from "../../../../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { InMemoryFileAdapter } from "../../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../../shared/testing/registered-tools.builder.js";

const ROOT = "/project";
const AGENTS = "/project/AGENTS.md";
const plugin = RecordedPlugin.fromMetadata({
  name: "aidd-dev",
  version: "1.0.0",
  source: { kind: "local", path: "/fixture" },
  strict: false,
  scope: "project",
});

function removal(toolId: typeof TOOL.kimi | typeof TOOL.kilo | typeof TOOL.codex) {
  return {
    plugin,
    tool: registeredTools().aiProfile(toolId),
    projectRoot: ROOT,
    manifest: Manifest.create(),
  };
}

function rules(fs: InMemoryFileAdapter) {
  return new UnlistProjectRules(fs, new AssertProjectPathWithinRoot(fs));
}

describe("taking a plugin's rules out of the file its tool reads guidance from", () => {
  it("creates nothing when the project keeps no such file", async () => {
    const fs = new InMemoryFileAdapter({}, [ROOT]);

    await rules(fs).execute(removal(TOOL.kimi));

    expect(fs.has(AGENTS)).toBe(false);
  });

  it("leaves a file alone for a tool that lists its rules in its config instead", async () => {
    const text =
      "<!-- aidd_plugin_rules:start -->\n- `.kilo/rules/aidd-dev-*.md`\n<!-- aidd_plugin_rules:end -->\n";
    const fs = new InMemoryFileAdapter({ [AGENTS]: text }, [ROOT]);

    await rules(fs).execute(removal(TOOL.kilo));

    expect(fs.getFile(AGENTS)).toBe(text);
  });

  it("takes a plugin's listing out of the file whichever route placed its rules, the team's text kept", async () => {
    const text =
      "# Team\n\n<!-- aidd_plugin_rules:start -->\n- `.codex/instructions/aidd-dev-*.md`\n<!-- aidd_plugin_rules:end -->\n";
    const fs = new InMemoryFileAdapter({ [AGENTS]: text }, [ROOT]);

    await rules(fs).execute(removal(TOOL.codex));

    expect(fs.getFile(AGENTS)).toBe("# Team\n");
  });
});
