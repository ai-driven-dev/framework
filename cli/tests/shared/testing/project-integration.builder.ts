import { projectIntegrationOf } from "../../../src/composition/contexts/installation.js";
import { trackedSharedSettings } from "../../../src/contexts/installation/application/sync/tracked-shared-settings.js";
import type { FileReader } from "../../../src/shared/ports/file-reader.js";
import type { FileWriter } from "../../../src/shared/ports/file-writer.js";
import { CapturingLogger } from "./capturing-logger.fake.js";

/** The project integration over `fs`, its shared settings writer logging into a capture. */
export function projectIntegrationOver(fs: FileReader & FileWriter) {
  return projectIntegrationOf(fs, trackedSharedSettings({ fs, logger: new CapturingLogger() }));
}
