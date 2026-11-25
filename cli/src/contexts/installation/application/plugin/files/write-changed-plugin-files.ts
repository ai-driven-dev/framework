import { join } from "node:path";
import type { InstallationFile } from "../../../../../shared/domain/installation-file.js";
import type { FileReader } from "../../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../../shared/ports/file-writer.js";
import { isPluginFileAtDesiredState } from "./check-plugin-file-state.js";

/**
 * Writes the files under `baseDir` and returns how many it wrote. Skips a file already matching
 * its content on disk, so a no-op restore reports (and performs) zero writes.
 */
export async function writeChangedPluginFiles(
  fs: FileReader & FileWriter,
  files: readonly InstallationFile[],
  baseDir: string
): Promise<number> {
  let written = 0;
  for (const file of files) {
    const outputPath = join(baseDir, file.relativePath);
    if (await isPluginFileAtDesiredState(fs, outputPath, file.hash.value)) continue;
    await fs.writeFile(outputPath, file.content);
    written++;
  }
  return written;
}
