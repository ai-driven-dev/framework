import { join } from "node:path";
import type { FileReader } from "../../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../../shared/ports/file-writer.js";
import { isPluginFileAtDesiredState } from "./check-plugin-file-state.js";
import { deleteOldFiles } from "./delete-plugin-files.js";

/** Deletes the files an earlier install of a plugin recorded and this one no longer ships, so a
 * file the user edited since is kept. */
export async function removeObsoletePluginFiles(
  fs: FileReader & FileWriter,
  previous: ReadonlyMap<string, string>,
  placed: { readonly current: ReadonlySet<string>; readonly baseDir: string }
): Promise<void> {
  const obsolete = new Map<string, string>();
  for (const [relativePath, hash] of previous) {
    if (placed.current.has(relativePath)) continue;
    if (await isPluginFileAtDesiredState(fs, join(placed.baseDir, relativePath), hash)) {
      obsolete.set(relativePath, hash);
    }
  }
  await deleteOldFiles(obsolete, placed.baseDir, fs);
}
