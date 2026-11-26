import { readdir, rmdir } from "node:fs/promises";
import { join } from "node:path";
import { AIDD_DIR } from "../../../shared/domain/layout/aidd-layout.js";
import type { ManifestFileContext } from "../domain/manifest/assert-supported-version.js";
import { MANIFEST_FILENAME } from "../domain/project-layout.js";
import type { ManifestRepository } from "../ports/manifest-repository.js";
import { ManifestFile, type ManifestFileDeps } from "./manifest-file-io.js";

export class ManifestRepositoryAdapter extends ManifestFile implements ManifestRepository {
  constructor(
    private readonly projectRoot: string,
    deps: ManifestFileDeps
  ) {
    super(deps);
  }

  protected context(): ManifestFileContext {
    return {
      path: join(this.projectRoot, AIDD_DIR, MANIFEST_FILENAME),
      location: "in this project",
      scope: "project",
    };
  }

  /** Also removes `.aidd/` once nothing else is left in it. */
  override async delete(): Promise<void> {
    // biome-ignore lint/plugin: deleting a manifest must not fail an uninstall midway
    try {
      await super.delete();
    } catch {
      // No error if missing
    }

    const aiddDir = join(this.projectRoot, AIDD_DIR);
    // biome-ignore lint/plugin: removing the empty directory must not fail an uninstall midway
    try {
      const entries = await readdir(aiddDir);
      if (entries.length === 0) {
        await rmdir(aiddDir);
      }
    } catch {
      // No error if dir missing
    }
  }
}
