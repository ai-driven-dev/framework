/** Kilo's project distribution is flat. Its config and MCP format follow the OpenCode runtime,
 * but Kilo has its own .kilo/ discovery paths and bundled base configuration. */

import { join, relative } from "node:path";
import { parseFrontmatter, serializeFrontmatter } from "../../../../../kernel/markdown.js";
import {
  flatHooksPathWithLoaderEntry,
  flatMcpKeyPrefix,
  genericFlatAgentPath,
  genericFlatRulePath,
  genericFlatSkillTreePath,
} from "../../../../../kernel/materialization/flat-paths.js";
import {
  relocateRelativeLinks,
  rewriteRelativeLinks,
} from "../../../../../kernel/materialization/relative-link-rewrite.js";
import type { FileReader } from "../../../../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../../../../kernel/ports/file-writer.js";
import type { ToolBuildContract } from "../../build-contract.js";
import { buildOpencodeFlatConfig } from "../../formats/opencode-mcp-merge.js";
import { transformMcpToOpencode } from "../opencode/build.js";
import { generateKiloHooksBridge } from "./kilo-hooks-bridge.js";
import {
  KILO_DIRECTORY,
  KILO_HOOKS_DIR,
  KILO_PLUGIN_DIR,
  KILO_PLUGIN_ENTRY_BASENAME,
  makeKiloHooksBridgePath,
  resolveKiloConfigPath,
} from "./kilo-paths.js";

type FsType = FileReader & FileWriter;

