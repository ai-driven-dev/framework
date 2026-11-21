import { createHash } from "node:crypto";
import { ManifestValidationError } from "./errors/manifest-validation-error.js";

const MD5_PATTERN = /^[0-9a-f]{32}$/;

export class FileHash {
  readonly value: string;

  /** The md5 of `content`, the hash every recorded content digest is compared against. */
  static of(content: string): FileHash {
    return new FileHash(createHash("md5").update(content).digest("hex"));
  }

  /** Whether `value` is shaped like an md5 digest, without building one. */
  static isDigest(value: string): boolean {
    return MD5_PATTERN.test(value);
  }

  constructor(value: string) {
    if (!FileHash.isDigest(value)) {
      throw new ManifestValidationError(
        `Invalid MD5 hash: "${value}". Expected 32 lowercase hex characters.`
      );
    }
    this.value = value;
  }

  equals(other: FileHash): boolean {
    return this.value === other.value;
  }
}
