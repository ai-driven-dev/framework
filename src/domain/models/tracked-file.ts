import type { FileHash } from "./file-hash.js";

export interface TrackedFile {
  readonly relativePath: string;
  readonly hash: FileHash;
}
