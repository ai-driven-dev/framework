import type { ToolId } from "../../../shared/domain/tool.js";

/** A plugin the installation asked a tool's host to carry. `ref` is the `<plugin>@<marketplace>`
 * a registry is looked up by, absent exactly when no marketplace was recorded for the plugin. */
export interface RegisteredPlugin {
  readonly plugin: string;
  readonly ref?: string;
}

export interface RegisteredPluginsOfTool {
  readonly toolId: ToolId;
  readonly expectedPlugins: readonly RegisteredPlugin[];
}

/** What the installation asked each installed tool's host to carry, in install order. */
export interface RegisteredPlugins {
  readonly tools: readonly RegisteredPluginsOfTool[];
}
