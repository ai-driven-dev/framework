import { PrivateStorageAdapter } from "../../../src/shared/infrastructure/filesystem/private-storage-adapter.js";
import type { PrivateStorage } from "../../../src/shared/ports/private-storage.js";

/** Storage whose `n`-th replace fails, as a crash between two writes would leave it. */
export class FailingStorage implements PrivateStorage {
  private readonly inner = new PrivateStorageAdapter();
  private calls = 0;
  constructor(private readonly failAt: number) {}
  ensureDirectory(path: string): Promise<void> {
    return this.inner.ensureDirectory(path);
  }
  async replace(path: string, content: string): Promise<void> {
    this.calls += 1;
    if (this.calls === this.failAt) throw new Error("disk full");
    await this.inner.replace(path, content);
  }
  append(path: string, content: string): Promise<void> {
    return this.inner.append(path, content);
  }
}
