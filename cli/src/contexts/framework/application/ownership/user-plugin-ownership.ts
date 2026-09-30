import type { FileReader } from "../../../../kernel/ports/file-reader.js";
import type { AiToolId } from "../../../../kernel/tool.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";

/** Release only this project's claim; machine files remain until explicit user cleanup. */
export async function detachUserPlugin(
  repo: ManifestRepository | undefined,
  fs: FileReader,
  toolId: AiToolId,
  name: string,
  projectRoot: string
): Promise<void> {
  if (repo === undefined) return;
  if (repo.withExclusiveAccess !== undefined) {
    return repo.withExclusiveAccess(() =>
      detachUserPluginUnlocked(repo, fs, toolId, name, projectRoot)
    );
  }
  return detachUserPluginUnlocked(repo, fs, toolId, name, projectRoot);
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
