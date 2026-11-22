import { join } from "node:path";
import { whenAbsent } from "../../../../shared/domain/reading/json-file.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import { assertProjectPathWithinRoot } from "../ownership/project-path-boundary.js";
import type { ProjectMcpRemoval } from "./remove-project-plugin.js";

/** Takes a plugin's MCP servers out of the tool's project config, when it has any there. */
export async function removeFlatMcpEntries(
  fs: FileReader & FileWriter,
  removal: ProjectMcpRemoval
): Promise<void> {
  const { plugin, tool, projectRoot } = removal;
  if (plugin.provenance.mcpEntries.size === 0) return;
  const mcpCap = tool.flatPluginMcp();
  if (mcpCap === null) return;
  const outputRelPath = await mcpCap.resolveOutputPath((relativePath) =>
    fs.fileExists(join(projectRoot, relativePath))
  );
  const outputPath = join(projectRoot, outputRelPath);
  const existing = await readExistingJson(fs, outputPath);
  if (existing === null) return;
  const updated = mcpCap.removePluginServers(existing, plugin.provenance.mcpEntries);
  await assertProjectPathWithinRoot(fs, projectRoot, outputPath);
  await fs.writeFile(outputPath, updated);
}

async function readExistingJson(fs: FileReader, path: string): Promise<string | null> {
  return whenAbsent(() => fs.readFile(path), null);
}
