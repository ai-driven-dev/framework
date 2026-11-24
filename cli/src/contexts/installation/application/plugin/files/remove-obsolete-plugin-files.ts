import { join } from "node:path";
import type { FileReader } from "../../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../../shared/ports/file-writer.js";
import { isPluginFileAtDesiredState } from "./check-plugin-file-state.js";
import { deleteOldFiles, type PluginBase } from "./delete-plugin-files.js";

/** Deletes the files an earlier install of a plugin recorded and this one no longer ships, so a
 * file the user edited since is kept. */
export async function removeObsoletePluginFiles(
  fs: FileReader & FileWriter,
  previous: ReadonlyMap<string, string>,
  placed: { readonly current: ReadonlySet<string>; readonly base: PluginBase }
): Promise<void> {
  const obsolete = new Map<string, string>();
  for (const [relativePath, hash] of previous) {
    if (placed.current.has(relativePath)) continue;
    if (await isPluginFileAtDesiredState(fs, join(placed.base.dir, relativePath), hash)) {
      obsolete.set(relativePath, hash);
    }
  }
  await deleteOldFiles(obsolete, placed.base, fs);
}
