import { join, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { AiToolProfile } from "../../../../src/contexts/tools/contract/tool-profile.js";
import { FlatBuildStrategy } from "../../../../src/contexts/translate/application/strategies/flat-build-strategy.js";
import { MarketplaceBuildStrategy } from "../../../../src/contexts/translate/application/strategies/marketplace-build-strategy.js";
import { FrameworkBuildUseCase } from "../../../../src/contexts/translate/application/translate-source.js";
import { parseFrontmatter } from "../../../../src/shared/domain/markdown.js";
import { PluginDistribution } from "../../../../src/shared/domain/plugin/plugin-distribution.js";
import { CapturingLogger } from "../../../helpers/ports/capturing-logger.js";
import { InMemoryFileAdapter } from "../../../helpers/ports/in-memory-file-adapter.js";
import { seedFromDirectory } from "../../../helpers/ports/seed-from-directory.js";
import { catalogOf, TOOL } from "../../tools/testing/catalog-of.js";
import { nativeOf } from "../../tools/testing/plugin-mode.js";
import { translator } from "../testing/plugin-content-translator-kit.js";

const SOURCE = resolve(process.cwd(), "tests/fixtures/framework-real");
const OUT = resolve("/tmp/aidd-conformance-out").replaceAll("\\", "/");
const PLUGINS = [
  "aidd-vcs",
  "aidd-dev",
  "aidd-context",
  "aidd-pm",
  "aidd-refine",
  "aidd-async-dev",
];

type Doc = { frontmatter: Record<string, unknown>; body: string };
type Divergence = {
  id: string;
  applies: (tool: string, path: string, source: string) => boolean;
  fold?: (doc: Doc) => Doc;
  absentFromA?: true;
};
const noName = (d: Doc): Doc => ({ ...d, frontmatter: { ...d.frontmatter, name: undefined } });

/** What path B (install) writes differently from path A (disk), named. Markdown is compared as
 * frontmatter data plus body, since B re-serializes the frontmatter. The list only shrinks: an
 * entry nothing needs fails the test, and a difference no entry names fails it too. */
const DIVERGENCES: readonly Divergence[] = [
  {
    id: "A rewrites an @relative reference into a markdown link",
    applies: () => true,
    fold: (d) => ({ ...d, body: d.body.replace(/\[[^\]]+\]\((\.\.?\/[^)]+)\)/g, "@$1") }),
  },
  { id: "A namespaces an agent's name", applies: (_t, p) => p.includes("agents/"), fold: noName },
  {
    id: "A renames a flat skill after its folder",
    applies: (t, p) => ["opencode", "kilo"].includes(t) && p.endsWith("SKILL.md"),
    fold: noName,
  },
  {
    id: "B keeps only a codex skill's name and description",
    applies: (t, p) => t === "codex" && p.includes("/skills/"),
    fold: ({ frontmatter: { name, description }, body }) => ({
      frontmatter: { name, description },
      body,
    }),
  },
  {
    id: "A leaves the {{TOOLS}} placeholder, B resolves it to .github/",
    applies: (t, _p, source) => t === "copilot" && source.includes("{{TOOLS}}"),
    fold: (d) => ({ ...d, body: d.body.replaceAll(".github/", "{{TOOLS}}/") }),
  },
  {
    id: "B copies the source manifest and mcp, A synthesizes them elsewhere",
    applies: (_t, p) => /(^|\/)(plugin|mcp|hooks)\.json$|\.agent\.md$|\.toml$/.test(p),
    absentFromA: true,
  },
];

const folded = (content: string, list: readonly Divergence[]): string =>
  JSON.stringify(list.reduce((doc, d) => d.fold?.(doc) ?? doc, parseFrontmatter(content)));

/** Path A: the strategy writing a tree, as `aidd translate` does, read back. */
async function writtenByA(tree: InMemoryFileAdapter, tool: AiToolProfile, native: boolean) {
  const fs = new InMemoryFileAdapter();
  for (const path of tree.listAll()) fs.setFile(path, tree.getFile(path) as string);
  const assets = { loadConfigAsset: () => "{}", loadSchema: () => ({}) };
  const validator = { validate() {} };
  const mode = native ? "marketplace" : "flat";
  const contract = tool.buildContract(mode);
  if (contract === null) throw new Error(`no ${mode} contract for ${tool.toolId}`);
  const strategy = native
    ? new MarketplaceBuildStrategy(fs, validator, assets, contract)
    : new FlatBuildStrategy(fs, assets, contract, false, OUT, async () => true);
  await fs.createDirectory(OUT);
  const build = new FrameworkBuildUseCase(fs, validator, assets, new CapturingLogger(), strategy);
  await build.execute({ sourceDir: SOURCE, outDir: OUT, target: tool.toolId, mode });
  return new Map(fs.listUnder(OUT).map((p) => [p.replaceAll("\\", "/"), fs.getFile(p) as string]));
}

function distributionOf(tree: InMemoryFileAdapter, name: string): PluginDistribution {
  const root = join(SOURCE, "plugins", name);
  const files = tree.listUnder(root).map((path) => ({
    relativePath: path.slice(root.length + 1).replaceAll("\\", "/"),
    content: tree.getFile(path) as string,
  }));
  const under = (dir: string) => files.filter((f) => f.relativePath.startsWith(`${dir}/`));
  const components = {
    commands: under("commands"),
    agents: under("agents"),
    skills: under("skills"),
    rules: under("rules"),
    hooks: under("hooks"),
    mcp: files.filter((f) => f.relativePath === ".mcp.json"),
  };
  return new PluginDistribution({
    manifest: { name, version: "1.0.0" },
    format: TOOL.claude,
    files,
    components,
  });
}

describe("path B (install) writes what path A (disk) writes, but for what DIVERGENCES names", () => {
  const used = new Set<string>();
  let tree: InMemoryFileAdapter;
  beforeAll(async () => {
    tree = new InMemoryFileAdapter();
    await seedFromDirectory(tree, SOURCE, { useAbsolutePaths: true });
  });

  it.each(catalogOf().idsInCanonicalOrder("ai"))("%s", async (id) => {
    const tool = catalogOf().aiProfile(id);
    const plugins = tool.plugins();
    if (plugins === null) return;
    const native = plugins.kind === "native";
    const written = await writtenByA(tree, tool, native);
    const unexplained: string[] = [];
    let agreed = 0;
    for (const name of PLUGINS) {
      const root = native ? nativeOf(plugins).pluginOutputDir(name) : "";
      for (const file of translator.translate(distributionOf(tree, name), tool)) {
        const rest = file.relativePath.slice(root.length);
        const onA = written.get(native ? `${OUT}/plugins/${name}/${rest}` : `${OUT}/${rest}`);
        const named = DIVERGENCES.filter((d) => d.applies(id, file.relativePath, onA ?? ""));
        const explained = (list: readonly Divergence[]) =>
          onA === undefined
            ? list.some((d) => d.absentFromA)
            : onA === file.content ||
              (file.relativePath.endsWith(".md") &&
                folded(onA, list) === folded(file.content, list));
        if (!explained(named)) unexplained.push(`${id}: ${file.relativePath}`);
        else if (onA !== undefined) agreed++;
        for (const d of named) if (!explained(named.filter((e) => e !== d))) used.add(d.id);
      }
    }
    expect(unexplained).toEqual([]);
    expect(agreed).toBeGreaterThan(100);
  });

  it("every divergence is still needed by some tool", () => {
    expect([...used].sort()).toEqual(DIVERGENCES.map((d) => d.id).sort());
  });
});
