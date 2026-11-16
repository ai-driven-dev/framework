import { InstallationFile } from "../../../../shared/domain/file.js";
import type { Hasher } from "../../../../shared/ports/hasher.js";
import type { TranslatedFile } from "../../ports/plugin/plugin-translation.js";

/** Translation yields content; what an install tracks is its hash, taken here. */
export function hashOutputFiles(
  files: readonly TranslatedFile[],
  hasher: Hasher
): InstallationFile[] {
  return files.map(
    ({ relativePath, content }) =>
      new InstallationFile({ relativePath, content, hash: hasher.hash(content) })
  );
}
