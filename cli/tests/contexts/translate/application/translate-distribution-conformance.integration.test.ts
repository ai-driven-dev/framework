import { join, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { AiToolProfile } from "../../../../src/contexts/tools/contract/tool-profile.js";
import { parseFrontmatter } from "../../../../src/shared/domain/markdown.js";
import { CapturingLogger } from "../../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import { nativeOf } from "../../../shared/testing/native-plugin-answers.builder.js";
import { registeredTools } from "../../../shared/testing/registered-tools.builder.js";
import { seedFromDirectory } from "../../../shared/testing/seed-from-directory.builder.js";
import { buildTree } from "../testing/build-tree.builder.js";
import { translator } from "../testing/engine-kit.builder.js";
import {
  distributionOf,
  FRAMEWORK_SOURCE,
  FRAMEWORK_SOURCES,
} from "../testing/framework-real-distribution.builder.js";

const SOURCE = FRAMEWORK_SOURCE;
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

/** What path B (install) writes differently from path A (disk), named. Markdown is compared as
 * frontmatter data plus body, since B re-serializes the frontmatter. The list only shrinks: an
 * entry nothing needs fails the test, and a difference no entry names fails it too. */
const DIVERGENCES: readonly Divergence[] = [
  {
    id: "A leaves the {{TOOLS}} placeholder, B resolves it to .github/ (a build is location-independent, an install knows its directory)",
    applies: (t, _p, source) => t === "copilot" && source.includes("{{TOOLS}}"),
    fold: (d) => ({ ...d, body: d.body.replaceAll(".github/", "{{TOOLS}}/") }),
  },
];

const SOURCES = FRAMEWORK_SOURCES;
const PLUGIN_ROOT = "$" + "{CLAUDE_PLUGIN_ROOT}";
const COMPONENT_FIELDS = ["skills", "agents", "hooks", "mcpServers"];
/** Every path the manifest lists, as a plugin-relative path. */
const listedPaths = (json: string): string[] =>
  COMPONENT_FIELDS.flatMap((key) => [JSON.parse(json)[key] ?? []].flat()).map((p: string) =>
    p.replace(/^\.\//, "")
  );

const folded = (content: string, list: readonly Divergence[]): string =>
  JSON.stringify(list.reduce((doc, d) => d.fold?.(doc) ?? doc, parseFrontmatter(content)));

const fileAt = (tree: InMemoryFileAdapter, path: string): string => {
  const content = tree.getFile(path);
  if (content === undefined) throw new Error(`${path} is not in the tree`);
  return content;
};

/** Path A: the strategy writing a tree, as `aidd translate` does, read back. */
async function writtenByA(tree: InMemoryFileAdapter, tool: AiToolProfile, native: boolean) {
  const fs = new InMemoryFileAdapter();
  for (const path of tree.listAll()) fs.setFile(path, fileAt(tree, path));
  const assets = { loadConfigAsset: () => "{}", loadSchema: () => ({}) };
  const validator = { validate() {} };
  const mode = native ? "marketplace" : "flat";
  const contract = tool.buildContract(mode);
  if (contract === null) throw new Error(`no ${mode} contract for ${tool.toolId}`);
  await fs.createDirectory(OUT);
  const build = buildTree(fs, validator, assets, new CapturingLogger(), contract, mode);
  await build.execute({ sourceDir: SOURCE, outDir: OUT, target: tool.toolId, mode });
  return new Map(fs.listUnder(OUT).map((p) => [p.replaceAll("\\", "/"), fileAt(fs, p)]));
}

function isExplainedBy(
  file: { relativePath: string; content: string },
  onA: string | undefined,
  list: readonly Divergence[]
): boolean {
  if (onA === undefined) return list.some((d) => d.absentFromA);
  if (onA === file.content) return true;
  return file.relativePath.endsWith(".md") && folded(onA, list) === folded(file.content, list);
}

function compareWithPathA(
  id: string,
  file: { relativePath: string; content: string },
  onA: string | undefined
): { explained: boolean; needed: string[] } {
  const named = DIVERGENCES.filter((d) => d.applies(id, file.relativePath, onA ?? ""));
  const needed = named
    .filter(
      (d) =>
        !isExplainedBy(
          file,
          onA,
          named.filter((e) => e !== d)
        )
    )
    .map((d) => d.id);
  return { explained: isExplainedBy(file, onA, named), needed };
}

function manifestPathOf(
  tool: AiToolProfile,
  plugin: string
): { installed: string; onDisk: string } | null {
  const plugins = tool.plugins();
  if (plugins?.kind !== "native") return null;
  const path = nativeOf(plugins).manifestPath();
  if (path === null) return null;
  return {
    installed: `${nativeOf(plugins).pluginOutputDir(plugin)}${path}`,
    onDisk: `${OUT}/plugins/${plugin}/${path}`,
  };
}

type Comparison = { unexplained: string[]; agreed: number; needed: string[] };

function comparePlugin(
  tree: InMemoryFileAdapter,
  tool: AiToolProfile,
  written: ReadonlyMap<string, string>,
  name: string,
  root: string | null
): Comparison {
  const out: Comparison = { unexplained: [], agreed: 0, needed: [] };
  const translated = translator
    .translate(distributionOf(tree, name), tool)
    .filter((f) => !f.relativePath.endsWith("/plugin.json"));
  for (const file of translated) {
    const rest = file.relativePath.slice((root ?? "").length);
    const onA = written.get(root === null ? `${OUT}/${rest}` : `${OUT}/plugins/${name}/${rest}`);
    const verdict = compareWithPathA(tool.toolId, file, onA);
    if (!verdict.explained) out.unexplained.push(`${tool.toolId}: ${file.relativePath}`);
    else if (onA !== undefined) out.agreed++;
    out.needed.push(...verdict.needed);
  }
  return out;
}

async function compareTool(
  tree: InMemoryFileAdapter,
  tool: AiToolProfile,
  native: boolean
): Promise<Comparison> {
  const written = await writtenByA(tree, tool, native);
  const plugins = tool.plugins();
  const rootOf = (name: string): string | null =>
    native && plugins ? nativeOf(plugins).pluginOutputDir(name) : null;
  const parts = PLUGINS.map((name) => comparePlugin(tree, tool, written, name, rootOf(name)));
  return {
    unexplained: parts.flatMap((c) => c.unexplained),
    agreed: parts.reduce((sum, c) => sum + c.agreed, 0),
    needed: parts.flatMap((c) => c.needed),
  };
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
    const result = await compareTool(tree, tool, plugins.kind === "native");
    for (const needed of result.needed) used.add(needed);
    expect(result.unexplained).toEqual([]);
    expect(result.agreed).toBeGreaterThan(100);
  });

  // aidd-dev ships agents and an MCP file, aidd-vcs neither. Limit: no framework plugin ships an
  // MCP file the source manifest also lists, so an MCP path in a built manifest is checked by
  // `build-native-tree.use-case.integration.test.ts`, not here.
  const manifestCases = registeredTools()
    .idsInCanonicalOrder("ai")
    .flatMap((id) =>
      SOURCES.flatMap((source) =>
        ["aidd-vcs", "aidd-dev"].map((plugin) => [id, source.name, plugin] as const)
      )
    );
  it.each(manifestCases)(
    "%s installs the manifest of a %s source, plugin %s",
    async (id, sourceName, plugin) => {
      const source = SOURCES.find((s) => s.name === sourceName) ?? SOURCES[0];
      const tool = registeredTools().aiProfile(id);
      const dist = distributionOf(tree, plugin, source);
      const own = translator
        .translate(dist, tool)
        .filter((f) => f.relativePath.endsWith("/plugin.json"));
      const path = manifestPathOf(tool, plugin);
      if (path === null) return void expect(own).toEqual([]);
      expect(own.map((f) => f.relativePath)).toEqual([path.installed]);
      const writtenA = await writtenByA(tree, tool, true);
      const [[onAPath, onA]] = [...writtenA].filter(
        ([k]) => k.includes(`/plugins/${plugin}/`) && k.endsWith("/plugin.json")
      );
      expect(own[0].content).toBe(onA);
      expect(onAPath).toBe(path.onDisk);
      const root = `${onAPath.slice(0, onAPath.indexOf(`/plugins/${plugin}/`))}/plugins/${plugin}/`;
      for (const listed of listedPaths(onA)) {
        expect(
          [...writtenA.keys()].some(
            (k) => k === `${root}${listed}` || k.startsWith(`${root}${listed}/`)
          )
        ).toBe(true);
      }
    }
  );

  it("every divergence is still needed by some tool", () => {
    expect([...used].sort()).toEqual(DIVERGENCES.map((d) => d.id).sort());
  });
});

