import type { ToolCategory, ToolId } from "../../../shared/domain/tool.js";
import type { ToolCatalog } from "../../tools/contract/tool-catalog.js";
import type { ManifestRepository } from "../ports/manifest-repository.js";

export interface ListInstalledToolsCommand {
  category: ToolCategory;
  tools: ToolCatalog;
}

/** The tools of one category the project has installed, in the catalog's manifest order. */
export class ListInstalledTools {
  constructor(private readonly manifestRepo: ManifestRepository) {}

  async execute(command: ListInstalledToolsCommand): Promise<ToolId[]> {
    const manifest = await this.manifestRepo.load();
    if (manifest === null) return [];
    const targets: readonly ToolId[] = command.tools.idsInCanonicalOrder(command.category);
    return manifest.getInstalledToolIds().filter((installed) => targets.includes(installed));
  }
}
