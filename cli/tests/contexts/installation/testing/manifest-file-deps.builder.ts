import { registrationRecordStore } from "../../../../src/composition/contexts/machine-claims.js";
import type { ManifestFileDeps } from "../../../../src/contexts/installation/infrastructure/manifest-file-io.js";
import { atomicWriteFile } from "../../../../src/shared/infrastructure/atomic-write.js";
import type { AtomicWrite } from "../../../../src/shared/ports/file-writer.js";
import { resolveRegisteredToolId } from "../../../shared/testing/registered-tools.builder.js";

/** A manifest adapter's real dependencies, its records kept in `recordDir`. A test replacing the
 * writer replaces it for the manifest and the records alike. */
export function manifestFileDeps(
  recordDir: () => string,
  atomicWriter: AtomicWrite = atomicWriteFile
): ManifestFileDeps {
  const files = { atomicWriter, resolveToolId: resolveRegisteredToolId };
  return { ...files, records: registrationRecordStore(recordDir, files) };
}
