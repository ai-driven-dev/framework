import type { FileHash } from "../models/file.js";

export interface Hasher {
  hash(content: string): FileHash;
}
