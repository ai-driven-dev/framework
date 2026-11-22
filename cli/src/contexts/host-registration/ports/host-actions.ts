import type { Scope } from "../../../shared/domain/scope.js";
import type { NativeRefusal } from "../domain/native-refusal.js";

/** What a call into the host's own CLI answers: `undefined` when it ran to completion, else the
 * refusal naming why not. Returned, never thrown: a caller that lets it travel says so with
 * `throwRefusal`. */
export type HostRefusal = NativeRefusal | undefined;

/**
 * Drives a tool's native plugin CLI, so the tool writes its own configuration.
 *
 * What each tool delegates differs: Codex and Copilot load plugins only from user-global state
 * their own `plugin` subcommands populate, and Claude enables plugins through its own `install`
 * verb, so all three drive both steps. Implementations shell out to the binary declared by
 * `NativeActivation.binary`.
 */
export interface HostActions {
  /** Returns true when the tool's CLI binary is callable on PATH. Never throws. */
  isAvailable(): boolean;
  /** Registers a marketplace source (local path, `owner/repo[@ref]`, or git URL). Idempotent. */
  addMarketplace(source: string, scope: Scope): HostRefusal;
  /** Unregisters a marketplace by name, in the scope it was added to. Refuses when absent. */
  removeMarketplace(name: string, scope: Scope, options?: { force?: boolean }): HostRefusal;
  /** Whether the registration under this name still resolves to something. `"unknown"` where
   * the tool offers no way to tell, which callers must read as "leave it alone": a registration
   * that might belong to a live project elsewhere is not one to take over. */
  registrationState(name: string): "live" | "dead" | "unknown";
  upgradeMarketplaces(name: string): HostRefusal;
  /**
   * Installs and enables a plugin referenced as `<plugin>@<marketplace>`. Idempotent.
   *
   * `scope` is not where the marketplace registration lives but at what scope *this* plugin is
   * enabled: `"project"` by default, mapping to claude's own `--scope local`. Omitting the
   * argument entirely makes a real `claude` binary choose its own `"user"` default,
   * machine-wide, whatever scope `aidd` ran at. A tool declaring no `scopeArgs` (codex,
   * copilot) ignores it.
   */
  enablePlugin(pluginRef: string, scope?: Scope): HostRefusal;
  updatePlugin(pluginRef: string): HostRefusal;
  /**
   * Uninstalls a plugin referenced as `<plugin>@<marketplace>`, the counterpart of
   * {@link enablePlugin}. Refuses when the plugin is already absent from the tool's own
   * registry; callers treat it best-effort. `scope` must match the scope it was enabled at: a
   * real `claude` binary refuses a mismatched-scope uninstall outright.
   */
  uninstallPlugin(pluginRef: string, scope?: Scope): HostRefusal;
}
