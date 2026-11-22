import type { FileHash } from "../../../shared/domain/file-hash.js";
import { driftOf } from "./manifest/drift.js";

/** Whether the file on disk was changed since the manifest recorded it. A file the manifest
 * never recorded, or one no longer on disk (`null`), is no conflict. */
export function isSyncConflict(recorded: FileHash | undefined, onDisk: FileHash | null): boolean {
  return recorded !== undefined && driftOf(recorded.value, onDisk) === "modified";
}
