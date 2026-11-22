import { join } from "node:path";
import type { RegistrationRecordStore } from "../contexts/installation/ports/record/registration-records.js";
import {
  joinPluginClaims,
  splitPluginClaims,
} from "../contexts/machine-claims/domain/record-claims.js";
import { UserSourceReferencesAdapter } from "../contexts/machine-claims/infrastructure/user-source-references-adapter.js";
import type { PluginClaimsRepository } from "../contexts/machine-claims/ports/plugin-claims-repository.js";
import type { UserSourceReferences } from "../contexts/machine-claims/ports/user-source-references.js";
import {
  ToolKeyedJsonFile,
  type ToolKeyedJsonFileDeps,
} from "../shared/infrastructure/tool-keyed-json-file.js";
import type { FileReader } from "../shared/ports/file-reader.js";
import type { FileWriter } from "../shared/ports/file-writer.js";
import { registrationRecordFile } from "./host-registration.js";
import { userConfigDir } from "./user-config-dir.js";

export interface MachineClaimsDeps {
  userSourceReferences: UserSourceReferences;
}

/** Wires the machine-wide claims over the file system and the user directory. */
export function wireMachineClaims(fs: FileReader & FileWriter): MachineClaimsDeps {
  return { userSourceReferences: new UserSourceReferencesAdapter(fs, userConfigDir) };
}

/** One scope's records, kept in `dir` as two files: the host data host registration reads, and
 * the claims machine claims keeps on its refs. */
export function registrationRecordStore(
  dir: () => string,
  deps: ToolKeyedJsonFileDeps
): RegistrationRecordStore {
  const host = registrationRecordFile(dir, deps);
  const claims = pluginClaimsFile(dir, deps);
  return {
    load: async () => joinPluginClaims(await host.load(), await claims.load()),
    save: async (records) => {
      const split = splitPluginClaims(records);
      await host.save(split.host);
      await claims.save(split.claims);
    },
  };
}

/** Every tool's claims, in one file beside the manifest of its scope. */
function pluginClaimsFile(dir: () => string, deps: ToolKeyedJsonFileDeps): PluginClaimsRepository {
  return new ToolKeyedJsonFile(
    () => join(dir(), "plugin-claims.json"),
    deps,
    (claims) => claims
  );
}
