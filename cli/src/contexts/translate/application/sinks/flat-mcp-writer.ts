import { artifactPath } from "../../../../shared/domain/materialization/artifact-path.js";
import { PLUGIN_MCP_RELATIVE } from "../../../../shared/domain/plugin/canon-paths.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import { FlatTargetExistsError } from "../../contract/translate.error.js";
import { mergeAdditiveMcp } from "../../domain/additive-mcp-merge.js";
import type { FlatMcpStep } from "../../ports/flat-plugin-writer.js";

/** One plugin's prefixed MCP servers, already pointed at the plugin's root, merged into the
 * tool's shared MCP file. */
export async function writeFlatMcp(
  fs: FileReader & FileWriter,
  { target, mcp, pluginName, servers }: FlatMcpStep
): Promise<number> {
  const mcpDest = `${target.outDir}/${artifactPath(mcp, pluginName, PLUGIN_MCP_RELATIVE)}`;
  const existingContent = (await fs.fileExists(mcpDest)) ? await fs.readFile(mcpDest) : null;
  const { mergedContent, collisions } = mergeAdditiveMcp(existingContent, servers, {
    force: target.force,
    serversKey: mcp.mcpServersKey,
  });
  if (collisions.length > 0) throw new FlatTargetExistsError(mcpDest, pluginName);
  await fs.writeFile(mcpDest, mergedContent);
  return 1;
}
