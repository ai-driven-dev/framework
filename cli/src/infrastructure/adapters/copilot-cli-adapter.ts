import { AbstractNativePluginCliAdapter } from "./abstract-native-plugin-cli-adapter.js";

/**
 * Activates plugins through the `copilot` CLI. A project-local
 * `.github/copilot/settings.json` only surfaces plugins as recommendations
 * (enabledPlugins does not auto-install — github/copilot-cli#2249); the actual
 * load comes from `copilot plugin install`, which populates `~/.copilot/`.
 */
export class CopilotCliAdapter extends AbstractNativePluginCliAdapter {
  protected readonly binary = "copilot";

  upgradeMarketplaces(): void {
    this.run(["plugin", "marketplace", "update"], "marketplace update");
  }

  enablePlugin(pluginRef: string): void {
    this.run(["plugin", "install", pluginRef], `plugin install ${pluginRef}`);
  }
}
