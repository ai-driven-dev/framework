import type { ToolCatalog } from "../../tools/contract/tool-catalog.js";
import type { PluginSource } from "../contract/plugin-sources.js";
import type { ManifestRepository } from "../ports/manifest-repository.js";

export interface ListPluginSourcesCommand {
  tools: ToolCatalog;
}

/** The installed plugins that name a marketplace, by tool in the catalog's order. */
export class ListPluginSources {
  constructor(private readonly manifestRepo: ManifestRepository) {}

  async execute(command: ListPluginSourcesCommand): Promise<readonly PluginSource[]> {
    const manifest = await this.manifestRepo.load();
    if (manifest === null) return [];
    const sources: PluginSource[] = [];
    for (const toolId of command.tools.idsInCanonicalOrder("ai")) {
      for (const plugin of manifest.getPlugins(toolId)) {
        if (plugin.marketplace === undefined) continue;
        sources.push({ toolId, plugin: plugin.name, marketplace: plugin.marketplace });
      }
    }
    return sources;
  }
}
