import type {
  MachineManifest,
  MachineManifestRepository,
  MachineNativeRegistrations,
  MachineUserPlugin,
} from "../../../../src/contexts/machine-claims/ports/machine-manifest.js";
import { ToolNotInManifestError } from "../../../../src/shared/domain/errors.js";
import type { AiToolId, ToolId } from "../../../../src/shared/domain/tool.js";
import type { Lock } from "../../../../src/shared/ports/lock.js";
import {
  InMemoryRepository,
  loadsOnlyUnderLock,
} from "../../../shared/testing/in-memory-repository.js";

/** A registration as the record keeps it: the fields a claim reads, plus whatever else travels
 * through a rewrite untouched. */
type RecordedRegistrations = MachineNativeRegistrations & Readonly<Record<string, unknown>>;

/** The machine-wide record as the real one answers it: a tool is written to only once the record
 * holds it. */
export class InMemoryMachineManifest implements MachineManifest {
  private readonly installedTools: ReadonlySet<ToolId>;
  private readonly registrations = new Map<ToolId, RecordedRegistrations>();
  private readonly plugins = new Map<string, MachineUserPlugin[]>();

  constructor(...installedTools: readonly ToolId[]) {
    this.installedTools = new Set(installedTools);
  }

  getNativeRegistrations(toolId: ToolId): RecordedRegistrations | undefined {
    return this.registrations.get(toolId);
  }

  setNativeRegistrations(toolId: ToolId, registrations: RecordedRegistrations): void {
    this.requireInstalled(toolId);
    this.registrations.set(toolId, registrations);
  }

  getPlugins(toolId: string): readonly MachineUserPlugin[] {
    return this.plugins.get(toolId) ?? [];
  }

  addPlugin(toolId: AiToolId, plugin: MachineUserPlugin): void {
    this.requireInstalled(toolId);
    this.plugins.set(toolId, [...this.getPlugins(toolId), plugin]);
  }

  updatePlugin(toolId: AiToolId, plugin: MachineUserPlugin): void {
    this.requireInstalled(toolId);
    this.plugins.set(
      toolId,
      this.getPlugins(toolId).map((held) => (held.name === plugin.name ? plugin : held))
    );
  }

  private requireInstalled(toolId: ToolId): void {
    if (!this.installedTools.has(toolId)) throw new ToolNotInManifestError(toolId);
  }
}

export class InMemoryMachineManifestRepository
  extends InMemoryRepository<InMemoryMachineManifest>
  implements MachineManifestRepository {}

/** The repository, failing any `load` made outside its `withExclusiveAccess`. */
export function loadingOnlyUnderLock(
  repo: InMemoryMachineManifestRepository
): MachineManifestRepository & Lock {
  return {
    ...loadsOnlyUnderLock(repo),
    save: (manifest: InMemoryMachineManifest) => repo.save(manifest),
  };
}
