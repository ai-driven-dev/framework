import { join } from "node:path";
import type { ManifestRepository } from "../contexts/installation/ports/manifest-repository.js";
import type {
  RecordsBesideManifest,
  RegistrationRecordStore,
  RegistrationRecords,
} from "../contexts/installation/ports/record/registration-records.js";
import {
  joinPluginClaims,
  splitPluginClaims,
} from "../contexts/machine-claims/domain/plugin-claim.model.js";
import { UserScopeLockAdapter } from "../contexts/machine-claims/infrastructure/lock.js";
import { UserSourceReferencesAdapter } from "../contexts/machine-claims/infrastructure/user-source-references-adapter.js";
import type { PluginClaimsRepository } from "../contexts/machine-claims/ports/plugin-claims-repository.js";
import type { UserSourceReferences } from "../contexts/machine-claims/ports/user-source-references.js";
import {
  ToolKeyedJsonFile,
  type ToolKeyedJsonFileDeps,
} from "../shared/infrastructure/tool-keyed-json-file.js";
import type { FileReader } from "../shared/ports/file-reader.js";
import type { FileWriter } from "../shared/ports/file-writer.js";
import type { Lock } from "../shared/ports/lock.js";
import { registrationRecordFile } from "./host-registration.js";
import { userConfigDir } from "./user-config-dir.js";

export interface MachineClaimsDeps {
  userSourceReferences: UserSourceReferences;
}

/** Wires the machine-wide claims over the file system and the user directory. */
export function wireMachineClaims(fs: FileReader & FileWriter): MachineClaimsDeps {
  return { userSourceReferences: new UserSourceReferencesAdapter(fs, userConfigDir) };
}

/** The user scope's repository, its mutations held one at a time across the machine by the lock
 * beside its file. */
export function heldByMachineLock<R extends { readonly path: string }>(repository: R): R & Lock {
  const lock = new UserScopeLockAdapter(() => `${repository.path}.lock`);
  return Object.assign(repository, {
    withExclusiveAccess: <T>(action: () => Promise<T>) => lock.withExclusiveAccess(action),
  });
}

/** A scope's repository with its records beside it. Each read or write of the records first
 * reads the manifest, which splits a v8 document, so neither reads nor writes over its records.
 * Takes no lock: a caller holding the machine lock reads them, and the lock is not re-entrant. */
export function withRecordsBeside<R extends ManifestRepository>(
  repository: R,
  records: RegistrationRecordStore
): R & RecordsBesideManifest {
  return Object.assign(repository, {
    loadRecords: async () => {
      await repository.loadIfReadable();
      return records.load();
    },
    saveRecords: async (saved: RegistrationRecords) => {
      await repository.loadIfReadable();
      await records.save(saved);
    },
  });
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
export function pluginClaimsFile(
  dir: () => string,
  deps: ToolKeyedJsonFileDeps
): PluginClaimsRepository {
  return new ToolKeyedJsonFile(
    () => join(dir(), "plugin-claims.json"),
    deps,
    (claims) => claims
  );
}
