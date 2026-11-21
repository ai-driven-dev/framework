import { flatMcpKeyPrefix } from "../../../../shared/domain/materialization/flat-paths.js";
import { rewritePluginRootInJson } from "../../../../shared/domain/materialization/plugin-root-path-rewrite.js";
import { asPlainObject } from "../../../../shared/domain/reading/plain-object.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import { flatPluginRootAbsolute } from "../../domain/flat-layout.js";
import { FlatTargetExistsError } from "../../domain/translate.error.js";
import type { FlatMcpStep } from "../../ports/flat-plugin-writer.js";

/** One plugin's MCP servers, prefixed and merged into the tool's shared MCP file. */
export async function writeFlatMcp(
  fs: FileReader & FileWriter,
  { target, mcp, pluginName, mcpSrc }: FlatMcpStep
): Promise<number> {
  const parsed = asPlainObject(JSON.parse(await fs.readFile(mcpSrc)));
  const servers = asPlainObject(parsed?.mcpServers) ?? {};
  const prefix = flatMcpKeyPrefix(pluginName);
  const prefixed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(servers)) {
    prefixed[`${prefix}${key}`] = rewritePluginRootInJson(value, (suffix) =>
      flatPluginRootAbsolute(target, suffix, pluginName)
    );
  }
  const mcpDest = mcp.mergeDest(target.outDir);
  const existingContent = (await fs.fileExists(mcpDest)) ? await fs.readFile(mcpDest) : null;
  const { mergedContent, collisions } = mcp.merge(existingContent, prefixed, target.force);
  if (collisions.length > 0) throw new FlatTargetExistsError(mcpDest, pluginName);
  await fs.writeFile(mcpDest, mergedContent);
  return 1;
}