function kiloFlatAgentPath(plugin: string, rel: string): string {
  return genericFlatAgentPath(
    `${KILO_DIRECTORY}agents/`,
    plugin,
    rel.replace(/^agents\//, ""),
    ".md"
  );
}

function kiloFlatSkillPath(plugin: string, rel: string): string {
  return genericFlatSkillTreePath(`${KILO_DIRECTORY}skills/`, plugin, rel.replace(/^skills\//, ""));
}

function kiloFlatRulePath(plugin: string, rel: string): string {
  return genericFlatRulePath(`${KILO_DIRECTORY}rules/`, plugin, rel);
}

function kiloFlatEmittedTarget(plugin: string, rel: string): string | null {
  if (rel.startsWith("agents/")) return kiloFlatAgentPath(plugin, rel);
  if (rel.startsWith("skills/")) return kiloFlatSkillPath(plugin, rel);
  if (rel.startsWith("rules/") && rel.endsWith(".md")) return kiloFlatRulePath(plugin, rel);
  return null;
}

function kiloFlatResolveTarget(plugin: string, rel: string): string {
  return kiloFlatEmittedTarget(plugin, rel) ?? rel;
}

function kiloFlatHooksPath(plugin: string, rel: string): string {
  return flatHooksPathWithLoaderEntry(
    KILO_HOOKS_DIR,
    { dir: KILO_PLUGIN_DIR, baseName: KILO_PLUGIN_ENTRY_BASENAME },
    plugin,
    rel
  );
}

function transformKiloFlatAgent(content: string, plugin: string, outName: string): string {
  const { frontmatter, body } = parseFrontmatter(content);
  const flatRelPath = kiloFlatAgentPath(plugin, `agents/${outName}`);
  const rewrittenBody = rewriteRelativeLinks(body, {
    currentFilePluginRelative: flatRelPath,
    resolveTargetPath: (rel) => kiloFlatResolveTarget(plugin, rel),
  });
  return serializeFrontmatter(
    { ...frontmatter, name: `${plugin}-${outName.replace(/\.md$/, "")}`, mode: "subagent" },
    rewrittenBody
  );
}

// Kilo loads `instructions` for every session: a `paths` scope would silently widen to all files.
function kiloRulePathScope(content: string): unknown {
  return parseFrontmatter(content).frontmatter.paths;
}

function transformKiloFlatRule(content: string, plugin: string, ruleRel: string): string {
  const sourceRel = `rules/${ruleRel}`;
  return relocateRelativeLinks(content, {
    sourceFilePluginRelative: sourceRel,
    materializedFileRelative: kiloFlatRulePath(plugin, sourceRel),
    resolveTargetPath: (rel) => kiloFlatEmittedTarget(plugin, rel),
  });
}

async function collectKiloRuleInstructions(
  builtPlugins: readonly string[],
  sourceDir: string,
  fs: FsType
): Promise<string[]> {
  const instructions: string[] = [];
  for (const plugin of builtPlugins) {
    const rulesSrc = join(sourceDir, "plugins", plugin, "rules");
    if (!(await fs.fileExists(rulesSrc))) continue;
    for (const absPath of await fs.listFilesRecursive(rulesSrc)) {
      if (!absPath.endsWith(".md")) continue;
      if (kiloRulePathScope(await fs.readFile(absPath)) !== undefined) continue;
      const rel = relative(rulesSrc, absPath).replace(/\\/g, "/");
      instructions.push(kiloFlatRulePath(plugin, `rules/${rel}`));
    }
  }
  return instructions.sort();
}

async function collectKiloMcp(
  builtPlugins: readonly string[],
  sourceDir: string,
  fs: FsType
): Promise<Record<string, unknown>> {
  const incoming: Record<string, unknown> = {};
  for (const plugin of builtPlugins) {
    const mcpSrc = `${sourceDir}/plugins/${plugin}/.mcp.json`;
    if (!(await fs.fileExists(mcpSrc))) continue;
    const transformed = JSON.parse(transformMcpToOpencode(await fs.readFile(mcpSrc))) as {
      mcp?: Record<string, unknown>;
    };
    for (const [key, value] of Object.entries(transformed.mcp ?? {})) {
      incoming[`${flatMcpKeyPrefix(plugin)}${key}`] = value;
    }
  }
  return incoming;
}

export function buildKiloFlatContract(): ToolBuildContract {
  return {
    manifestFileRelative: null,
    synthesizeManifest: null,
    manifestSchemaName: null,
    artifacts: {
      skills: {
        supported: true,
        source: { kind: "fullTree", srcDir: "skills" },
        path: kiloFlatSkillPath,
        rewriteSkillName: true,
      },
      agents: {
        supported: true,
        source: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
        path: kiloFlatAgentPath,
        transform: transformKiloFlatAgent,
      },
      mcp: { supported: false },
      hooks: {
        supported: true,
        source: { kind: "hooksBundle", jsonPath: "hooks/hooks.json", scriptDir: "hooks" },
        path: kiloFlatHooksPath,
        skipHooksJson: true,
        hooksBridge: {
          generate: generateKiloHooksBridge,
          path: makeKiloHooksBridgePath,
          skipIfSourceHas: KILO_PLUGIN_ENTRY_BASENAME,
        },
      },
      rules: {
        supported: true,
        source: { kind: "filteredTree", srcDir: "rules", inputExt: ".md" },
        path: kiloFlatRulePath,
        inexpressibleScope: kiloRulePathScope,
        transform: transformKiloFlatRule,
      },
      commands: { supported: false },
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
    emitConfigArtifact: async (builtPlugins, outDir, sourceDir, fs, _validator, assetProvider) => {
      const configPath = join(outDir, await resolveKiloConfigPath(outDir, fs));
      const existing = (await fs.fileExists(configPath)) ? await fs.readFile(configPath) : null;
      const incoming = await collectKiloMcp(builtPlugins, sourceDir, fs);
      const asset = assetProvider.loadConfigAsset("kilo", "kilo.json");
      const assetJson = typeof asset === "string" ? asset : JSON.stringify(asset);
      const instructions = await collectKiloRuleInstructions(builtPlugins, sourceDir, fs);
      // Generated Rule paths follow the user's own `instructions`, never duplicated on rebuild.
      const base =
        instructions.length > 0
          ? JSON.stringify({ ...JSON.parse(assetJson), instructions })
          : assetJson;
      const mergedKeys = instructions.length > 0 ? ["instructions"] : [];
      await fs.writeFile(configPath, buildOpencodeFlatConfig(base, existing, incoming, mergedKeys));
      return 1;
    },
  };
}
