import { join } from "node:path";
import type { InstallationFile } from "../../../domain/models/file.js";
import type { Manifest } from "../../../domain/models/manifest.js";
import type { AiToolId } from "../../../domain/models/tool-ids.js";
import { AI_TOOL_IDS } from "../../../domain/models/tool-ids.js";
import type { FileWriter } from "../../../domain/ports/file-writer.js";
import type { ManifestRepository } from "../../../domain/ports/manifest-repository.js";
import { NoManifestError } from "../../errors.js";

export function resolvePluginToolIds(toolIds: AiToolId[] | "all", manifest: Manifest): AiToolId[] {
  if (toolIds !== "all") return toolIds;
  return AI_TOOL_IDS.filter((id) => manifest.hasTool(id)) as AiToolId[];
}

export async function loadPluginManifest(manifestRepo: ManifestRepository): Promise<Manifest> {
  const manifest = await manifestRepo.load();
  if (manifest === null) throw new NoManifestError();
  return manifest;
}

export async function writePluginFiles(
  files: InstallationFile[],
  baseDir: string,
  fs: FileWriter
): Promise<void> {
  await Promise.all(files.map((f) => fs.writeFile(join(baseDir, f.relativePath), f.content)));
}
