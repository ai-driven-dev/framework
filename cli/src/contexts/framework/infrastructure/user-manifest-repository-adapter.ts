import { mkdir, rm, rmdir } from "node:fs/promises";
import { dirname } from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import { userManifestPath } from "../../../kernel/paths.js";
import type { Manifest } from "../domain/manifest.js";
import type { ManifestRepository } from "../domain/ports/manifest-repository.js";
import { readManifestFile } from "./manifest-file-io.js";

/**
 * The user-scope counterpart of `ManifestRepositoryAdapter` — same schema, same version and refusal
 * rule, same file I/O. Only the path differs, and what a version-refusal message names to fix it.
 *
 * `delete()` removes only `manifest.json` itself, never its parent directory: `userConfigDir()`
 * also holds `auth.json`, `marketplaces.json`, `references.json` and `telemetry/`, none of which
 * this repository owns. Pruning it once empty, as the project adapter does with `.aidd/`, would be
 * a live bug here.
 */
export class UserManifestRepositoryAdapter implements ManifestRepository {
  constructor(
    private readonly userConfigDir: () => string,
    private readonly atomicWriter: (path: string, content: string) => Promise<void>
  ) {}

  get path(): string {
    return userManifestPath(this.userConfigDir());
  }

  async load(): Promise<Manifest | null> {
    return readManifestFile({
      path: this.path,
      location: "for this machine",
      reinstallCommand: "aidd setup --scope user",
    });
  }

  async save(manifest: Manifest): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await this.atomicWriter(this.path, JSON.stringify(manifest.toJSON(), null, 2));
  }

  async delete(): Promise<void> {
    await rm(this.path, { force: true });
  }

  async withExclusiveAccess<T>(action: () => Promise<T>): Promise<T> {
    const lock = `${this.path}.lock`;
    await mkdir(dirname(lock), { recursive: true });
    const deadline = Date.now() + 30_000;
    while (true) {
      try {
        await mkdir(lock);
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        if (Date.now() >= deadline) {
          throw new Error(
            `User manifest is busy: ${lock}. Retry after the other AIDD operation finishes.`
          );
        }
        await pause(100);
      }
    }
    try {
      return await action();
    } finally {
      await rmdir(lock);
    }
  }
}
