import type { ToolId } from "../../../shared/domain/tool.js";
import type { NativeRegistrations } from "../domain/manifest/native-registrations.js";
import type { NativeHostTool } from "./tool-sections.js";

/** A tool's recorded registration the machine clean withdraws from its host. */
export interface UserRegistrationWithdrawal {
  readonly tool: NativeHostTool;
  readonly registrations: NativeRegistrations;
  readonly cacheRoot: string | undefined;
  /** The refs a machine claim owns for this tool. */
  readonly claimedRefs: readonly string[];
}

/** What the user manifest and the cache say before anything is removed. */
export interface UserScopeInspection {
  manifestFound: boolean;
  toolIds: readonly ToolId[];
  activePluginDependents: readonly string[];
  /** Every version directory found under `userConfigDir()/cache/built/` read structurally,
   * never trusted from any one tool's own manifest entry. */
  builtVersions: readonly string[];
  referencingProjects: readonly string[];
}

/** What a machine-scope purge reads and removes on the machine itself. */
export interface MachineStatePurge {
  /** Every version directory found under the user config directory's built cache, read
   * structurally and never trusted from any one tool's own manifest entry. */
  builtVersions(): Promise<readonly string[]>;
  /** Removes the whitelisted machine state. */
  purge(): Promise<void>;
}

/** The machine-scope half of a user clean: inspect, prove, then purge, under the manifest's lock. */
export interface UserScopePurge {
  /** Runs `action` holding the user manifest's lock. */
  exclusive<T>(action: () => Promise<T>): Promise<T>;
  inspect(referencingProjects: () => Promise<readonly string[]>): Promise<UserScopeInspection>;
  /** Refuses while a user-scope file escapes its boundary, then answers the host registrations
   * this machine recorded. */
  proveWithdrawals(): Promise<UserRegistrationWithdrawal[]>;
  purge(projectRoot: string): Promise<void>;
  deleteManifest(): Promise<void>;
  /** Refuses when anything still depends on what a purge would remove. */
  assertNothingDepends(inspection: UserScopeInspection): void;
}
