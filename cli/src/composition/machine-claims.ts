import { UserSourceReferencesAdapter } from "../contexts/machine-claims/infrastructure/user-source-references-adapter.js";
import { userConfigDir } from "../shared/infrastructure/user-config-dir.js";
import type { FileReader } from "../shared/ports/file-reader.js";
import type { FileWriter } from "../shared/ports/file-writer.js";

/** What the machine-wide claims read and write. It depends only on the file system and the user
 * directory, so it is built ahead of every use case that reads a shared-source claim. */
export function wireMachineClaims(fs: FileReader & FileWriter) {
  return { userSourceReferences: new UserSourceReferencesAdapter(fs, userConfigDir) };
}
