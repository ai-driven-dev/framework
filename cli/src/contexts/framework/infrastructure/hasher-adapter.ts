import { createHash } from "node:crypto";
import { FileHash } from "../../../shared/domain/file.js";
import type { Hasher } from "../../../shared/ports/hasher.js";

export class HasherAdapter implements Hasher {
  hash(content: string): FileHash {
    const hex = createHash("md5").update(content).digest("hex");
    return new FileHash(hex);
  }
}
