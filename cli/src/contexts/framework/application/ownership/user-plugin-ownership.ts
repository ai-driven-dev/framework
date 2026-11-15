import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { Lock } from "../../../../shared/ports/lock.js";
import type { ManifestRepository } from "../../../installation/ports/manifest-repository.js";

/** Release only this project's claim; global files remain until explicit user cleanup. */
export async function detachUserPlugin(
  repo: (ManifestRepository & Lock) | undefined,
  fs: FileReader,
  toolId: AiToolId,
  name: string,
  projectRoot: string
): Promise<void> {
  if (repo === undefined) return;
  return repo.withExclusiveAccess(() =>
    detachUserPluginUnlocked(repo, fs, toolId, name, projectRoot)
  );
}

async function detachUserPluginUnlocked(
  repo: ManifestRepository,
  fs: FileReader,
  toolId: AiToolId,
  name: string,
  projectRoot: string
): Promise<void> {
  const manifest = await repo.load();
  if (manifest === null) return;
  const plugin = manifest.getPlugins(toolId).find((p) => p.name === name);
  if (plugin === undefined || plugin.scope !== "user") return;
  const root = await fs.realpath(projectRoot);
  if (!plugin.dependents.includes(root)) return;
  manifest.updatePlugin(
    toolId,
    plugin.withDependents(plugin.dependents.filter((dependent) => dependent !== root))
  );
  await repo.save(manifest);
}
