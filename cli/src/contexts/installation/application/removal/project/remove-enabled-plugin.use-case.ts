import type { Manifest } from "../../../domain/manifest.js";
import type { RecordedPlugin } from "../../../domain/plugins/recorded-plugin.js";
import type { EnabledPluginsSection, PluginPlacement } from "../../../ports/tool-sections.js";
import type { TrackedSharedSettings } from "../../sync/tracked-shared-settings.js";

/** The new content of a parsed shared settings file without one enabled entry, null when it held none. */
export type WithoutEnabledPlugin = (
  shared: Record<string, unknown>,
  enabledPluginsKey: string | null,
  entry: string
) => Record<string, unknown> | null;

/** The entry that enabled a plugin, as its tool wrote it, given the ref the host recorded for it. */
export type EnabledEntryOf = (
  settings: { requiresNativeProof(): boolean },
  plugin: { readonly name: string; readonly marketplace: string },
  hostRef: string | undefined
) => string | undefined;

export interface RemoveEnabledPluginRequest {
  readonly plugin: RecordedPlugin;
  readonly tool: PluginPlacement & EnabledPluginsSection;
  readonly projectRoot: string;
  readonly manifest: Manifest;
  /** The ref the host recorded for the plugin, when it recorded one. */
  readonly hostRef?: string;
}

/** Takes the entry that enabled a plugin out of the settings file its tool shares with its host. */
export class RemoveEnabledPlugin {
  constructor(
    private readonly tracked: TrackedSharedSettings,
    private readonly without: WithoutEnabledPlugin,
    private readonly entryOf: EnabledEntryOf
  ) {}

  async execute(request: RemoveEnabledPluginRequest): Promise<void> {
    const { plugin, tool, projectRoot, manifest, hostRef } = request;
    const settings = tool.marketplaceRegistration();
    if (settings === null || plugin.marketplace === undefined) return;
    const entry = this.entryOf(
      settings,
      { name: plugin.plugin.name, marketplace: plugin.marketplace },
      hostRef
    );
    if (entry === undefined) return;
    const path = settings.sharedSettingsFile();
    const rest = this.without(
      await this.tracked.readQuietly(projectRoot, path),
      settings.enabledPluginsKey(),
      entry
    );
    if (rest === null) return;
    await this.tracked.write({ projectRoot, path, manifest, toolId: tool.toolId }, rest);
  }
}
