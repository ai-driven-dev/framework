import { join } from "node:path";
import { whenAbsent } from "../../../../shared/domain/reading/json-file.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { AddPluginRequest } from "./add-plugin-request.js";

/** Lists the plugin's rules glob in the file a tool reads its guidance from, for a tool with no
 * rules folder of its own; nothing for a plugin that placed no rule. Refuses a file whose block a
 * person broke, before the plugin's files are written. */
export async function listPlacedRules(
  fs: FileReader & FileWriter,
  { tool, projectRoot }: Pick<AddPluginRequest, "tool" | "projectRoot">,
  rulesGlob: string | null
): Promise<void> {
  const index = tool.flatRulesIndex();
  if (index === null || rulesGlob === null) return;
  const path = join(projectRoot, index.relativePath);
  const existing = await whenAbsent(() => fs.readFile(path), null);
  const content = index.withGlob(existing, rulesGlob);
  if (content !== existing) await fs.writeFile(path, content);
}
