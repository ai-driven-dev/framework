const MD5_PATTERN = /^[0-9a-f]{32}$/;

export class FileHash {
  readonly value: string;

  constructor(value: string) {
    if (!MD5_PATTERN.test(value)) {
      throw new Error(`Invalid MD5 hash: "${value}". Expected 32 lowercase hex characters.`);
    }
    this.value = value;
  }

  equals(other: FileHash): boolean {
    return this.value === other.value;
  }
}
