import type { PrivateStorage } from "../../../../src/shared/ports/private-storage.js";

/** A private storage that holds nothing and refuses every write with `error`. */
export class FailingPrivateStorage implements PrivateStorage {
  constructor(private readonly error: Error) {}

  async ensureDirectory(): Promise<void> {
    throw this.error;
  }

  async replace(): Promise<void> {
    throw this.error;
  }

  async read(): Promise<string | undefined> {
    return undefined;
  }

  async append(): Promise<void> {
    throw this.error;
  }
}
