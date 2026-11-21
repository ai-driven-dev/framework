import { UserSourceReferencesAdapter } from "../contexts/machine-claims/infrastructure/user-source-references-adapter.js";
import type { UserSourceReferences } from "../contexts/machine-claims/ports/user-source-references.js";
import type { FileReader } from "../shared/ports/file-reader.js";
import type { FileWriter } from "../shared/ports/file-writer.js";

export interface MachineClaimsDeps {
  userSourceReferences: UserSourceReferences;
}

/** Wires the machine-wide claims over the file system and the user directory. */
export function wireMachineClaims(
  fs: FileReader & FileWriter,
  userConfigDir: () => string
): MachineClaimsDeps {
  return { userSourceReferences: new UserSourceReferencesAdapter(fs, userConfigDir) };
}
