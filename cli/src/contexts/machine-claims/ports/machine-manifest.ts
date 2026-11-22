import type { AiToolId, ToolId } from "../../../shared/domain/tool.js";

/** What the machine-wide record keeps of one tool's host registration. The claims block is read
 * by machine-claims alone; whatever else the record holds travels through a rewrite untouched. */
export type MachineNativeRegistrations = Readonly<Record<string, unknown>>;

/** A user-scope plugin the machine-wide record holds, as far as a claim over it needs to know. */
export interface MachineUserPlugin {
  readonly plugin: { readonly name: string; readonly scope: string };
  /** The claim on its files, as the record keeps it: only machine claims read it. */
  readonly machineClaim?: unknown;
  withMachineClaim(machineClaim: unknown): MachineUserPlugin;
}

/** The machine-wide record, narrowed to what the claims read and rewrite. The installation owns
 * the record and hands over the real one, which satisfies this shape. */
export interface MachineManifest {
  getNativeRegistrations(toolId: ToolId): MachineNativeRegistrations | undefined;
  setNativeRegistrations(toolId: ToolId, registrations: MachineNativeRegistrations): void;
  getRecordedPlugins(toolId: string): readonly MachineUserPlugin[];
  updatePlugin(toolId: AiToolId, plugin: MachineUserPlugin): void;
}

export interface MachineManifestRepository<M extends MachineManifest = MachineManifest> {
  load(): Promise<M | null>;
  save(manifest: M): Promise<void>;
}

/** The machine-wide record as a run's claims grow it: a tool the project tracks joins it. */
export interface ClaimingMachineManifest extends MachineManifest {
  hasTool(toolId: ToolId): boolean;
  addTool(toolId: ToolId, version: string, files: []): void;
}

/** The machine-wide record as an add hands it a plugin: recorded again, or recorded new. */
export interface OwnershipMachineManifest extends ClaimingMachineManifest {
  withPlugin(toolId: AiToolId, plugin: MachineUserPlugin): void;
}

/** A plugin a project hands to the machine: recorded there as it is, without its entry provenance. */
export interface UserPluginToClaim extends MachineUserPlugin {
  withMcpEntries(entries: ReadonlyMap<string, string>): MachineUserPlugin;
}

/** A plugin's recorded files, as far as the user-scope containment proof needs them. `P` is the
 * caller's own plugin type: a rewrite hands back the same kind it was given. */
export interface UserScopePluginFiles<P> {
  readonly name: string;
  readonly files: ReadonlyMap<string, string>;
  withFiles(files: ReadonlyMap<string, string>): P;
}
