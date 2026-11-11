import { CapabilityConfigError } from "../../../../kernel/errors.js";

/** One variable, as the caller reads it: a profile is a declaration and reaches no global. */
export type EnvironmentReader = (name: string) => string | undefined;

/**
 * A tool that writes its own marketplace registration, through its own CLI: driving the
 * command is preferred to writing the file, so the tool owns its own configuration.
 * `binary` keys the matching `NativePluginActivator`.
 */
export interface NativeActivationSpec {
  binary: "claude" | "codex" | "copilot";
  /** One mapping serves add and remove: a remove omitting the scope the add used drops
   * Claude's declaration from every scope at once. A project-scoped marketplace maps to
   * Claude's *local* scope — the registration names an absolute path, wrong for everyone
   * else in the shared project settings. Omit where the registry has no scopes. */
  scopeArgs?: Readonly<Record<"project" | "user", readonly string[]>>;
  /** Scope arguments `plugin marketplace remove` takes at user scope instead of
   * `scopeArgs.user` when no project uses the marketplace, run from the home directory.
   * Measured on Claude 2.1.318: `remove --scope user` drops the settings declaration and keeps
   * the registration and a project's install; a remove naming no scope deletes the registration
   * and uninstalls that project's plugins too, with their saved options. */
  userRemoveArgs?: readonly string[];
  /** The host keeps an uninstalled plugin's ref, disabled, so a disabled ref cannot be told
   * from one the person disabled and is not taken for a plugin in use. */
  uninstallLeavesRefDisabled?: boolean;
  /** Arguments that make `plugin marketplace remove` succeed with plugins installed from it.
   * Permits reclaiming a name, so declare it only alongside `sourceCheckVerb`. */
  forceRemoveArgs?: readonly string[];
  /** Verb after `plugin marketplace` whose exit code separates a registration whose source
   * is gone from one that resolves. Measured: copilot's `update` discriminates, while
   * codex's `upgrade` refuses every local marketplace and Claude's reports success on a
   * path that does not exist. */
  sourceCheckVerb?: string;
  /** Verb this CLI uses to re-index its marketplaces, after `plugin marketplace`. Omit when
   * plugins are not enabled through the CLI. */
  upgradeVerb?: string;
  /** Exact host command for updating one installed plugin ref. Copilot declares `update`; Codex does not. */
  updateVerb?: string;
  /** Verb this CLI uses to enable a plugin, after `plugin`. */
  enableVerb: string;
  /** How the tool spells removing a plugin it installed: `remove` for codex, `uninstall` for
   * claude and copilot. */
  disableVerb: string;
  /** Arguments every `plugin <verb> <ref>` call carries, after the reference. Claude needs
   * `--yes` on install and uninstall alike: a headless stdin can answer no prompt. */
  pluginArgs?: readonly string[];
  /** Root of this tool's own marketplace registry, given a homedir — a root, not a
   * per-marketplace path. Declared for Claude alone, which derives a registration's name
   * from the source's own catalog and silently repoints a same-named entry from a different
   * source; its absence is what keeps the guard reading it claude-only. */
  marketplaceRegistry?: (homedir: string) => string;
  /** Root of this tool's own plugin cache, given a homedir. Declared only where the host's
   * own CLI leaves something behind after `clean` drove its uninstall and remove: claude
   * keeps the whole built tree, marked `.orphaned_at`; codex the empty `cache/<hostName>/`
   * shell. `clean` reads this declaration alone and invents no path for a tool that omits
   * it, and never removes without `realpath` containment against this root. */
  pluginCacheDir?: (homedir: string) => string;
  /** This tool's own user-scope settings file, never written by aidd and read by a
   * diagnostic alone. Declared only for a tool that also declares `NativeActivation`. */
  userSettingsPath?: (homedir: string, env: EnvironmentReader) => string;
}

export class NativeActivation implements NativeActivationSpec {
  readonly binary: NativeActivationSpec["binary"];
  readonly enableVerb: NativeActivationSpec["enableVerb"];
  readonly disableVerb: NativeActivationSpec["disableVerb"];
  declare readonly scopeArgs?: NativeActivationSpec["scopeArgs"];
  declare readonly userRemoveArgs?: NativeActivationSpec["userRemoveArgs"];
  declare readonly uninstallLeavesRefDisabled?: NativeActivationSpec["uninstallLeavesRefDisabled"];
  declare readonly forceRemoveArgs?: NativeActivationSpec["forceRemoveArgs"];
  declare readonly sourceCheckVerb?: NativeActivationSpec["sourceCheckVerb"];
  declare readonly upgradeVerb?: NativeActivationSpec["upgradeVerb"];
  declare readonly updateVerb?: NativeActivationSpec["updateVerb"];
  declare readonly pluginArgs?: NativeActivationSpec["pluginArgs"];
  declare readonly marketplaceRegistry?: NativeActivationSpec["marketplaceRegistry"];
  declare readonly pluginCacheDir?: NativeActivationSpec["pluginCacheDir"];
  declare readonly userSettingsPath?: NativeActivationSpec["userSettingsPath"];

  constructor(spec: NativeActivationSpec) {
    if (spec.binary.trim() === "") {
      throw new CapabilityConfigError("NativeActivation requires a binary.");
    }
    this.binary = spec.binary;
    this.enableVerb = spec.enableVerb;
    this.disableVerb = spec.disableVerb;
    Object.assign(this, spec);
  }
}
