import type { ToolId } from "../../../shared/domain/tool.js";
import type { UserRegistrationWithdrawal } from "./native-host.js";

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

/** The machine-scope half of a user clean: inspect, prove, then purge, under the manifest's lock. */
export interface UserScopePurge {
  /** Runs `action` holding the user manifest's lock. */
  exclusive<T>(action: () => Promise<T>): Promise<T>;
  inspect(referencingProjects: () => Promise<readonly string[]>): Promise<UserScopeInspection>;
  /** Refuses while a user-scope file escapes its boundary, then answers the host registrations
   * this machine recorded. */
  proveWithdrawals(): Promise<UserRegistrationWithdrawal[]>;
  purge(projectRoot: string): Promise<void>;
  /** Refuses when anything still depends on what a purge would remove. */
  assertNothingDepends(inspection: UserScopeInspection): void;
}
