import { join, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { AiToolProfile } from "../../../../src/contexts/tools/contract/tool-profile.js";
import { parseFrontmatter } from "../../../../src/shared/domain/markdown.js";
import { PluginDistribution } from "../../../../src/shared/domain/plugin/plugin-distribution.js";
import { seedFromDirectory } from "../../../helpers/ports/seed-from-directory.js";
import { CapturingLogger } from "../../../shared/testing/capturing-logger.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.js";
import { nativeOf } from "../../../shared/testing/native-plugin-answers.js";
import { registeredTools, TOOL } from "../../../shared/testing/registered-tools.js";
import { buildTree } from "../testing/build-tree.js";
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
    id: "B copies the source mcp and hooks manifests, A synthesizes them elsewhere",
    applies: (_t, p) => /(^|\/)(mcp|hooks)\.json$|\.agent\.md$|\.toml$/.test(p),
    absentFromA: true,
  },
];

const SOURCES = [
  { name: "claude", format: TOOL.claude, manifest: ".claude-plugin/plugin.json" },
  { name: "cursor", format: TOOL.cursor, manifest: ".cursor-plugin/plugin.json" },
  { name: "codex", format: TOOL.codex, manifest: ".codex-plugin/plugin.json" },
  { name: "copilot", format: TOOL.copilot, manifest: "plugin.json" },
];
/** The plugin manifest, which B copies from the source and A synthesizes, is checked apart. */
const MANIFEST_DIVERGENCES = [
  "B writes the manifest at the plugin root, A in the tool's own manifest directory",
  "A lists the components and drops strict, B copies the source manifest byte for byte",
];
const identity = (json: string) => {
  const { name, version, description, author } = JSON.parse(json);
  return { name, version, description, author };
};

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
  await fs.createDirectory(OUT);
  const build = buildTree(fs, validator, assets, new CapturingLogger(), contract, mode);
  await build.execute({ sourceDir: SOURCE, outDir: OUT, target: tool.toolId, mode });
  return new Map(fs.listUnder(OUT).map((p) => [p.replaceAll("\\", "/"), fs.getFile(p) as string]));
}

function distributionOf(
  tree: InMemoryFileAdapter,
  name: string,
  source = SOURCES[0]
): PluginDistribution {
  const root = join(SOURCE, "plugins", name);
  const files = tree.listUnder(root).map((path) => ({
    relativePath: path.slice(root.length + 1).replaceAll("\\", "/"),
    content: tree.getFile(path) as string,
  }));
  for (const f of files)
    if (f.relativePath === SOURCES[0].manifest) f.relativePath = source.manifest;
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
    format: source.format,
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

  it.each(registeredTools().idsInCanonicalOrder("ai"))("%s", async (id) => {
    const tool = registeredTools().aiProfile(id);
    const plugins = tool.plugins();
    if (plugins === null) return;
    const native = plugins.kind === "native";
    const written = await writtenByA(tree, tool, native);
    const unexplained: string[] = [];
    let agreed = 0;
    for (const name of PLUGINS) {
      const root = native ? nativeOf(plugins).pluginOutputDir(name) : "";
      for (const file of translator.translate(distributionOf(tree, name), tool)) {
        if (file.relativePath.endsWith("/plugin.json")) continue;
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

  const manifestCases = registeredTools()
    .idsInCanonicalOrder("ai")
    .flatMap((id) => SOURCES.map((source) => [id, source.name] as const));
  it.each(manifestCases)("%s installs the manifest of a %s source", async (id, sourceName) => {
    const source = SOURCES.find((s) => s.name === sourceName) ?? SOURCES[0];
    const tool = registeredTools().aiProfile(id);
    const plugins = tool.plugins();
    const dist = distributionOf(tree, "aidd-vcs", source);
    const own = translator
      .translate(dist, tool)
      .filter((f) => f.relativePath.endsWith("/plugin.json"));
    const path = plugins?.kind === "native" ? nativeOf(plugins).manifestPath() : null;
    if (plugins === null || path === null) return void expect(own).toEqual([]);
    expect(own.map((f) => f.relativePath)).toEqual([
      `${nativeOf(plugins).pluginOutputDir("aidd-vcs")}${path}`,
    ]);
    expect(own[0].content).toBe(
      dist.files.find((f) => f.relativePath === source.manifest)?.content
    );
    const [[onAPath, onA]] = [...(await writtenByA(tree, tool, true))].filter(
      ([k]) => k.includes("/plugins/aidd-vcs/") && k.endsWith("/plugin.json")
    );
    expect(identity(onA)).toEqual(identity(own[0].content));
    if (onAPath !== `${OUT}/plugins/aidd-vcs/${path}`) used.add(MANIFEST_DIVERGENCES[0]);
    if (onA !== own[0].content) used.add(MANIFEST_DIVERGENCES[1]);
  });

  it("every divergence is still needed by some tool", () => {
    expect([...used].sort()).toEqual(
      [...DIVERGENCES.map((d) => d.id), ...MANIFEST_DIVERGENCES].sort()
    );
  });
});
