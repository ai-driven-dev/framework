import { FileHash } from "../../../../../shared/domain/file-hash.js";
import type { FileReader } from "../../../../../shared/ports/file-reader.js";
import { driftOf } from "../../../domain/manifest/drift.js";

/** Whether the file already on disk matches the content we would write, so a caller can skip the
 * write and, more importantly, not count it as restored. */
export async function isPluginFileAtDesiredState(
  fs: FileReader,
  outputPath: string,
  expectedHashValue: string
): Promise<boolean> {
  if (!(await fs.fileExists(outputPath))) return false;
  const content = await fs.readFile(outputPath);
  return driftOf(expectedHashValue, FileHash.of(content)) === "ok";
}
