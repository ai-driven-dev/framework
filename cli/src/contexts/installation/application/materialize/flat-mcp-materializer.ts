import { join } from "node:path";
import type {
  PluginTranslationSkip,
  ReadonlySkipList,
} from "../../../../shared/domain/plugin/plugin-translation-skip.js";
import { isErrnoException } from "../../../../shared/domain/reading/json-file.js";
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

export async function materializeFlatMcp(materialization: {
  fs: FileReader & FileWriter;
  pluginName: string;
  /** The plugin's servers already in the tool's own shape, as the translation answers them, or
   * null when the plugin declares none. This only merges them into the file. */
  declaration: string | null;
  tool: FlatMcpSection;
  projectRoot: string;
  previousMcpEntries: ReadonlyMap<string, string>;
}): Promise<{
  mcpEntries: ReadonlyMap<string, string>;
  mcpSkips: ReadonlySkipList;
  outputRelPath?: string;
}> {
  const { fs, pluginName, declaration, tool, projectRoot, previousMcpEntries } = materialization;
  const mcpCap = declaration === null ? null : tool.flatPluginMcp();
  if (mcpCap === null || declaration === null) {
    return { mcpEntries: new Map(), mcpSkips: [], outputRelPath: undefined };
  }
  const outputRelPath = await mcpCap.resolveOutputPath((relativePath) =>
    fs.fileExists(join(projectRoot, relativePath))
  );
  const outputPath = join(projectRoot, outputRelPath);
  const existingContent = await readExistingJson(fs, outputPath);
  const { mergedContent, contributedEntries, collisions, editedPreviousEntries } =
    mcpCap.mergePluginServers(existingContent, declaration, previousMcpEntries);
  if (editedPreviousEntries.length > 0) {
    throw new Error(
      `MCP server '${editedPreviousEntries[0]}' was edited after install; reinstall refused.`
    );
  }
  if (contributedEntries.size > 0 || previousMcpEntries.size > 0) {
    await fs.writeFile(outputPath, mergedContent);
  }
  const mcpSkips = collisions.map(
    (reason): PluginTranslationSkip => ({
      pluginName,
      component: "mcp",
      toolId: tool.toolId,
      reason,
    })
  );
  return { mcpEntries: contributedEntries, mcpSkips, outputRelPath };
}

async function readExistingJson(fs: FileReader, path: string): Promise<string | null> {
  try {
    return await fs.readFile(path);
  } catch (err) {
    if (isErrnoException(err) && err.code === "ENOENT") return null;
    throw err;
  }
}

/**
 * Merges the plugin's MCP servers into the tool's flat config, then refreshes the hash the manifest
 * tracks for that config so the merge does not read back as drift.
 */
export async function materializeRequestedMcp(
  fs: FileReader & FileWriter,
  request: AddPluginRequest,
  declaration: string | null
): Promise<Awaited<ReturnType<typeof materializeFlatMcp>>> {
  const { dist, tool, projectRoot, manifest, previousMcpEntries = new Map() } = request;
  const mcp = await materializeFlatMcp({
    fs,
    pluginName: dist.manifest.name,
    declaration,
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
