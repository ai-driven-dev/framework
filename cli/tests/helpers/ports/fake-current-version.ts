import type { VersionReader } from "../../../src/shared/ports/version-reader.js";

export class FakeCurrentVersion implements VersionReader {
  constructor(private readonly version: string = "0.0.0-test") {}

  get(): string {
    return this.version;
  }
}
