import { join } from "node:path";
import {
  AIDD_DIR,
  AIDD_MARKETPLACES_FILENAME,
} from "../../../../../shared/domain/layout/aidd-layout.js";
import type { FileReader } from "../../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../../shared/ports/file-writer.js";
import type { Logger } from "../../../../../shared/ports/logger.js";
import { AIDD_CONFIG_FILENAME, PLUGIN_CACHE_SUBDIR } from "../../../domain/project-layout.js";
import type { ManifestRepository } from "../../../ports/manifest-repository.js";

/** What removing AIDD's own state needs. */
export interface AiddStateRemoval {
  readonly fs: FileReader & FileWriter;
  readonly manifestRepo: ManifestRepository;
  readonly logger: Logger;
}

// `config.json` is a committed file clean did not write, so clean never
// removes it. Everything AIDD did write must go before the emptiness check, or its own presence
// blocks a removal that should happen, the registry `marketplace add` writes included.
export async function removeAiddState(
  { fs, manifestRepo, logger }: AiddStateRemoval,
  projectRoot: string
): Promise<void> {
  const aiddDir = join(projectRoot, AIDD_DIR);
  const configKept = await fs.fileExists(join(aiddDir, AIDD_CONFIG_FILENAME));

  await fs.deleteDirectory(join(aiddDir, "cache"));
  await fs.deleteDirectory(join(projectRoot, PLUGIN_CACHE_SUBDIR));
  await fs.deleteFile(join(aiddDir, AIDD_MARKETPLACES_FILENAME));
  await manifestRepo.delete();

  if (!(await fs.fileExists(aiddDir))) return;
  const remaining = await fs.listDirectory(aiddDir);
  if (remaining.length === 0) {
    await fs.deleteDirectory(aiddDir);
    return;
  }
  if (configKept) logger.info(`Kept ${AIDD_DIR}/${AIDD_CONFIG_FILENAME}`);
}
