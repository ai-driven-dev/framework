import { join } from "node:path";
import type { FileReader } from "../../../../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../../../../kernel/ports/file-writer.js";
import type { Hasher } from "../../../../../kernel/ports/hasher.js";
import type { AiToolId } from "../../../../../kernel/tool.js";
import type { AiToolProfile } from "../../../../tools/contract/tool-profile.js";
import type { PluginDistribution } from "../../../../translate/domain/plugin-distribution.js";
import type {
  PluginTranslationSkip,
  ReadonlySkipList,
} from "../../../../translate/domain/plugin-translation-skip.js";
import type { Manifest } from "../../../domain/manifest.js";

export async function refreshTrackedMcpConfigHash(
  fs: FileReader,
  manifest: Manifest,
  toolId: AiToolId,
  projectRoot: string,
  outputRelPath: string | undefined
): Promise<void> {
  if (outputRelPath === undefined || !manifest.isFileTracked(outputRelPath)) return;
  const outputPath = join(projectRoot, outputRelPath);
  if (await fs.fileExists(outputPath)) {
    manifest.updateTrackedFileHash(toolId, outputRelPath, await fs.readFileHash(outputPath));
  }
}

export async function materializeFlatMcp(
  fs: FileReader & FileWriter,
  hasher: Hasher,
  dist: PluginDistribution,
  tool: AiToolProfile,
  projectRoot: string,
  previousMcpEntries: ReadonlyMap<string, string>
): Promise<{
  mcpEntries: ReadonlyMap<string, string>;
  mcpSkips: ReadonlySkipList;
  outputRelPath?: string;
}> {
  const mcpCap = dist.components.mcp.length === 0 ? null : tool.flatPluginMcp();
  if (mcpCap === null) {
    return { mcpEntries: new Map(), mcpSkips: [], outputRelPath: undefined };
  }
  const outputRelPath = await mcpCap.resolveOutputPath((relativePath) =>
    fs.fileExists(join(projectRoot, relativePath))
  );
  const outputPath = join(projectRoot, outputRelPath);
  const existingContent = await readExistingJson(fs, outputPath);
  const transformed = mcpCap.transform(dist.components.mcp[0].content);
  const { mergedContent, contributedEntries, collisions, editedPreviousEntries } =
    mcpCap.mergePluginServers(existingContent, transformed, previousMcpEntries, hasher);
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
      pluginName: dist.manifest.name,
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
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}
