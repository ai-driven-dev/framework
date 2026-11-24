import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createOutput } from "../../../../../src/composition/shared.js";
import { placeFlatPlugin } from "../../../../../src/contexts/installation/application/materialize/place-flat-plugin.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { parsePluginName } from "../../../../../src/shared/domain/plugin/plugin-name.js";
import { asPlainObject } from "../../../../../src/shared/domain/reading/plain-object.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { fakeFlatDeps } from "../../testing/fake-build-sources.fake.js";
import { pluginRemover } from "../../testing/plugin-remover.builder.js";

const PROJECT_ROOT = "/test-project";
const CONFIG = join(PROJECT_ROOT, ".kilo/kilo.jsonc");
const RULE = join(PROJECT_ROOT, ".kilo/rules/aidd-craft-01-standards-1-naming.md");
const SCOPED_RULE = join(PROJECT_ROOT, ".kilo/rules/aidd-craft-01-standards-2-ts.md");
const GLOB = ".kilo/rules/aidd-craft-*.md";

const UNSCOPED = { relativePath: "rules/01-standards/1-naming.md", content: "# Naming\n" };
const SCOPED = {
  relativePath: "rules/01-standards/2-ts.md",
  content: '---\npaths:\n  - "**/*.ts"\n---\n# TypeScript\n',
};

function craft(rules: (typeof UNSCOPED)[]): PluginDistribution {
  return new PluginDistribution({
    manifest: { name: parsePluginName("aidd-craft"), version: "1.0.0" },
    format: TOOL.claude,
    files: rules,
    components: { commands: [], agents: [], rules, skills: [], hooks: [], mcp: [] },
  });
}

async function install(rules: (typeof UNSCOPED)[], config?: string) {
  const fs = new InMemoryFileAdapter(config === undefined ? {} : { [CONFIG]: config }, [
    PROJECT_ROOT,
  ]);
  const manifest = Manifest.create();
  manifest.addTool(TOOL.kilo, "test", []);
  await placeFlatPlugin(
    {
      dist: craft(rules),
      tool: registeredTools().aiProfile(TOOL.kilo),
      source: { kind: "local", path: "/plugin-source" },
      projectRoot: PROJECT_ROOT,
      manifest,
      marketplace: undefined,
    },
    fakeFlatDeps(fs, () => "/stub-home")
  );
  const manifestRepo = new InMemoryManifestRepository(manifest);
  await manifestRepo.save(manifest);
  const remove = () =>
    pluginRemover({ fs, manifestRepo, logger: createOutput(false) }).execute({
      pluginName: "aidd-craft",
      toolIds: [TOOL.kilo],
      projectRoot: PROJECT_ROOT,
    });
  return { fs, manifest, remove };
}

const instructionsIn = (fs: InMemoryFileAdapter): unknown =>
  asPlainObject(JSON.parse(fs.getFile(CONFIG) ?? "{}"))?.instructions;

describe("a kilo plugin's rules, installed from a local path", () => {
  it("lists the installed rules in the config, beside the user's own entries", async () => {
    const { fs } = await install(
      [UNSCOPED, SCOPED],
      JSON.stringify({ instructions: ["docs/team.md"] })
    );

    expect(instructionsIn(fs)).toEqual(["docs/team.md", GLOB]);
    expect(fs.has(RULE)).toBe(true);
    expect(fs.getFile(SCOPED_RULE)).toContain("Applies to files matching `**/*.ts`.");
  });

  it("lists the glob when every rule is path-scoped", async () => {
    const { fs } = await install([SCOPED]);

    expect(instructionsIn(fs)).toEqual([GLOB]);
  });

  it("lists nothing for a plugin that places no rule", async () => {
    const { fs } = await install([]);

    expect(fs.has(CONFIG)).toBe(false);
  });

  it("takes the rule files and the listing back out on removal, keeping the user's entries", async () => {
    const { fs, remove } = await install(
      [UNSCOPED, SCOPED],
      JSON.stringify({ instructions: ["docs/team.md"] })
    );

    await remove();

    expect(fs.has(RULE)).toBe(false);
    expect(fs.has(SCOPED_RULE)).toBe(false);
    expect(instructionsIn(fs)).toEqual(["docs/team.md"]);
  });
});
