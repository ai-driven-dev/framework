import type { FileHash } from "./file-hash.js";

export enum ConflictType {
  None = "none",
  LocalModified = "local-modified",
  BothModified = "both-modified",
  DeletedLocally = "deleted-locally",
}

export interface ConflictEntry {
  readonly relativePath: string;
  readonly type: ConflictType;
}

export function classifyConflict(
  manifestHash: FileHash,
  diskHash: FileHash | undefined,
  newHash: FileHash
): ConflictType {
  if (diskHash === undefined) {
    return ConflictType.DeletedLocally;
  }

  const diskMatchesManifest = diskHash.equals(manifestHash);
  const newMatchesManifest = newHash.equals(manifestHash);

  if (diskMatchesManifest) {
    return ConflictType.None;
  }

  if (newMatchesManifest) {
    return ConflictType.LocalModified;
  }

  return ConflictType.BothModified;
}

export class ConflictSet {
  readonly conflicts: readonly ConflictEntry[];

  constructor(conflicts: ConflictEntry[]) {
    this.conflicts = [...conflicts];
  }

  hasConflicts(): boolean {
    return this.conflicts.some((c) => c.type !== ConflictType.None);
  }
}
