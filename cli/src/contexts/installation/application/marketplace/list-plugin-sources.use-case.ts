import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { PluginSource } from "../../contract/plugin-sources.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";

/** The installed plugins that name a marketplace, by tool in the catalog's order. */
export class ListPluginSources {
  constructor(
    private readonly manifestRepo: ManifestRepository,
    private readonly tools: ToolCatalog
  ) {}

  async execute(): Promise<readonly PluginSource[]> {
    const manifest = await this.manifestRepo.load();
    if (manifest === null) return [];
    const sources: PluginSource[] = [];
    for (const toolId of this.tools.idsInCanonicalOrder("ai")) {
      for (const plugin of manifest.getPlugins(toolId)) {
        if (plugin.marketplace === undefined) continue;
        sources.push({ toolId, plugin: plugin.name, marketplace: plugin.marketplace });
      }
    }
    return sources;
  }
}
