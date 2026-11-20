import { readdir, rm, rmdir } from "node:fs/promises";
import { join } from "node:path";
import { AIDD_DIR } from "../../../shared/domain/layout/aidd-layout.js";
import type { ToolIdResolver } from "../../../shared/domain/tool.js";
import type { Manifest } from "../domain/manifest.js";
import { MANIFEST_FILENAME } from "../domain/project-layout.js";
import type { ManifestRepository } from "../ports/manifest-repository.js";
import { readManifestFile, writeManifestFile } from "./manifest-file-io.js";

export class ManifestRepositoryAdapter implements ManifestRepository {
  constructor(
    private readonly projectRoot: string,
    private readonly resolveToolId: ToolIdResolver
  ) {}

  get path(): string {
    return join(this.projectRoot, AIDD_DIR, MANIFEST_FILENAME);
  }

  private get aiddDir(): string {
    return join(this.projectRoot, AIDD_DIR);
  }

  async load(): Promise<Manifest | null> {
    return readManifestFile(
      {
        path: this.path,
        location: "in this project",
        reinstallCommand: "aidd setup",
      },
      this.resolveToolId
    );
  }

  async save(manifest: Manifest): Promise<void> {
    await writeManifestFile(this.path, manifest);
  }

  async delete(): Promise<void> {
    // biome-ignore lint/plugin: deleting a manifest must not fail an uninstall midway
    try {
      await rm(this.path, { force: true });
    } catch {
      // No error if missing
    }

    // biome-ignore lint/plugin: removing the empty directory must not fail an uninstall midway
    try {
      const entries = await readdir(this.aiddDir);
      if (entries.length === 0) {
        await rmdir(this.aiddDir);
      }
    } catch {
      // No error if dir missing
    }
  }
}
