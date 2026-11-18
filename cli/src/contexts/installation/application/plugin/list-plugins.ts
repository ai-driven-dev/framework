import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { Manifest } from "../../domain/manifest.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import { requireManifest } from "../shared/require-manifest.js";
import { resolvePluginToolIds } from "./plugin-target-resolution.js";

export interface ListPluginsCommand {
  toolIds: AiToolId[] | "all";
}

export type ListPluginsResult = Map<AiToolId, readonly InstalledPlugin[]>;

export class ListPlugins {
  constructor(
    private readonly manifestRepo: ManifestRepository,
    private readonly tools: ToolCatalog
  ) {}

  async execute(options: ListPluginsCommand): Promise<ListPluginsResult> {
    const manifest = await requireManifest(this.manifestRepo);
    const resolvedToolIds = resolvePluginToolIds(options.toolIds, manifest, this.tools);
    return this.buildResult(resolvedToolIds, manifest);
  }

  private buildResult(toolIds: AiToolId[], manifest: Manifest): ListPluginsResult {
    const result: ListPluginsResult = new Map();
    for (const toolId of toolIds) {
      result.set(toolId, manifest.getPlugins(toolId));
    }
    return result;
  }
}
