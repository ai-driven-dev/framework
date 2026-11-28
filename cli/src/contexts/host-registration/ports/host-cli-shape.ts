import type { Scope } from "../../../shared/domain/scope.js";
import type { PluginListLayout } from "../contract/native-registration-spec.js";

/** Everything about a tool's plugin CLI that differs between tools, read off its profile. */
export interface HostCliShape {
  readonly scopeArgs?: Readonly<Record<Scope, readonly string[]>>;
  readonly userRemoveArgs?: readonly string[];
  readonly forceRemoveArgs?: readonly string[];
  readonly sourceCheckVerb?: string;
  readonly upgradeVerb?: string;
  readonly updateVerb?: string;
  readonly enableVerb?: string;
  /** How the tool spells removing a plugin it installed: `remove` for codex, `uninstall` for
   * claude and copilot. Absent where this CLI enables plugins through a file it writes. */
  readonly disableVerb?: string;
  /** Arguments every `plugin <verb> <ref>` call carries, after the reference. Claude needs
   * `--yes`: a headless stdin cannot answer its prune confirmation. */
  readonly pluginArgs?: readonly string[];
  readonly pluginListLayout?: PluginListLayout;
}
