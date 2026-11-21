import { dirname, join } from "node:path";
import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { ProjectHooksLocation } from "../../../tools/contract/tool-vocabulary.js";
import { ProjectHooksEditedError } from "../../domain/installation.error.js";
import type { ProjectHooksProvenance } from "../../domain/plugins/plugin-entry.js";
import type { ProjectHooksGuard } from "../shared/assert-project-hooks-unchanged.js";

export const HOOKS_MANIFEST_PATH = "hooks/hooks.json";

/** One delivery of a plugin's hooks to the destination its tool declares. */
export interface HooksDelivery {
  readonly dist: PluginDistribution;
  readonly projectRoot: string;
  readonly location: ProjectHooksLocation;
  readonly previous?: ProjectHooksProvenance;
  readonly guard: ProjectHooksGuard;
}

/** A hook script AIDD did not record writing is the user's: installing over it is refused. */
export async function assertScriptsNotUserOwned(
  fs: FileReader,
  { dist, projectRoot, location, previous }: HooksDelivery
): Promise<void> {
  for (const file of dist.components.hooks) {
    if (file.relativePath === HOOKS_MANIFEST_PATH) continue;
    const relativePath = location.format.scriptPath(dist.manifest.name, file.relativePath);
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
  { dist, projectRoot, location }: HooksDelivery
): Promise<ReadonlyMap<string, string>> {
  const scripts = new Map<string, string>();
  for (const file of dist.components.hooks) {
    if (file.relativePath === HOOKS_MANIFEST_PATH) continue;
    const dest = location.format.scriptPath(dist.manifest.name, file.relativePath);
    await fs.writeFile(
      join(projectRoot, dest),
      location.hookScript(file.relativePath, file.content)
    );
    scripts.set(dest, (await fs.readFileHash(join(projectRoot, dest))).value);
  }
  return scripts;
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
  if ((await fs.readFileHash(script.path)).value === script.digest) return;
  throw new ProjectHooksEditedError(
    `${location.toolName} hook script '${script.relativePath}' was edited during reinstall; removal refused.`
  );
}
