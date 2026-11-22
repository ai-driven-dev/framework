import { join } from "node:path";
import type { InstallationFile } from "../../../../../shared/domain/installation-file.js";
import type { FileWriter } from "../../../../../shared/ports/file-writer.js";

export async function writePluginFiles(
  files: InstallationFile[],
  baseDir: string,
  fs: FileWriter
): Promise<void> {
  await Promise.all(files.map((f) => fs.writeFile(join(baseDir, f.relativePath), f.content)));
}
