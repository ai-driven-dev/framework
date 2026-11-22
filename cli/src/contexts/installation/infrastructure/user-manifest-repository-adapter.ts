import type { ManifestFileContext } from "../domain/manifest/assert-supported-version.js";
import { userManifestPath } from "../domain/project-layout.js";
import type { ManifestRepository } from "../ports/manifest-repository.js";
import { ManifestFile, type ManifestFileDeps } from "./manifest-file-io.js";

/**
 * The user-scope counterpart of `ManifestRepositoryAdapter`: same schema, same version and refusal
 * rule, same file I/O. Only the path differs, and what a version-refusal message names to fix it.
 *
 * `delete()` removes only `manifest.json` and the record files beside it, never their parent
 * directory: `userConfigDir()` also holds `auth.json`, `marketplaces.json`, and `references.json`,
 * none of which this repository owns. Pruning it once empty, as the project adapter does with `.aidd/`, would be
 * a live bug here.
 */
export class UserManifestRepositoryAdapter extends ManifestFile implements ManifestRepository {
  constructor(
    private readonly userConfigDir: () => string,
    deps: ManifestFileDeps
  ) {
    super(deps);
  }

  protected context(): ManifestFileContext {
    return {
      path: userManifestPath(this.userConfigDir()),
      location: "for this machine",
      scope: "user",
    };
  }
}
