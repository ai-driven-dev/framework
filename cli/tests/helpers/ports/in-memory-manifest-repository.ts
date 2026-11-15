import { expect } from "vitest";
import type { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import type { ManifestRepository } from "../../../src/contexts/installation/ports/manifest-repository.js";
import type { Lock } from "../../../src/shared/ports/lock.js";

export class InMemoryManifestRepository implements ManifestRepository, Lock {
  /** Derived from the root the test drives the use case with, never a fixed literal: a
   * double naming a fictional file lets a diagnostic go wrong with every test still green. */
  readonly path: string;
  saveCount = 0;
  private manifest: Manifest | null;

  constructor(seed: Manifest | null = null, projectRoot = "/test-project") {
    this.manifest = seed;
    this.path = `${projectRoot}/.aidd/manifest.json`;
  }

  async load(): Promise<Manifest | null> {
    return this.manifest;
  }

  async save(manifest: Manifest): Promise<void> {
    this.saveCount += 1;
    this.manifest = manifest;
  }

  async delete(): Promise<void> {
    this.manifest = null;
  }

  withExclusiveAccess<T>(action: () => Promise<T>): Promise<T> {
    return action();
  }

  getCurrent(): Manifest | null {
    return this.manifest;
  }
}

/** The repository, failing any `load` made outside its `withExclusiveAccess`. */
export function loadingOnlyUnderLock(repo: InMemoryManifestRepository): ManifestRepository & Lock {
  let entered = false;
  return {
    path: repo.path,
    load: () => {
      expect(entered).toBe(true);
      return repo.load();
    },
    save: (manifest) => repo.save(manifest),
    delete: () => repo.delete(),
    withExclusiveAccess: async (action) => {
      entered = true;
      try {
        return await action();
      } finally {
        entered = false;
      }
    },
  };
}
