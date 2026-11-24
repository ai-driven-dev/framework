import { join } from "node:path";
import type {
  PluginTranslationSkip,
  ReadonlySkipList,
} from "../../../../shared/domain/plugin/plugin-translation-skip.js";
import { whenAbsent } from "../../../../shared/domain/reading/json-file.js";
import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Manifest } from "../../domain/manifest.js";
import type { FlatMcpSection } from "../../ports/tool-sections.js";
import type { AddPluginRequest } from "./add-plugin-request.js";

export async function refreshTrackedMcpConfigHash(refresh: {
  fs: FileReader;
  manifest: Manifest;
  toolId: AiToolId;
  projectRoot: string;
  outputRelPath: string | undefined;
}): Promise<void> {
  const { fs, manifest, toolId, projectRoot, outputRelPath } = refresh;
  if (outputRelPath === undefined || !manifest.isFileTracked(outputRelPath)) return;
  const outputPath = join(projectRoot, outputRelPath);
  if (await fs.fileExists(outputPath)) {
    manifest.recordFileHash(toolId, outputRelPath, await fs.readFileHash(outputPath));
  }
}

/** What a plugin hands a flat install to put in the tool's shared config: its servers, and the
 * glob listing the rules it placed. Either is null when the plugin has none. */
export interface FlatConfigContribution {
  readonly declaration: string | null;
  readonly rulesGlob: string | null;
}

export async function materializeFlatMcp(materialization: {
  fs: FileReader & FileWriter;
  pluginName: string;
  /** The plugin's servers already in the tool's own shape, as the translation answers them, and
   * the rules glob: this only merges them into the file. */
  contribution: FlatConfigContribution;
  tool: FlatMcpSection;
  projectRoot: string;
  previousMcpEntries: ReadonlyMap<string, string>;
}): Promise<{
  mcpEntries: ReadonlyMap<string, string>;
  mcpSkips: ReadonlySkipList;
  outputRelPath?: string;
}> {
  const { fs, pluginName, contribution, tool, projectRoot, previousMcpEntries } = materialization;
  const { declaration, rulesGlob } = contribution;
  const mcpCap = tool.flatPluginMcp();
  if (mcpCap === null || (declaration === null && rulesGlob === null)) {
    return { mcpEntries: new Map(), mcpSkips: [], outputRelPath: undefined };
  }
  const outputRelPath = await mcpCap.resolveOutputPath((relativePath) =>
    fs.fileExists(join(projectRoot, relativePath))
  );
  const outputPath = join(projectRoot, outputRelPath);
  const existingContent = await readExistingJson(fs, outputPath);
  const merged = mergedServers(mcpCap, { existingContent, declaration, previousMcpEntries });
  const content =
    rulesGlob === null ? merged.content : mcpCap.withInstruction(merged.content, rulesGlob);
  if (content !== null && content !== existingContent) await fs.writeFile(outputPath, content);
  const mcpSkips = merged.collisions.map(
    (reason): PluginTranslationSkip => ({
      pluginName,
      component: "mcp",
      toolId: tool.toolId,
      reason,
    })
  );
  return { mcpEntries: merged.contributedEntries, mcpSkips, outputRelPath };
}

function mergedServers(
  mcpCap: NonNullable<ReturnType<FlatMcpSection["flatPluginMcp"]>>,
  merge: {
    existingContent: string | null;
    declaration: string | null;
    previousMcpEntries: ReadonlyMap<string, string>;
  }
) {
  const { existingContent, declaration, previousMcpEntries } = merge;
  const none: { contributedEntries: ReadonlyMap<string, string>; collisions: string[] } = {
    contributedEntries: new Map(),
    collisions: [],
  };
  if (declaration === null) return { ...none, content: existingContent };
  const merged = mcpCap.mergePluginServers(existingContent, declaration, previousMcpEntries);
  if (merged.editedPreviousEntries.length > 0) {
    throw new Error(
      `MCP server '${merged.editedPreviousEntries[0]}' was edited after install; reinstall refused.`
    );
  }
  const touched = merged.contributedEntries.size > 0 || previousMcpEntries.size > 0;
  return { ...merged, content: touched ? merged.mergedContent : existingContent };
}

async function readExistingJson(fs: FileReader, path: string): Promise<string | null> {
  return whenAbsent(() => fs.readFile(path), null);
}

/**
 * Merges the plugin's MCP servers into the tool's flat config, then refreshes the hash the manifest
 * tracks for that config so the merge does not read back as drift.
 */
export async function materializeRequestedMcp(
  fs: FileReader & FileWriter,
  request: AddPluginRequest,
  contribution: FlatConfigContribution
): Promise<Awaited<ReturnType<typeof materializeFlatMcp>>> {
  const { dist, tool, projectRoot, manifest, previousMcpEntries = new Map() } = request;
  const mcp = await materializeFlatMcp({
    fs,
    pluginName: dist.manifest.name,
    contribution,
    tool,
    projectRoot,
    previousMcpEntries,
  });
  await refreshTrackedMcpConfigHash({
    fs,
    manifest,
    toolId: tool.toolId,
    projectRoot,
    outputRelPath: mcp.outputRelPath,
  });
  return mcp;
}
