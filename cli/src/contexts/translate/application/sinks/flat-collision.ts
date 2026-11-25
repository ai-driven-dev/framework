import type { FileReader } from "../../../../shared/ports/file-reader.js";
import { FlatTargetExistsError } from "../../contract/translate.error.js";
import type { FlatTarget } from "../../ports/flat-plugin-writer.js";

/** A file a flat build is about to write, for one plugin of one target. */
export interface FlatDestination {
  readonly target: FlatTarget;
  readonly destPath: string;
  readonly pluginName: string;
}

/** Refuses a destination a first build already wrote, unless the build is forced. */
export async function assertFlatDestinationFree(
  fs: FileReader,
  { target, destPath, pluginName }: FlatDestination
): Promise<void> {
  if (!target.force && (await fs.fileExists(destPath))) {
    throw new FlatTargetExistsError(destPath, pluginName);
  }
}
