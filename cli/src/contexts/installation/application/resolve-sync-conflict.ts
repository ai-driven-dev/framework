import type { FileReader } from "../../../shared/ports/file-reader.js";
import { driftOf } from "../domain/manifest/drift.js";

export interface ResolveSyncConflictRequest {
  readonly diskTargetPath: string;
  readonly targetRelativePath: string;
  readonly targetManifestMap: ReadonlyMap<string, { value: string }>;
}

/** Decides a conflict, never prompts: recording one is the caller's. */
export class ResolveSyncConflict {
  constructor(private readonly fs: FileReader) {}

  /** Whether the file on disk was changed since the manifest recorded it; a missing file was not. */
  async execute({
    diskTargetPath,
    targetRelativePath,
    targetManifestMap,
  }: ResolveSyncConflictRequest): Promise<boolean> {
    if (!(await this.fs.fileExists(diskTargetPath))) return false;
    const diskTargetHash = await this.fs.readFileHash(diskTargetPath);
    const targetManifestHash = targetManifestMap.get(targetRelativePath);
    return (
      targetManifestHash !== undefined &&
      driftOf(targetManifestHash.value, diskTargetHash) === "modified"
    );
  }
}
