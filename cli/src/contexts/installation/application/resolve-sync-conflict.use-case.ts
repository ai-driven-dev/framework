import type { FileHash } from "../../../shared/domain/file-hash.js";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import { isSyncConflict } from "../domain/sync-conflict.model.js";

export interface ResolveSyncConflictRequest {
  readonly diskPath: string;
  /** The hash the manifest recorded for the file, none when it never recorded it. */
  readonly recorded: FileHash | undefined;
}

/** Decides a conflict, never prompts: recording one is the caller's. */
export class ResolveSyncConflict {
  constructor(private readonly fs: FileReader) {}

  /** Reads the file on disk and says whether it was changed since the manifest recorded it. */
  async execute({ diskPath, recorded }: ResolveSyncConflictRequest): Promise<boolean> {
    const onDisk = (await this.fs.fileExists(diskPath))
      ? await this.fs.readFileHash(diskPath)
      : null;
    return isSyncConflict(recorded, onDisk);
  }
}
