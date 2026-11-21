import { rewritePluginRootInJson } from "../../../../shared/domain/materialization/plugin-root-path-rewrite.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import { flatPluginRootAbsolute } from "../../domain/flat-layout.js";
import { FlatTargetExistsError } from "../../domain/translate.error.js";
import type { FlatMcpStep } from "../../ports/flat-plugin-writer.js";

/** One plugin's prefixed MCP servers, pointed at the plugin's root and merged into the tool's
 * shared MCP file. */
export async function writeFlatMcp(
  fs: FileReader & FileWriter,
  { target, mcp, pluginName, servers }: FlatMcpStep
): Promise<number> {
  const rooted = Object.fromEntries(
    Object.entries(servers).map(([key, value]) => [
      key,
      rewritePluginRootInJson(value, (suffix) =>
        flatPluginRootAbsolute(target, suffix, pluginName)
      ),
    ])
  );
  const mcpDest = mcp.mergeDest(target.outDir);
  const existingContent = (await fs.fileExists(mcpDest)) ? await fs.readFile(mcpDest) : null;
  const { mergedContent, collisions } = mcp.merge(existingContent, rooted, target.force);
  if (collisions.length > 0) throw new FlatTargetExistsError(mcpDest, pluginName);
  await fs.writeFile(mcpDest, mergedContent);
  return 1;
}