describe("path B writes the commands of a plugin as path A does, for a tool whose build carries them", () => {
  const COMMAND = join(SOURCE, "plugins", "aidd-dev", "commands", "04_code", "implement.md");
  const carriers = registeredTools()
    .idsInCanonicalOrder("ai")
    .filter(
      (id) => registeredTools().aiProfile(id).buildContract("flat")?.artifacts.commands?.supported
    );
  let tree: InMemoryFileAdapter;
  beforeAll(async () => {
    tree = new InMemoryFileAdapter();
    await seedFromDirectory(tree, SOURCE, { useAbsolutePaths: true });
    tree.setFile(
      COMMAND,
      `---\nname: aidd:04:implement\ndescription: Implement.\n---\nRead @${PLUGIN_ROOT}/skills/plan/SKILL.md\n`
    );
  });

  it("names a tool that carries commands", () => {
    expect(carriers).not.toEqual([]);
  });

  it.each(carriers)("%s", async (id) => {
    const tool = registeredTools().aiProfile(id);
    const written = await writtenByA(tree, tool, false);

    const result = await compareTool(tree, tool, false);

    expect([...written.keys()].some((path) => path.includes("/commands/aidd-dev/"))).toBe(true);
    expect(result.unexplained).toEqual([]);
  });
});
