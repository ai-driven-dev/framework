import type { Manifest } from "../../../domain/manifest.js";
import type { RecordedPlugin } from "../../../domain/plugins/recorded-plugin.js";
import type { EnabledPluginsSection, PluginPlacement } from "../../../ports/tool-sections.js";
import type { TrackedSharedSettings } from "../../sync/tracked-shared-settings.js";

/** The new content of a parsed shared settings file without a plugin's entry, null when it held none. */
export type WithoutEnabledPlugin = (
  shared: Record<string, unknown>,
  enabledPluginsKey: string | null,
  plugin: { readonly name: string; readonly marketplace: string }
) => Record<string, unknown> | null;

export interface RemoveEnabledPluginRequest {
  readonly plugin: RecordedPlugin;
  readonly tool: PluginPlacement & EnabledPluginsSection;
  readonly projectRoot: string;
  readonly manifest: Manifest;
}

/** Takes the entry that enabled a plugin out of the settings file its tool shares with its host. */
export class RemoveEnabledPlugin {
  constructor(
    private readonly tracked: TrackedSharedSettings,
    private readonly without: WithoutEnabledPlugin
  ) {}

  async execute(request: RemoveEnabledPluginRequest): Promise<void> {
    const { plugin, tool, projectRoot, manifest } = request;
    const settings = tool.marketplaceRegistration();
    if (settings === null || plugin.marketplace === undefined) return;
    const path = settings.sharedSettingsFile();
    const rest = this.without(
      await this.tracked.read(projectRoot, path),
      settings.enabledPluginsKey(),
      { name: plugin.plugin.name, marketplace: plugin.marketplace }
    );
    if (rest === null) return;
    await this.tracked.write({ projectRoot, path, manifest, toolId: tool.toolId }, rest);
  }
}
