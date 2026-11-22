import { readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { translate } from "../../../../src/contexts/translate/domain/engine.js";
import { parseFrontmatter } from "../../../../src/shared/domain/markdown.js";
import type { PluginDistribution } from "../../../../src/shared/domain/plugin/plugin-distribution.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import { manifestPathsOf } from "../../../shared/testing/manifest-probes-of.builder.js";
import { registeredTools } from "../../../shared/testing/registered-tools.builder.js";
import { seedFromDirectory } from "../../../shared/testing/seed-from-directory.builder.js";
import {
  distributionOf,
  FRAMEWORK_SOURCE,
} from "../testing/framework-real-distribution.builder.js";

/**
 * An install and a build of the same plugin write the same bytes for the same canon file, bar
 * the differences below. Links, frontmatter, the skill name, the root token and the hook scripts
 * each have one implementation; a difference here is what a layout or a tool's profile hands
 * that implementation as data: the link form, which files are shaped, whether a skill is renamed,
 * what a tool keeps of a header. Each is written down with the reason it exists, and an entry that
 * no longer differs fails the test, so a difference cannot outlive its cause.
 */
interface Difference {
  readonly cell: string;
  readonly component: string;
  readonly reason: string;
  readonly applies: (source: string) => boolean;
  /** Writes both sides without what the difference is about: what is left must be equal. */
  readonly normalize: (content: string) => string;
}

const markdown = (source: string): boolean => source.endsWith(".md");

const withoutName = (content: string): string => content.replace(/^name\s*[:=].*$/m, "");
const atLinksAsWritten = (content: string): string =>
  content.replace(/\[[^\]\n]*\]\(([^)\n]+)\)/g, "@$1");

/** The content as the file means it: its frontmatter read as data, without the keys a layout
 * owns, so a quoting or a folding of a value is no difference, and its @ links in one form. */
const meaning =
  (keep: (key: string) => boolean = () => true) =>
  (content: string): string => {
    const { frontmatter, body } = parseFrontmatter(content);
    const kept = Object.entries(frontmatter)
      .filter(([key]) => key !== "name" && key !== "argument-hint" && keep(key))
      .sort(([a], [b]) => a.localeCompare(b));
    return JSON.stringify(kept) + atLinksAsWritten(withoutName(body));
  };

