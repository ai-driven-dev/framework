import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createOutput } from "../../../../../src/composition/shared.js";
import { placeFlatPlugin } from "../../../../../src/contexts/installation/application/materialize/place-flat-plugin.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { parsePluginName } from "../../../../../src/shared/domain/plugin/plugin-name.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { fakeFlatDeps } from "../../testing/fake-build-sources.fake.js";
import { pluginRemover } from "../../testing/plugin-remover.builder.js";

const PROJECT_ROOT = "/test-project";
const CONFIG = join(PROJECT_ROOT, ".kilo/kilo.jsonc");
const COMMENTED =
  '{\n  // keep me\n  "instructions": ["docs/team.md"], /* and me */\n  "theme": "dark"\n}\n';

const DIST = new PluginDistribution({
  manifest: { name: parsePluginName("aidd-craft"), version: "1.0.0" },
  format: TOOL.claude,
  files: [{ relativePath: "rules/1-naming.md", content: "# Naming\n" }],
  components: {
    commands: [],
    agents: [],
    rules: [{ relativePath: "rules/1-naming.md", content: "# Naming\n" }],
    skills: [],
    hooks: [],
    mcp: [],
  },
});

describe("a kilo config a person commented", () => {
  it("keeps its comments when an install lists the rules and when a removal takes them out", async () => {
    const fs = new InMemoryFileAdapter({ [CONFIG]: COMMENTED }, [PROJECT_ROOT]);
    const manifest = Manifest.create();
    manifest.addTool(TOOL.kilo, "test", []);
    await placeFlatPlugin(
      {
        dist: DIST,
        tool: registeredTools().aiProfile(TOOL.kilo),
        source: { kind: "local", path: "/plugin-source" },
        projectRoot: PROJECT_ROOT,
        manifest,
        marketplace: undefined,
      },
      fakeFlatDeps(fs, () => "/stub-home")
    );
    const installed = fs.getFile(CONFIG) ?? "";
    const manifestRepo = new InMemoryManifestRepository(manifest);
    await manifestRepo.save(manifest);
    await pluginRemover({ fs, manifestRepo, logger: createOutput(false) }).execute({
      pluginName: "aidd-craft",
      toolIds: [TOOL.kilo],
      projectRoot: PROJECT_ROOT,
    });

    expect(installed).toContain("// keep me");
    expect(installed).toContain("/* and me */");
    expect(installed).toContain(".kilo/rules/aidd-craft-*.md");
    const removed = fs.getFile(CONFIG) ?? "";
    expect(removed).toContain("// keep me");
    expect(removed).toContain("/* and me */");
    expect(removed).toContain("docs/team.md");
    expect(removed).not.toContain("aidd-craft");
  });

  it("keeps its comments when a plugin's servers are merged in and taken out", () => {
    const kilo = registeredTools().aiProfile(TOOL.kilo).flatPluginMcp();
    const servers = JSON.stringify({ mcp: { docs: { type: "local", command: ["docs"] } } });

    const merged = kilo?.mergePluginServers(COMMENTED, servers, new Map());
    const removed = kilo?.removePluginServers(
      merged?.mergedContent ?? "",
      merged?.contributedEntries ?? new Map()
    );

    expect(merged?.mergedContent).toContain("// keep me");
    expect(merged?.mergedContent).toContain('"docs"');
    expect(removed).toContain("// keep me");
    expect(removed).not.toContain('"docs"');
  });
});
