import { join } from "node:path";
import type { InstallationFile } from "../../../../../shared/domain/installation-file.js";
import type { FileReader } from "../../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../../shared/ports/file-writer.js";
import type { PluginBase } from "./delete-plugin-files.js";
import { removeObsoletePluginFiles } from "./remove-obsolete-plugin-files.js";

export async function writePluginFiles(
  files: InstallationFile[],
  baseDir: string,
  fs: FileWriter
): Promise<void> {
  await Promise.all(files.map((f) => fs.writeFile(join(baseDir, f.relativePath), f.content)));
}

/** What placing a plugin reads and writes on disk. */
export type PluginFilesystem = FileReader & FileWriter;

/** Writes a plugin's files, then removes what the previous install recorded and these no longer ship. */
export async function replacePluginFiles(
  placed: {
    readonly files: InstallationFile[];
    readonly base: PluginBase;
    readonly previous: ReadonlyMap<string, string> | undefined;
  },
  fs: PluginFilesystem
): Promise<void> {
  const { files, base, previous } = placed;
  await writePluginFiles(files, base.dir, fs);
  await removeObsoletePluginFiles(fs, previous ?? new Map(), {
    current: new Set(files.map((f) => f.relativePath)),
    base,
  });
}
