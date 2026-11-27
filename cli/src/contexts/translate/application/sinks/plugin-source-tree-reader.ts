import { posixRelative } from "../../../../shared/domain/paths.model.js";
import { PLUGIN_MCP_RELATIVE } from "../../../../shared/domain/plugin/canon-paths.js";
import type { PluginComponentFile } from "../../../../shared/domain/plugin/plugin-distribution.js";
import { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { CanonSource, PluginSource } from "../../ports/disk-sink-deps.js";

/** A plugin's canon as one distribution: every file under its folder, read once, as the
 * "/"-separated path inside the plugin. The build never reads the version, so none is claimed. */
export async function readPluginCanon(
  fs: FileReader,
  plugin: PluginSource,
  { format, platform }: CanonSource
): Promise<PluginDistribution> {
  const files: PluginComponentFile[] = [];
  for (const absPath of await fs.listFilesRecursive(plugin.src)) {
    files.push({
      relativePath: posixRelative(plugin.src, absPath, platform),
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
