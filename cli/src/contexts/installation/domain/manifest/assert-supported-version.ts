import { AIDD_DIR } from "../../../../shared/domain/layout/aidd-layout.js";
import { InvalidManifestDataError } from "../installation.error.js";
import { MANIFEST_VERSION } from "../manifest-serialization.js";
import { MANIFEST_FILENAME } from "../project-layout.js";

// The project-scope default, named in the refusal below so a person can act on it without hunting
// for the path. A caller reading the user-scope manifest passes its own `ManifestFileContext`, so
// the refusal names the file actually on disk.
const MANIFEST_PATH_HINT = `${AIDD_DIR}/${MANIFEST_FILENAME}`;
export const DEFAULT_MANIFEST_CONTEXT: ManifestFileContext = {
  path: MANIFEST_PATH_HINT,
  location: "in this project",
  reinstallCommand: "aidd setup",
};

/**
 * What a version-refusal message names: the file on disk, in words fitting the sentence it lands
 * in, and the command that reinstalls once it is gone. `UserManifestRepositoryAdapter` passes its
 * own before reaching the guard, so a `--scope user` refusal never names the project's path.
 */
export interface ManifestFileContext {
  readonly path: string;
  readonly location: string;
  readonly reinstallCommand: string;
}

// This CLI reads exactly MANIFEST_VERSION and refuses every other one, naming a fix for each
// side. Too new means this CLI is behind, so `aidd update` is a real answer.
//
// Too old has none: no published CLI ever wrote v7's mandatory per-plugin `scope` or v8's
// host-name-beside-alias pair, and `load()` calls `fromJSON` before any command reaches a save,
// so every write path refuses an old document before it could overwrite it. Deleting the
// document is the only correction that does not pass back through this same guard.
export function assertSupportedManifestVersion(
  raw: Record<string, unknown>,
  context: ManifestFileContext
): void {
  const version = raw.version;
  if (version === MANIFEST_VERSION) return;
  if (typeof version === "number" && version > MANIFEST_VERSION) {
    throw new InvalidManifestDataError(
      `manifest version ${version} was written by a newer CLI than this one. Run \`aidd update\` to update this CLI, then try again.`
    );
  }
  // A v6 document is the one case admitting a remedy richer than deletion: 5.2.2's own manifest
  // reader accepts exactly version 6: measured against that published version: so its
  // `clean --force` can still run against this project before the manifest naming what it
  // registered is gone. 5.2.2 refuses a v7 document too, so naming it there would be a false
  // remedy. A v6 document is one the project repository ever produced, never the user-scope one.
  const remedy =
    version === 6
      ? "5.2.2, a published CLI, wrote this version. Before deleting it, run " +
        "`npx @ai-driven-dev/cli@5.2.2 clean --force` in this project so it unregisters " +
        "what it registered and clears its own cache — once the manifest naming those " +
        "is gone, nothing can drive that anymore. Then delete"
      : "No published CLI can write this version: delete";
  throw new InvalidManifestDataError(
    `manifest version ${String(version)} predates version ${MANIFEST_VERSION}, the only one this CLI reads. ` +
      `${remedy} ${context.path} ${context.location}, then run ` +
      `\`${context.reinstallCommand}\` to reinstall the framework.`
  );
}
