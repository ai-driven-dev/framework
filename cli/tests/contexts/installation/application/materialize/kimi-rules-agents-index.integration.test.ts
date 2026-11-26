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
const AGENTS = join(PROJECT_ROOT, "AGENTS.md");
const RULE = join(PROJECT_ROOT, ".kimi-code/instructions/aidd-craft-01-standards-1-naming.md");
const SCOPED_RULE = join(PROJECT_ROOT, ".kimi-code/instructions/aidd-craft-01-standards-2-ts.md");
const GLOB = ".kimi-code/instructions/aidd-craft-*.md";
const PERSON = "# Team notes\n\nKept as written.\n";

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

async function install(rules: (typeof UNSCOPED)[], agents?: string) {
  const fs = new InMemoryFileAdapter(agents === undefined ? {} : { [AGENTS]: agents }, [
    PROJECT_ROOT,
  ]);
  const manifest = Manifest.create();
  manifest.addTool(TOOL.kimi, "test", []);
  const place = (shipped: (typeof UNSCOPED)[]) =>
    placeFlatPlugin(
      {
        dist: craft(shipped),
        tool: registeredTools().aiProfile(TOOL.kimi),
        source: { kind: "local", path: "/plugin-source" },
        projectRoot: PROJECT_ROOT,
        manifest,
        marketplace: undefined,
      },
      fakeFlatDeps(fs, () => "/stub-home")
    );
  await place(rules);
  const manifestRepo = new InMemoryManifestRepository(manifest);
  await manifestRepo.save(manifest);
  const remove = () =>
    pluginRemover({ fs, manifestRepo, logger: createOutput(false) }).execute({
      pluginName: "aidd-craft",
      toolIds: [TOOL.kimi],
      projectRoot: PROJECT_ROOT,
    });
  return { fs, manifest, remove, place };
}

describe("a kimi plugin's rules, installed from a local path", () => {
  it("lists the placed rules in AGENTS.md, after what the team wrote there", async () => {
    const { fs } = await install([UNSCOPED, SCOPED], PERSON);

    expect(fs.getFile(AGENTS)).toContain(`${PERSON}\n<!-- aidd_plugin_rules:start -->`);
    expect(fs.getFile(AGENTS)).toContain(`- \`${GLOB}\``);
    expect(fs.has(RULE)).toBe(true);
    expect(fs.getFile(SCOPED_RULE)).toContain("Applies to files matching `**/*.ts`.");
  });

  it("creates AGENTS.md when the project has none", async () => {
    const { fs } = await install([SCOPED]);

    expect(fs.getFile(AGENTS)).toContain(`- \`${GLOB}\``);
  });

  it("writes no AGENTS.md for a plugin that places no rule", async () => {
    const { fs } = await install([]);

    expect(fs.has(AGENTS)).toBe(false);
  });

  it("takes the rules' files and their listing back out, and the team's text stays", async () => {
    const { fs, manifest, remove } = await install([UNSCOPED, SCOPED], PERSON);
    const tracked = () => manifest.getPlugins(TOOL.kimi).flatMap((p) => [...p.files.keys()]);

    expect(tracked().sort()).toEqual([
      ".kimi-code/instructions/aidd-craft-01-standards-1-naming.md",
      ".kimi-code/instructions/aidd-craft-01-standards-2-ts.md",
    ]);

    await remove();

    expect(tracked()).toEqual([]);
    expect(fs.has(RULE)).toBe(false);
    expect(fs.getFile(AGENTS)).toBe(PERSON);
  });

  it("takes the listing out when an update ships no rule, and the team's text stays", async () => {
    const { fs, place } = await install([UNSCOPED], PERSON);

    await place([]);

    expect(fs.getFile(AGENTS)).toBe(PERSON);
  });

  it("refuses to rewrite an AGENTS.md that points outside the project", async () => {
    const { fs, remove } = await install([UNSCOPED], PERSON);
    const foreign = "/foreign/AGENTS.md";
    const foreignText = fs.getFile(AGENTS) ?? "";
    await fs.writeFile(foreign, foreignText);
    fs.setSymlink(AGENTS, foreign);

    await expect(remove()).rejects.toThrow(/outside.*project|escapes.*project/);

    expect(fs.getFile(foreign)).toBe(foreignText);
  });

  it("takes AGENTS.md away with the listing when the plugin was what created it", async () => {
    const { fs, remove } = await install([SCOPED]);

    await remove();

    expect(fs.has(AGENTS)).toBe(false);
  });
});