const pluginsPath = (content: string): string =>
  content.replace(/(?:\{\{TOOLS\}\}|\.github)\/plugins\//g, "PLUGINS/");

const SKILLS_REASON =
  "an install shapes the frontmatter of every prose file and leaves an @ link as written; a build shapes the entry only and writes an @ link as a markdown link";

const DIFFERENCES: readonly Difference[] = [
  ...["claude", "cursor"].map((tool) => ({
    cell: `${tool}:marketplace`,
    component: "skills",
    reason: SKILLS_REASON,
    applies: markdown,
    normalize: meaning(),
  })),
  {
    cell: "copilot:marketplace",
    component: "skills",
    reason: `${SKILLS_REASON}; an install writes the tool's plugin path where a build leaves the placeholder`,
    applies: markdown,
    normalize: (content: string) => pluginsPath(meaning()(content)),
  },
  {
    cell: "codex:marketplace",
    component: "skills",
    reason: `${SKILLS_REASON}; codex keeps only a description in an installed file`,
    applies: markdown,
    normalize: meaning((key) => key === "description"),
  },
  ...["opencode", "kilo", "antigravity"].map((tool) => ({
    cell: `${tool}:flat`,
    component: "skills",
    reason:
      "a flat build names a skill entry after its folder and writes an @ link as a markdown link; an install keeps the canon name and the link as written",
    applies: markdown,
    normalize: meaning(),
  })),
  ...["cursor", "codex"].map((tool) => ({
    cell: `${tool}:marketplace`,
    component: "agents",
    reason: "a build prefixes the agent's name with its plugin, so two plugins never share one",
    applies: markdown,
    normalize: meaning(),
  })),
];

/** A file only one side writes through the engine, and why: the other side writes it elsewhere or
 * not at all. Each entry names a side, so a file one side starts writing alone is a failure, and an
 * entry whose file no side writes any more fails too. */
interface OneSided {
  readonly cell: string;
  readonly side: "install" | "build";
  readonly file: RegExp;
  readonly reason: string;
}

const MANIFEST_REASON =
  "an install writes the plugin's manifest among its files; a build synthesizes it in the sink, which folds it with the marketplace catalog";

const ONE_SIDED: readonly OneSided[] = [
  ...["claude", "copilot", "codex"].map((tool) => ({
    cell: `${tool}:marketplace`,
    side: "install" as const,
    file: /^generated:.*\/plugins\/[^/]+\/plugin\.json$/,
    reason: MANIFEST_REASON,
  })),
  {
    cell: "cursor:marketplace",
    side: "build",
    file: /^hooks\/hooks\.json$/,
    reason:
      "a build writes the hooks manifest as a file; an install of a tool keeping its hooks in the project hands it over to merge into the project's hooks file",
  },
];

const tools = registeredTools();
const CELLS = tools.idsInCanonicalOrder("ai").flatMap((id) => {
  const tool = tools.aiProfile(id);
  const kind = tool.plugins()?.kind;
  const mode: "flat" | "marketplace" = kind === "native" ? "marketplace" : "flat";
  const contract = kind === undefined ? null : tool.buildContract(mode);
  return contract === null ? [] : [{ id, tool, mode, contract, cell: `${id}:${mode}` }];
});

/** What the engine writes for a plugin, by the canon file each comes from, and by its own path for
 * a file the layout generates, a script a tool keeps in the project included: nothing the engine
 * writes is left out of the comparison. */
function written(
  dist: PluginDistribution,
  layout: Parameters<typeof translate>[1]
): Map<string, string> {
  const { files, sources, projectHooks } = translate(dist, layout);
  return new Map([
    ...files.map(({ relativePath, content }): [string, string] => [
      sources.get(relativePath) ?? `generated:${relativePath}`,
      content,
    ]),
    ...projectHooks.scripts.map(({ source, content }): [string, string] => [source, content]),
  ]);
}

/** Where the engine puts each canon file, a script a tool keeps in the project included. A file
 * the layout generates has no canon file and is left out. */
function placed(
  dist: PluginDistribution,
  layout: Parameters<typeof translate>[1]
): Map<string, string> {
  const { files, sources, projectHooks } = translate(dist, layout);
  return new Map([
    ...files.flatMap(({ relativePath }): [string, string][] => {
      const source = sources.get(relativePath);
      return source === undefined ? [] : [[source, relativePath]];
    }),
    ...projectHooks.scripts.map(({ source, relativePath }): [string, string] => [
      source,
      relativePath,
    ]),
  ]);
}

function withoutOneSided(
  cell: string,
  side: OneSided["side"],
  files: ReadonlyMap<string, string>
): Map<string, string> {
  const named = ONE_SIDED.filter((entry) => entry.cell === cell && entry.side === side);
  return new Map([...files].filter(([key]) => !named.some((entry) => entry.file.test(key))));
}

const componentOf = (source: string): string => source.split("/")[0];
const forFile = (cell: string, source: string): Difference | undefined =>
  DIFFERENCES.find(
    (d) => d.cell === cell && d.component === componentOf(source) && d.applies(source)
  );

/** Whether the two sides differ, once the differences the layouts own are left out. */
function differs(
  cell: string,
  source: string,
  sides: { install?: string; build?: string }
): boolean {
  const { install, build } = sides;
  if (build === undefined || install === undefined) return true;
  const named = forFile(cell, source);
  return named ? named.normalize(install) !== named.normalize(build) : install !== build;
}

describe("an install against a build of the same plugin", () => {
  let tree: InMemoryFileAdapter;
  beforeAll(async () => {
    tree = new InMemoryFileAdapter();
    await seedFromDirectory(tree, FRAMEWORK_SOURCE, { useAbsolutePaths: true });
  });

  /** What each side writes for every plugin, all of it. */
  function writtenBy(cell: (typeof CELLS)[number]) {
    const manifestPaths = manifestPathsOf(registeredTools());
    return readdirSync(join(FRAMEWORK_SOURCE, "plugins")).map((name) => {
      const dist = distributionOf(tree, name);
      return {
        name,
        install: written(dist, { kind: "install", tool: cell.tool, manifestPaths }),
        build: written(dist, {
          kind: "build",
          contract: cell.contract,
          mode: cell.mode,
          outDir: "out",
        }),
      };
    });
  }

  function pairs(cell: (typeof CELLS)[number]) {
    return writtenBy(cell).map(({ name, install, build }) => ({
      name,
      install: withoutOneSided(cell.cell, "install", install),
      build: withoutOneSided(cell.cell, "build", build),
    }));
  }

  it.each(CELLS)("$cell: both write the same files, two ways", (cell) => {
    for (const { name, install, build } of pairs(cell)) {
      const onlyInstalled = [...install.keys()].filter((source) => !build.has(source));
      const onlyBuilt = [...build.keys()].filter((source) => !install.has(source));
      expect({ name, onlyInstalled }).toEqual({ name, onlyInstalled: [] });
      expect({ name, onlyBuilt }).toEqual({ name, onlyBuilt: [] });
    }
  });

  it.each(CELLS)(
    "$cell: both write the same bytes for each file, bar the named differences",
    (cell) => {
      const unexplained = pairs(cell).flatMap(({ name, install, build }) =>
        [...new Set([...install.keys(), ...build.keys()])]
          .filter((source) =>
            differs(cell.cell, source, { install: install.get(source), build: build.get(source) })
          )
          .map((source) => `${name}/${source}`)
      );
      expect(unexplained).toEqual([]);
    }
  );

  it.each(CELLS.filter((cell) => cell.mode === "flat"))(
    "$cell: both put each file at the same path",
    (cell) => {
      const manifestPaths = manifestPathsOf(registeredTools());
      const moved = readdirSync(join(FRAMEWORK_SOURCE, "plugins")).flatMap((name) => {
        const dist = distributionOf(tree, name);
        const install = placed(dist, { kind: "install", tool: cell.tool, manifestPaths });
        const build = placed(dist, {
          kind: "build",
          contract: cell.contract,
          mode: cell.mode,
          outDir: "out",
        });
        return [...install]
          .filter(([source, path]) => build.has(source) && build.get(source) !== path)
          .map(([source, path]) => `${name}/${source}: ${path} against ${build.get(source)}`);
      });
      expect(moved).toEqual([]);
    }
  );

  it("names no difference that no longer differs", () => {
    const stale = DIFFERENCES.filter((d) => {
      const cell = CELLS.find((c) => c.cell === d.cell);
      if (cell === undefined) return true;
      return !pairs(cell).some(({ install, build }) =>
        [...install].some(([source, content]) => {
          const built = build.get(source);
          return forFile(d.cell, source) === d && built !== undefined && built !== content;
        })
      );
    });
    expect(stale.map((d) => `${d.cell}:${d.component}`)).toEqual([]);
  });

  it("names no file only one side writes that no side writes any more", () => {
    const stale = ONE_SIDED.filter((entry) => {
      const cell = CELLS.find((c) => c.cell === entry.cell);
      if (cell === undefined) return true;
      return !writtenBy(cell).some((plugin) =>
        [...plugin[entry.side].keys()].some((key) => entry.file.test(key))
      );
    });
    expect(stale.map((entry) => `${entry.cell}:${entry.side}`)).toEqual([]);
  });
});
