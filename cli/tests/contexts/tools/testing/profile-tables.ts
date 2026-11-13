import { expect } from "vitest";
import type { ToolBuildContract } from "../../../../src/contexts/tools/domain/build-contract.js";
import type { AiTool } from "../../../../src/contexts/tools/domain/contracts.js";
import { InMemoryFileAdapter } from "../../../helpers/ports/in-memory-file-adapter.js";
import {
  PLUGIN_RELATIVE_PATHS,
  PLUGIN_TREE_SOURCES,
  pluginRelativePathsOf,
  pluginTreeSourcesOf,
  supported,
} from "./build-artifacts.js";

type Buildable = Pick<AiTool, "buildContracts">;
type Frontmatter = Record<string, unknown>;

export function contractOf(profile: Buildable, mode: "marketplace" | "flat"): ToolBuildContract {
  const contract = profile.buildContracts?.[mode];
  if (contract === undefined) throw new Error(`no ${mode} build contract`);
  return contract();
}

/** Where a flat build puts a plugin's skill and agents, the awkward agent name included. */
export function flatPathsOf(profile: Buildable) {
  const { skills, agents } = contractOf(profile, "flat").artifacts;
  return {
    skill: supported(skills).path("aidd-dev", "skills/01-plan/SKILL.md"),
    renamesSkill: supported(skills).rewriteSkillName,
    agent: supported(agents).path("aidd-dev", "agents/planner.md"),
    innerMdAgent: supported(agents).path("aidd-dev", "agents/notes.md-helper.md"),
  };
}

export function marketplaceSourcesOf(profile: Buildable) {
  return pluginTreeSourcesOf(contractOf(profile, "marketplace").artifacts);
}

/** What a host that installs a plugin tree as it ships reads, in both builds. */
export function pluginTreeShapeOf(profile: Buildable) {
  return {
    sources: marketplaceSourcesOf(profile),
    paths: pluginRelativePathsOf(contractOf(profile, "marketplace").artifacts),
    flat: pluginTreeSourcesOf(contractOf(profile, "flat").artifacts),
  };
}

export const SHIPPED_AS_IS = {
  sources: PLUGIN_TREE_SOURCES,
  paths: PLUGIN_RELATIVE_PATHS,
  flat: PLUGIN_TREE_SOURCES,
};

/** The catalog and entry a tool that reads Claude's marketplace format writes under `folder`. */
export async function expectClaudeStyleCatalog(profile: Buildable, folder: string): Promise<void> {
  const contract = contractOf(profile, "marketplace");
  const source = {
    name: "aidd",
    version: "1.0.0",
    description: "AI Driven Dev",
    owner: { name: "AIDD" },
  };
  const plugins = [{ name: "aidd-dev", source: "./plugins/aidd-dev" }];
  const built = await contract.buildMarketplaceCatalog?.(
    { ...source, plugins: [] },
    plugins,
    new InMemoryFileAdapter()
  );
  expect(built).toStrictEqual({
    catalog: { ...source, plugins },
    schemaName: "claude-marketplace",
    destRelPath: `${folder}/marketplace.json`,
  });

  const fs = new InMemoryFileAdapter({
    [`/out/plugins/aidd-dev/${folder}/plugin.json`]: JSON.stringify({
      version: "1.2.3",
      description: "Development loop",
    }),
  });
  const entry = await contract.buildMarketplaceEntry?.(
    "aidd-dev",
    "/src/plugins/aidd-dev",
    "/out",
    undefined,
    fs
  );
  expect(entry).toStrictEqual({
    name: "aidd-dev",
    source: "./plugins/aidd-dev",
    description: "Development loop",
    version: "1.2.3",
  });
}

const RULE_INPUTS = {
  "a paths list": { paths: ["a", "b"] },
  "globs that apply on request": { globs: ["a"], alwaysApply: false, description: "d" },
  "paths beside a description": { paths: ["a"], description: "d", alwaysApply: false },
  "a description that opts out of always-apply": { description: "d", alwaysApply: false },
  "an always-apply rule": { description: "d", alwaysApply: true },
  "a description alone": { description: "d" },
  "an opt-out with no description": { alwaysApply: false },
  "an empty paths list": { paths: [] },
} as const satisfies Record<string, Frontmatter>;

type RuleCase = keyof typeof RULE_INPUTS;

/** The four canonical rules every profile that converts frontmatter leaves bare. */
export const WRITES_NOTHING = {
  "an always-apply rule": {},
  "a description alone": {},
  "an opt-out with no description": {},
  "an empty paths list": {},
};

/** Rows for `it.each`: a canonical rule frontmatter and what one profile writes for it. */
export function rulesRows(expected: Record<RuleCase, Frontmatter>) {
  return (Object.keys(RULE_INPUTS) as RuleCase[]).map(
    (name) => [name, RULE_INPUTS[name], expected[name]] as const
  );
}
