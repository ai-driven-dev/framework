/** Kilo's project distribution is flat. Its config and MCP format follow the OpenCode runtime,
 * but Kilo has its own .kilo/ discovery paths and bundled base configuration. */

import { parseFrontmatter, serializeFrontmatter } from "../../../../../kernel/markdown.js";
import {
  flatHooksPathWithLoaderEntry,
  flatMcpKeyPrefix,
  genericFlatAgentPath,
  genericFlatSkillTreePath,
} from "../../../../../kernel/materialization/flat-paths.js";
import { rewriteRelativeLinks } from "../../../../../kernel/materialization/relative-link-rewrite.js";
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

function kiloFlatResolveTarget(plugin: string, rel: string): string {
  if (rel.startsWith("agents/")) return kiloFlatAgentPath(plugin, rel);
  if (rel.startsWith("skills/")) return kiloFlatSkillPath(plugin, rel);
  return rel;
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

async function resolveKiloJsonPath(outDir: string, fs: FsType): Promise<string> {
  if (await fs.fileExists(`${outDir}/kilo.jsonc`)) return `${outDir}/kilo.jsonc`;
  return `${outDir}/kilo.json`;
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
      rules: { supported: false },
      commands: { supported: false },
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
    emitConfigArtifact: async (builtPlugins, outDir, sourceDir, fs, _validator, assetProvider) => {
      const configPath = await resolveKiloJsonPath(outDir, fs);
      const existing = (await fs.fileExists(configPath)) ? await fs.readFile(configPath) : null;
      const incoming = await collectKiloMcp(builtPlugins, sourceDir, fs);
      const asset = assetProvider.loadConfigAsset("kilo", "kilo.json");
      const base = typeof asset === "string" ? asset : JSON.stringify(asset);
      await fs.writeFile(configPath, buildOpencodeFlatConfig(base, existing, incoming));
      return 1;
    },
  };
}
