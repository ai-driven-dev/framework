import { PluginNotInMarketplaceError } from "../../../../shared/domain/errors.js";
import type { PluginSourceMatch } from "../../contract/plugin-source-match.js";
import { resolvePluginSourceFromMarketplace } from "../../domain/plugin-source-resolver.js";
import type { MarketplaceRegistry } from "../../ports/marketplace-registry.js";
import type { ResolveMarketplace } from "../resolve-marketplace.js";

export interface ResolvePluginSourceCommand {
  readonly pluginName: string;
  readonly projectRoot: string;
  /** Restricts the search to one registered marketplace. */
  readonly fromMarketplace?: string;
}

/** Finds every registered marketplace that catalogues a plugin and resolves where to fetch it. */
export class ResolvePluginSource {
  constructor(
    private readonly registry: MarketplaceRegistry,
    private readonly resolveMarketplace: Pick<ResolveMarketplace, "execute">
  ) {}

  async execute(command: ResolvePluginSourceCommand): Promise<PluginSourceMatch[]> {
    const all = await this.registry.list(command.projectRoot);
    const searched = command.fromMarketplace
      ? all.filter((m) => m.name === command.fromMarketplace)
      : all;
    const matches: PluginSourceMatch[] = [];
    for (const marketplace of searched) {
      const { catalog, localPath } = await this.resolveMarketplace.execute({
        marketplace,
        projectRoot: command.projectRoot,
      });
      if (!catalog) continue;
      for (const entry of catalog.plugins) {
        if (entry.name !== command.pluginName) continue;
        matches.push({
          marketplaceName: marketplace.name,
          githubMarketplace: marketplace.source.kind === "github",
          entry,
          source: resolvePluginSourceFromMarketplace(entry.source, marketplace, localPath),
        });
      }
    }
    if (matches.length === 0) throw new PluginNotInMarketplaceError(command.pluginName);
    return matches;
  }
}
