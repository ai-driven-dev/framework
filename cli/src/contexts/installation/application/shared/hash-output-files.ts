import { InstallationFile } from "../../../../shared/domain/file.js";
import type { Hasher } from "../../../../shared/ports/hasher.js";
import type { OutputFile } from "../../../translate/contract/output-file.js";

/** Translation yields content; what an install tracks is its hash, taken here. */
export function hashOutputFiles(files: readonly OutputFile[], hasher: Hasher): InstallationFile[] {
  return files.map(
    ({ relativePath, content }) =>
      new InstallationFile({ relativePath, content, hash: hasher.hash(content) })
  );
}
