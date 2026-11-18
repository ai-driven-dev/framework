import { FileHash, InstallationFile } from "../../../../shared/domain/file.js";
import type { TranslatedFile } from "../../ports/plugin/plugin-translation.js";

/** Translation yields content; what an install tracks is its hash, taken here. */
export function hashOutputFiles(files: readonly TranslatedFile[]): InstallationFile[] {
  return files.map(
    ({ relativePath, content }) =>
      new InstallationFile({ relativePath, content, hash: FileHash.of(content) })
  );
}
