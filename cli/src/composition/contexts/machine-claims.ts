import { join } from "node:path";
import type { ManifestRepository } from "../../contexts/installation/ports/manifest-repository.js";
import type { UserScopeFileGuard } from "../../contexts/installation/ports/plugin/user-plugin-materialization.js";
import { AssertUserScopeWriteBoundary } from "../../contexts/machine-claims/application/ownership/assert-user-scope-write-boundary.use-case.js";
import { DetachNativePluginRefs } from "../../contexts/machine-claims/application/ownership/detach-native-plugin-refs.use-case.js";
import { DetachUserPlugin } from "../../contexts/machine-claims/application/ownership/detach-user-plugin.use-case.js";
import { IsMachineOwnedNativeRef } from "../../contexts/machine-claims/application/ownership/is-machine-owned-native-ref.use-case.js";
import { ResolveSafeUserScopeFiles } from "../../contexts/machine-claims/application/ownership/resolve-safe-user-scope-files.use-case.js";
import { OtherProjectsReferencing } from "../../contexts/machine-claims/application/shared-source/other-projects-referencing.use-case.js";
import { readSharedSourceClaim } from "../../contexts/machine-claims/application/shared-source/read-shared-source-claim.js";
import { ResolveReferenceRoot } from "../../contexts/machine-claims/application/shared-source/resolve-reference-root.use-case.js";
import {
  joinPluginClaims,
  splitPluginClaims,
} from "../../contexts/machine-claims/domain/plugin-claim.model.js";
import { LenientUserSourceReferences } from "../../contexts/machine-claims/infrastructure/lenient-user-source-references.js";
import { UserScopeLockAdapter } from "../../contexts/machine-claims/infrastructure/lock.js";
import { UserSourceReferencesAdapter } from "../../contexts/machine-claims/infrastructure/user-source-references-adapter.js";
import type {
  MachineManifestRepository,
  MachineRecords,
  ScopeRecordsRepository,
} from "../../contexts/machine-claims/ports/machine-manifest.js";
import type { PluginClaimsRepository } from "../../contexts/machine-claims/ports/plugin-claims-repository.js";
import type { UserSourceReferences } from "../../contexts/machine-claims/ports/user-source-references.js";
import { UnreadableUserSourceReferencesError } from "../../shared/domain/shared.error.js";
import type { ToolId } from "../../shared/domain/tool.js";
import {
  ToolKeyedJsonFile,
  type ToolKeyedJsonFileDeps,
} from "../../shared/infrastructure/tool-keyed-json-file.js";
import type { FileReader } from "../../shared/ports/file-reader.js";
import type { FileWriter } from "../../shared/ports/file-writer.js";
import type { Lock } from "../../shared/ports/lock.js";
import type { Logger } from "../../shared/ports/logger.js";
import { userConfigDir } from "../user-config-dir.js";
import { registrationRecordFile } from "./host-registration.js";

export interface MachineClaimsDeps {
  userSourceReferences: UserSourceReferences;
}

/** Wires the machine-wide claims over the file system and the user directory. */
export function wireMachineClaims(fs: FileReader & FileWriter): MachineClaimsDeps {
  return { userSourceReferences: new UserSourceReferencesAdapter(fs, userConfigDir) };
}

/** The files of a user-scope plugin safe to delete, read through the one use case that proves it. */
export function userScopeFilesSafeToDelete(
  reach: ConstructorParameters<typeof ResolveSafeUserScopeFiles>[0],
  plugin: Parameters<ResolveSafeUserScopeFiles["execute"]>[0],
  tool: Parameters<ResolveSafeUserScopeFiles["execute"]>[1]
) {
  return new ResolveSafeUserScopeFiles(reach).execute(plugin, tool);
}

// One writer for a machine-scope plugin's files, whether setup installs it or update rebuilds it.
export const userScopeFileGuard: UserScopeFileGuard = {
  safeToDelete: userScopeFilesSafeToDelete,
  assertWriteBoundary: (reach, tool, write) =>
    new AssertUserScopeWriteBoundary(reach).execute(tool, write),
};

/** The use cases that read and release the claims a project holds on the machine manifest. */
export function machineOwnership(
  repo: (MachineManifestRepository & Lock) | undefined,
  fs: FileReader
) {
  return {
    isMachineOwnedNativeRef: new IsMachineOwnedNativeRef(repo),
    detachNativePluginRefs: new DetachNativePluginRefs(repo, fs),
    detachUserPlugin: new DetachUserPlugin(repo, fs),
  };
}

/** The references a command they do not gate may use: an unreadable file warns and reads as absent. */
export function lenientSourceReferences(
  references: UserSourceReferences | undefined,
  logger: Logger
): UserSourceReferences | undefined {
  return references && new LenientUserSourceReferences(references, logger);
}

/**
 * This project's claim on the shared source, `undefined` when `references.json` cannot be read: a
 * help, not an authority, so it must never block the clean it does not gate, and the claim stays
 * unknown rather than read as held by no other project.
 */
export function readSharedSourceClaimLeniently(
  parts: Parameters<typeof readSharedSourceClaim>[0],
  logger: Logger
): ReturnType<typeof readSharedSourceClaim> {
  const read = readSharedSourceClaim(parts);
  return async (request) => {
    try {
      return await read(request);
    } catch (error) {
      if (!(error instanceof UnreadableUserSourceReferencesError)) throw error;
      logger.warn("", error);
      return undefined;
    }
  };
}

/** The reads of the shared source's references; the other-projects read is absent without the references. */
export function sharedSourceReads(parts: {
  fs: FileReader;
  platform: string;
  references?: UserSourceReferences;
}) {
  return {
    resolveReferenceRoot: new ResolveReferenceRoot(parts.fs),
    otherProjectsReferencing:
      parts.references === undefined
        ? undefined
        : new OtherProjectsReferencing(parts.references, parts.platform),
  };
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
  records: RecordStore
): R & ScopeRecordsRepository {
  return Object.assign(repository, {
    loadRecords: async () => {
      await repository.load();
      return records.load();
    },
    saveRecords: async (saved: MachineRecords) => {
      await repository.load();
      await records.save(saved);
    },
  });
}

/** Where one scope's records are kept. Saving none removes what was kept. */
interface RecordStore {
  load(): Promise<MachineRecords>;
  save(records: ReadonlyMap<ToolId, Readonly<Record<string, unknown>>>): Promise<void>;
}

/** One scope's records, kept in `dir` as two files: the host data host registration reads, and
 * the claims machine claims keeps on its refs. */
export function registrationRecordStore(
  dir: () => string,
  deps: ToolKeyedJsonFileDeps
): RecordStore {
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
