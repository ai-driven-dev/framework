/**
 * Drives the native `codex` CLI to register marketplaces and enable plugins.
 *
 * Codex only discovers plugins from its user-global config (`~/.codex/config.toml`)
 * plus its plugin cache (`~/.codex/plugins/cache/`). Both are populated by the
 * `codex plugin` subcommands — writing project-local files does not enable a plugin.
 * Implementations shell out to the `codex` binary.
 */
export interface CodexActivator {
  /** Returns true when the `codex` binary is callable on PATH. Never throws. */
  isAvailable(): boolean;
  /** Registers a marketplace source (local path, `owner/repo[@ref]`, or git URL). Idempotent. */
  addMarketplace(source: string): void;
  /** Refreshes git-backed marketplace snapshots so plugin installs pick up new versions. */
  upgradeMarketplaces(): void;
  /** Installs and enables a plugin referenced as `<plugin>@<marketplace>`. Idempotent. */
  enablePlugin(pluginRef: string): void;
}
