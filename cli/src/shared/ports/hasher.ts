import type { FileHash } from "../domain/file.js";

export interface Hasher {
  hash(content: string): FileHash;
}
