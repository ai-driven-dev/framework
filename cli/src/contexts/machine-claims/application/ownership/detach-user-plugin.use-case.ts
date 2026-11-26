import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { Lock } from "../../../../shared/ports/lock.js";
import { readHeldClaims, withoutPluginDependent } from "../../domain/plugin-claim.model.js";
import type { MachineManifestRepository } from "../../ports/machine-manifest.js";

interface UserPluginDetachment {
  readonly toolId: AiToolId;
  readonly name: string;
  readonly projectRoot: string;
}

export class DetachUserPlugin {
  constructor(
    private readonly repo: (MachineManifestRepository & Lock) | undefined,
    private readonly fs: FileReader
  ) {}

  /** Release only this project's claim; global files remain until explicit user cleanup. */
  async execute(request: UserPluginDetachment): Promise<void> {
    const { repo } = this;
    if (repo === undefined) return;
    return repo.withExclusiveAccess(() => this.release(repo, request));
  }

  private async release(
    repo: MachineManifestRepository,
    { toolId, name, projectRoot }: UserPluginDetachment
  ): Promise<void> {
    const manifest = await repo.load();
    if (manifest === null) return;
    const plugin = manifest.getRecordedPlugins(toolId).find((p) => p.plugin.name === name);
    if (plugin === undefined || plugin.plugin.scope !== "user") return;
    const root = await this.fs.realpath(projectRoot);
    const records = await repo.loadRecords();
    const held = records.get(toolId);
    const released = withoutPluginDependent(readHeldClaims(held?.pluginClaims), name, root);
    if (!released.changed) return;
    await repo.saveRecords(
      new Map(records).set(toolId, { ...held, pluginClaims: released.claims })
    );
  }
}
