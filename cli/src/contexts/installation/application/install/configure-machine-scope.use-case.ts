import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { Lock } from "../../../../shared/ports/lock.js";
import type { VersionReader } from "../../../../shared/ports/version-reader.js";
import { Manifest } from "../../domain/manifest.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";

export interface ConfigureMachineScopeRequest<T> {
  readonly toolIds: readonly AiToolId[];
  /** Runs once the manifest holds the tools, still under the machine lock, told whether this run
   * created the manifest. Its result is the result of the whole configuration. */
  readonly whileHeld: (created: boolean) => Promise<T>;
}

/**
 * What a `--scope user` setup records in the machine manifest: the manifest itself, and a bare
 * entry per requested tool. Writes nothing under any project. Holds the machine lock for the whole
 * of what runs after it, so two runs never interleave their writes.
 */
export class ConfigureMachineScope {
  constructor(
    private readonly userManifestRepo: ManifestRepository & Lock,
    private readonly currentVersionProvider: VersionReader
  ) {}

  execute<T>({ toolIds, whileHeld }: ConfigureMachineScopeRequest<T>): Promise<T> {
    return this.userManifestRepo.withExclusiveAccess(async () => {
      const created = await this.initialize();
      await this.registerTools(toolIds);
      return whileHeld(created);
    });
  }

  /** Creates the machine manifest when there is none. True when it did. */
  private async initialize(): Promise<boolean> {
    const existing = await this.userManifestRepo.load();
    if (existing !== null) return false;
    await this.userManifestRepo.save(Manifest.create());
    return true;
  }

  /** Every requested AI tool gets a manifest entry with no files at all: the honest record of
   * "registered at user scope, nothing installed under any project": so tool selection has
   * something to iterate. A tool already present is left alone rather than reset. */
  private async registerTools(toolIds: readonly AiToolId[]): Promise<void> {
    const manifest = await this.userManifestRepo.load();
    if (manifest === null) return;
    const version = this.currentVersionProvider.get();
    let changed = false;
    for (const toolId of toolIds) {
      if (manifest.hasTool(toolId)) continue;
      manifest.addTool(toolId, version, []);
      changed = true;
    }
    if (changed) await this.userManifestRepo.save(manifest);
  }
}
