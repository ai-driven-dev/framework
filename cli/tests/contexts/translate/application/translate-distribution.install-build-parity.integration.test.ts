import { readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { buildPlans } from "../../../../src/contexts/translate/domain/layouts/build-layout.js";
import { installPlan } from "../../../../src/contexts/translate/domain/layouts/install-layout.js";
import {
  applyPlan,
  type ComponentPlan,
} from "../../../../src/contexts/translate/domain/rules/component-pipeline.js";
import { parseFrontmatter } from "../../../../src/shared/domain/markdown.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredManifestPaths } from "../../../shared/testing/registered-manifest-probes.builder.js";
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

const tools = registeredTools();
const CELLS = tools.idsInCanonicalOrder("ai").flatMap((id) => {
  const tool = tools.aiProfile(id);
  const kind = tool.plugins()?.kind;
  const mode: "flat" | "marketplace" = kind === "native" ? "marketplace" : "flat";
  const contract = kind === undefined ? null : tool.buildContract(mode);
  return contract === null ? [] : [{ id, tool, mode, contract, cell: `${id}:${mode}` }];
});

function bySource(plans: readonly ComponentPlan[]): Map<string, string> {
  const files = new Map<string, string>();
  for (const plan of plans) if (plan.source !== "") files.set(plan.source, applyPlan(plan).content);
  return files;
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

  function pairs(cell: (typeof CELLS)[number]) {
    return readdirSync(join(FRAMEWORK_SOURCE, "plugins")).map((name) => {
      const dist = distributionOf(tree, name);
      const manifestPaths = registeredManifestPaths();
      const install = bySource(installPlan(dist, { tool: cell.tool, manifestPaths }).plans);
      const build = bySource(buildPlans(dist, cell.contract, cell.mode));
      return { name, install, build };
    });
  }

  it.each(CELLS)("$cell: both write the same canon files, two ways", (cell) => {
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
});
