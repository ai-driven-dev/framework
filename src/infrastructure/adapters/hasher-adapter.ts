import { createHash } from "node:crypto";
import { FileHash } from "../../domain/models/file-hash.js";
import type { Hasher } from "../../domain/ports/hasher.js";

export class HasherAdapter implements Hasher {
  hash(content: string): FileHash {
    const hex = createHash("md5").update(content, "utf-8").digest("hex");
    return new FileHash(hex);
  }
}
