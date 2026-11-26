import type {
  MachineManifest,
  MachineManifestRepository,
  MachineRecords,
  MachineUserPlugin,
} from "../../../../src/contexts/machine-claims/ports/machine-manifest.js";
import { ToolNotInManifestError } from "../../../../src/shared/domain/shared.error.js";
import type { AiToolId, ToolId } from "../../../../src/shared/domain/tool.js";
import type { Lock } from "../../../../src/shared/ports/lock.js";
import {
  InMemoryRepository,
  loadsOnlyUnderLock,
} from "../../../shared/testing/in-memory-repository.fake.js";

/** The machine-wide record as the real one answers it: a tool is written to only once the record
 * holds it. */
export class InMemoryMachineManifest implements MachineManifest {
  private readonly installedTools: ReadonlySet<ToolId>;
  private readonly plugins = new Map<string, MachineUserPlugin[]>();

  constructor(...installedTools: readonly ToolId[]) {
    this.installedTools = new Set(installedTools);
  }

  getRecordedPlugins(toolId: string): readonly MachineUserPlugin[] {
    return this.plugins.get(toolId) ?? [];
  }

  addPlugin(toolId: AiToolId, plugin: MachineUserPlugin): void {
    this.requireInstalled(toolId);
    this.plugins.set(toolId, [...this.getRecordedPlugins(toolId), plugin]);
  }

  updatePlugin(toolId: AiToolId, plugin: MachineUserPlugin): void {
    this.requireInstalled(toolId);
    this.plugins.set(
      toolId,
      this.getRecordedPlugins(toolId).map((held) =>
        held.plugin.name === plugin.plugin.name ? plugin : held
      )
    );
  }

  private requireInstalled(toolId: ToolId): void {
    if (!this.installedTools.has(toolId)) throw new ToolNotInManifestError(toolId);
  }
}

export class InMemoryMachineManifestRepository
  extends InMemoryRepository<InMemoryMachineManifest>
  implements MachineManifestRepository
{
  /** The records as last saved. A test seeds them here and reads them back here. */
  records: MachineRecords;
  /** Counted apart from `saveCount`: a test proving nothing was written asserts both. */
  recordSaveCount = 0;

  constructor(seed: InMemoryMachineManifest | null = null, records: MachineRecords = new Map()) {
    super(seed);
    this.records = new Map(records);
  }

  async loadRecords(): Promise<MachineRecords> {
    return new Map(this.records);
  }

  async saveRecords(records: MachineRecords): Promise<void> {
    this.recordSaveCount += 1;
    this.records = new Map(records);
  }
}

/** The repository, failing any `load` made outside its `withExclusiveAccess`. */
export function loadingOnlyUnderLock(
  repo: InMemoryMachineManifestRepository
): MachineManifestRepository & Lock {
  return {
    ...loadsOnlyUnderLock(repo),
    save: (manifest: InMemoryMachineManifest) => repo.save(manifest),
    loadRecords: () => repo.loadRecords(),
    saveRecords: (records) => repo.saveRecords(records),
  };
}
