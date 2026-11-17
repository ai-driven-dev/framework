import { expect } from "vitest";
import type {
  MachineManifest,
  MachineManifestRepository,
  MachineNativeRegistrations,
  MachineUserPlugin,
} from "../../../../src/contexts/machine-claims/ports/machine-manifest.js";
import type { AiToolId, ToolId } from "../../../../src/shared/domain/tool.js";
import type { Lock } from "../../../../src/shared/ports/lock.js";

/** A registration as the record keeps it: the fields a claim reads, plus whatever else travels
 * through a rewrite untouched. */
type RecordedRegistrations = MachineNativeRegistrations & Readonly<Record<string, unknown>>;

export class InMemoryMachineManifest implements MachineManifest {
  private readonly registrations = new Map<ToolId, RecordedRegistrations>();
  private readonly plugins = new Map<string, MachineUserPlugin[]>();

  getNativeRegistrations(toolId: ToolId): RecordedRegistrations | undefined {
    return this.registrations.get(toolId);
  }

  setNativeRegistrations(toolId: ToolId, registrations: RecordedRegistrations): void {
    this.registrations.set(toolId, registrations);
  }

  getPlugins(toolId: string): readonly MachineUserPlugin[] {
    return this.plugins.get(toolId) ?? [];
  }

  addPlugin(toolId: AiToolId, plugin: MachineUserPlugin): void {
    this.plugins.set(toolId, [...this.getPlugins(toolId), plugin]);
  }

  updatePlugin(toolId: AiToolId, plugin: MachineUserPlugin): void {
    this.plugins.set(
      toolId,
      this.getPlugins(toolId).map((held) => (held.name === plugin.name ? plugin : held))
    );
  }
}

export class InMemoryMachineManifestRepository implements MachineManifestRepository, Lock {
  saveCount = 0;
  private manifest: InMemoryMachineManifest | null;

  constructor(seed: InMemoryMachineManifest | null = null) {
    this.manifest = seed;
  }

  async load(): Promise<InMemoryMachineManifest | null> {
    return this.manifest;
  }

  async save(manifest: InMemoryMachineManifest): Promise<void> {
    this.saveCount += 1;
    this.manifest = manifest;
  }

  withExclusiveAccess<T>(action: () => Promise<T>): Promise<T> {
    return action();
  }

  getCurrent(): InMemoryMachineManifest | null {
    return this.manifest;
  }
}

/** The repository, failing any `load` made outside its `withExclusiveAccess`. */
export function loadingOnlyUnderLock(
  repo: InMemoryMachineManifestRepository
): MachineManifestRepository & Lock {
  let entered = false;
  return {
    load: () => {
      expect(entered).toBe(true);
      return repo.load();
    },
    save(manifest: InMemoryMachineManifest) {
      return repo.save(manifest);
    },
    withExclusiveAccess: async (action) => {
      entered = true;
      try {
        return await action();
      } finally {
        entered = false;
      }
    },
  };
}
