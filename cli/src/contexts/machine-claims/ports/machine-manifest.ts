import type { AiToolId, ToolId } from "../../../shared/domain/tool.js";

/** One plugin ref the machine-wide record claims, with the projects that still need it. */
export interface MachinePluginClaim {
  readonly ref: string;
  readonly dependents: readonly string[];
}

/** What the machine-wide record keeps of one tool's host registration, as far as a claim over
 * it needs to read. Whatever else the record holds travels through a rewrite untouched. */
export interface MachineNativeRegistrations {
  readonly pluginClaims?: readonly MachinePluginClaim[];
}

/** A user-scope plugin the machine-wide record holds, as far as a claim over it needs to know. */
export interface MachineUserPlugin {
  readonly name: string;
  readonly scope: string;
  readonly dependents: readonly string[];
  withDependents(dependents: readonly string[]): MachineUserPlugin;
}

/** The machine-wide record, narrowed to what the claims read and rewrite. The installation owns
 * the record and hands over the real one, which satisfies this shape. */
export interface MachineManifest {
  getNativeRegistrations(toolId: ToolId): MachineNativeRegistrations | undefined;
  setNativeRegistrations(toolId: ToolId, registrations: MachineNativeRegistrations): void;
  getPlugins(toolId: string): readonly MachineUserPlugin[];
  updatePlugin(toolId: AiToolId, plugin: MachineUserPlugin): void;
}

export interface MachineManifestRepository {
  load(): Promise<MachineManifest | null>;
  save(manifest: MachineManifest): Promise<void>;
}

/** A plugin's recorded files, as far as the user-scope containment proof needs them. `P` is the
 * caller's own plugin type: a rewrite hands back the same kind it was given. */
export interface UserScopePluginFiles<P> {
  readonly name: string;
  readonly files: ReadonlyMap<string, string>;
  withFiles(files: ReadonlyMap<string, string>): P;
}
