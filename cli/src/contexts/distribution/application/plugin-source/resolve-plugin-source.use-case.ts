import { PluginNotInMarketplaceError } from "../../contract/distribution.error.js";
import type { PluginSourceMatch } from "../../contract/plugin-source-match.js";
import type { Marketplace } from "../../domain/marketplace.js";
import { pluginSourceMatch } from "../../domain/plugin-source-resolver.js";
import type { MarketplaceRegistry } from "../../ports/marketplace-registry.js";
import type { ResolveMarketplace } from "../resolve-marketplace.use-case.js";

export interface ResolvePluginSourceRequest {
  readonly pluginName: string;
  readonly projectRoot: string;
  /** Restricts the search to one registered marketplace. */
  readonly fromMarketplace?: string;
}

/** Finds every registered marketplace that catalogues a plugin and resolves where to fetch it. */
export class ResolvePluginSource {
  constructor(
    private readonly registry: MarketplaceRegistry,
    private readonly resolveMarketplace: Pick<ResolveMarketplace, "execute">,
    private readonly platform: string
  ) {}

  async execute(command: ResolvePluginSourceRequest): Promise<PluginSourceMatch[]> {
    const all = await this.registry.list(command.projectRoot);
    const searched = command.fromMarketplace
      ? all.filter((m) => m.name === command.fromMarketplace)
      : all;
    const matches: PluginSourceMatch[] = [];
    for (const marketplace of searched) {
      matches.push(...(await this.matchesIn(marketplace, command)));
    }
    if (matches.length === 0) throw new PluginNotInMarketplaceError(command.pluginName);
    return matches;
  }

  private async matchesIn(
    marketplace: Marketplace,
    command: ResolvePluginSourceRequest
  ): Promise<PluginSourceMatch[]> {
    const { catalog, localPath } = await this.resolveMarketplace.execute({
      marketplace,
      projectRoot: command.projectRoot,
    });
    if (!catalog) return [];
    return catalog.plugins
      .filter((entry) => entry.name === command.pluginName)
      .map((entry) =>
        pluginSourceMatch(marketplace, { path: localPath, platform: this.platform }, entry)
      );
  }
}
