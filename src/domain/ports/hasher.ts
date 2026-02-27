import type { FileHash } from "../models/file-hash.js";

export interface Hasher {
  hash(content: string): FileHash;
}
