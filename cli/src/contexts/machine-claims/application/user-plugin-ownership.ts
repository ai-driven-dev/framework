import type { AiToolId } from "../../../shared/domain/tool.js";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { Lock } from "../../../shared/ports/lock.js";
import type { MachineManifestRepository } from "../ports/machine-manifest.js";

/** Release only this project's claim; global files remain until explicit user cleanup. */
export async function detachUserPlugin(request: {
  readonly repo: (MachineManifestRepository & Lock) | undefined;
  readonly fs: FileReader;
  readonly toolId: AiToolId;
  readonly name: string;
  readonly projectRoot: string;
}): Promise<void> {
  const { repo } = request;
  if (repo === undefined) return;
  return repo.withExclusiveAccess(() => detachUserPluginUnlocked({ ...request, repo }));
}

async function detachUserPluginUnlocked(request: {
  readonly repo: MachineManifestRepository;
  readonly fs: FileReader;
  readonly toolId: AiToolId;
  readonly name: string;
  readonly projectRoot: string;
}): Promise<void> {
  const { repo, fs, toolId, name, projectRoot } = request;
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
