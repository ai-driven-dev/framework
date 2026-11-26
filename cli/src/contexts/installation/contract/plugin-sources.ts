import type { AiToolId } from "../../../shared/domain/tool.js";

/** An installed plugin and the marketplace it was installed from. */
export interface PluginSource {
  readonly toolId: AiToolId;
  readonly plugin: string;
  readonly marketplace: string;
}

/** The installed plugins of a marketplace whose catalog no longer names them. */
export function upstreamRemoved(
  installed: readonly PluginSource[],
  marketplace: string,
  listed: ReadonlySet<string>
): PluginSource[] {
  return installed.filter((s) => s.marketplace === marketplace && !listed.has(s.plugin));
}
