// OpenCode uses Mode B with `mode: "flat"` and project scope, so `translateFlat` writes at
// section-specific native paths, never under one `.opencode/plugins/<name>/` root.
import { describe, expect, it } from "vitest";
import { ModeBFlatMaterializationTranslator } from "../../../../../src/contexts/installation/application/materialize/mode-b-flat-materialization-translator.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { translateDistribution } from "../../testing/fake-build-sources.fake.js";

const PROJECT_ROOT = "/test-project";
const STUB_HOME = "/tmp/test-home";

function buildDist(name = "aidd-context"): PluginDistribution {
  return new PluginDistribution({
    manifest: { name, version: "1.0.0" },
    format: TOOL.claude,
    files: [
      {
        relativePath: "commands/hello.md",
        content: "---\nname: aidd:01:hello\n---\n# Hello",
      },
      { relativePath: "agents/coach.md", content: "---\nname: coach\n---\n# Coach" },
    ],
    components: {
      commands: [
        {
          relativePath: "commands/hello.md",
          content: "---\nname: aidd:01:hello\n---\n# Hello",
        },
      ],
      agents: [{ relativePath: "agents/coach.md", content: "---\nname: coach\n---\n# Coach" }],
      rules: [],
      skills: [],
      hooks: [],
      mcp: [],
    },
  });
}

describe("install opencode plugin via Mode B (integration)", () => {
  it("materializes project commands and namespaced native agents", async () => {
    const fs = new InMemoryFileAdapter();
    const adapter = new ModeBFlatMaterializationTranslator(
      fs,
      () => STUB_HOME,
      translateDistribution
    );
    const manifest = Manifest.create();
    manifest.addTool(TOOL.opencode, "test", []);

    await adapter.addPlugin({
      dist: buildDist(),
      tool: registeredTools().aiProfile(TOOL.opencode),
      source: { kind: "local", path: "/plugin-source" },
      projectRoot: PROJECT_ROOT,
      manifest,
      marketplace: undefined,
    });

    const written = fs.listAll();
    expect(
      written.some((p) => p.startsWith(`${PROJECT_ROOT}/.opencode/commands/aidd-context/`))
    ).toBe(true);
    expect(written).toContain(`${PROJECT_ROOT}/.opencode/agents/aidd-context-coach.md`);
  });

  it("does not write any file under user home for project-scope flat tools", async () => {
    const fs = new InMemoryFileAdapter();
    const adapter = new ModeBFlatMaterializationTranslator(
      fs,
      () => STUB_HOME,
      translateDistribution
    );
    const manifest = Manifest.create();
    manifest.addTool(TOOL.opencode, "test", []);

    await adapter.addPlugin({
      dist: buildDist(),
      tool: registeredTools().aiProfile(TOOL.opencode),
      source: { kind: "local", path: "/plugin-source" },
      projectRoot: PROJECT_ROOT,
      manifest,
      marketplace: undefined,
    });

    expect(fs.listAll().every((p) => !p.startsWith(STUB_HOME))).toBe(true);
  });

  it("registers plugin in manifest with files map keyed by relative path", async () => {
    const fs = new InMemoryFileAdapter();
    const adapter = new ModeBFlatMaterializationTranslator(
      fs,
      () => STUB_HOME,
      translateDistribution
    );
    const manifest = Manifest.create();
    manifest.addTool(TOOL.opencode, "test", []);

    await adapter.addPlugin({
      dist: buildDist(),
      tool: registeredTools().aiProfile(TOOL.opencode),
      source: { kind: "local", path: "/plugin-source" },
      projectRoot: PROJECT_ROOT,
      manifest,
      marketplace: undefined,
    });

    const installed = manifest.getPlugins(TOOL.opencode).find((p) => p.name === "aidd-context");
    expect(installed).toBeDefined();
    expect(installed?.files.size).toBeGreaterThan(0);
  });
});
