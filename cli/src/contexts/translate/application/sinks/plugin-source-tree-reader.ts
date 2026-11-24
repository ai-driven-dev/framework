import { relative } from "node:path";
import type { PluginComponentFile } from "../../../../shared/domain/plugin/plugin-distribution.js";
import { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import { PLUGIN_MCP_RELATIVE } from "../../domain/canon-format.js";
import type { PluginSource } from "../../ports/disk-sink-deps.js";

/** A plugin's canon as one distribution: every file under its folder, read once, as the
 * "/"-separated path inside the plugin. The build never reads the version, so none is claimed. */
export async function readPluginCanon(
  fs: FileReader,
  plugin: PluginSource,
  format: AiToolId
): Promise<PluginDistribution> {
  const files: PluginComponentFile[] = [];
  for (const absPath of await fs.listFilesRecursive(plugin.src)) {
    files.push({
      relativePath: relative(plugin.src, absPath).replace(/\\/g, "/"),
      content: await fs.readFile(absPath),
    });
  }
  const under = (dir: string) => files.filter((file) => file.relativePath.startsWith(`${dir}/`));
  return new PluginDistribution({
    manifest: { name: plugin.name, version: "" },
    format,
    files,
    components: {
      commands: under("commands"),
      agents: under("agents"),
      skills: under("skills"),
      rules: under("rules"),
      hooks: under("hooks"),
      mcp: files.filter((file) => file.relativePath === PLUGIN_MCP_RELATIVE),
    },
  });
}
