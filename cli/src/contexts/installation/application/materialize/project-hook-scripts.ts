import { dirname, join } from "node:path";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { ProjectHooksLocation } from "../../../tools/contract/tool-vocabulary.js";
import { driftOf } from "../../domain/drift.js";
import { ProjectHooksEditedError } from "../../domain/installation.error.js";
import type { ProjectHooksProvenance } from "../../domain/plugins/plugin-entry.js";
import type { TranslatedFile } from "../../ports/plugin/plugin-translation.js";
import type { ProjectHooksGuard } from "../shared/assert-project-hooks-unchanged.use-case.js";

/** One delivery of a plugin's hooks to the destination its tool declares: the scripts arrive
 * already placed and rewritten by the translation, so this only puts them down. */
export interface HooksDelivery {
  readonly scripts: readonly TranslatedFile[];
  readonly projectRoot: string;
  readonly location: ProjectHooksLocation;
  readonly previous?: ProjectHooksProvenance;
  readonly guard: ProjectHooksGuard;
}

/** A hook script AIDD did not record writing is the user's: installing over it is refused. */
export async function assertScriptsNotUserOwned(
  fs: FileReader,
  { scripts, projectRoot, location, previous }: HooksDelivery
): Promise<void> {
  for (const { relativePath } of scripts) {
    if (previous?.scripts.has(relativePath) === true) continue;
    if (await fs.fileExists(join(projectRoot, relativePath))) {
      throw new Error(
        `${location.toolName} hook script '${relativePath}' is user-owned; install refused.`
      );
    }
  }
}

/** Copies each hook script beside the project's hooks file, returning the digest of what it wrote. */
export async function writeProjectHookScripts(
  fs: FileReader & FileWriter,
  { scripts, projectRoot }: HooksDelivery
): Promise<ReadonlyMap<string, string>> {
  const written = new Map<string, string>();
  for (const { relativePath, content } of scripts) {
    await fs.writeFile(join(projectRoot, relativePath), content);
    written.set(relativePath, (await fs.readFileHash(join(projectRoot, relativePath))).value);
  }
  return written;
}

/** Deletes the scripts a previous install recorded and this one no longer ships, unless edited. */
export async function removeObsoleteScripts(
  fs: FileReader & FileWriter,
  delivery: HooksDelivery,
  current: ReadonlyMap<string, string>
): Promise<void> {
  for (const [relativePath, digest] of delivery.previous?.scripts ?? []) {
    if (current.has(relativePath)) continue;
    const path = join(delivery.projectRoot, relativePath);
    if (!(await fs.fileExists(path))) continue;
    await assertUnedited(fs, delivery, { path, relativePath, digest });
    await fs.deleteFile(path);
    await fs.deleteEmptyDirectories(dirname(path));
  }
}

async function assertUnedited(
  fs: FileReader,
  { location, guard }: HooksDelivery,
  script: { path: string; relativePath: string; digest: string }
): Promise<void> {
  if (guard.overwriteEdited === true) return;
  if (driftOf(script.digest, await fs.readFileHash(script.path)) === "ok") return;
  throw new ProjectHooksEditedError(
    `${location.toolName} hook script '${script.relativePath}' was edited during reinstall; removal refused.`
  );
}
