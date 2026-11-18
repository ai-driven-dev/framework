import { FileHash } from "../domain/file.js";
import type { Hasher } from "../ports/hasher.js";

export class HasherAdapter implements Hasher {
  hash(content: string): FileHash {
    return FileHash.of(content);
  }
}
