import { FRAMEWORK_MARKETPLACE_NAME } from "../../contract/marketplace.js";
import type { PluginSourceMatch } from "../../contract/plugin-source-match.js";
import { resolvePluginSourceFromMarketplace } from "../../domain/plugin-source-resolver.js";
import type { MarketplaceRegistry } from "../../ports/marketplace-registry.js";
import type { ResolveMarketplace } from "../resolve-marketplace.js";

export interface ListFrameworkPluginsCommand {
  readonly projectRoot: string;
}

/** Every plugin the machine's shared framework source catalogues, with the source an installer can
 * fetch it from. Reads the user-scope registration alone: a project's own marketplace of the same
 * name is not this source. */
export class ListFrameworkPlugins {
  constructor(
    private readonly registry: Pick<MarketplaceRegistry, "list">,
    private readonly resolveMarketplace: Pick<ResolveMarketplace, "execute">
  ) {}

  async execute(command: ListFrameworkPluginsCommand): Promise<PluginSourceMatch[]> {
    const marketplace = (await this.registry.list(command.projectRoot)).find(
      (entry) => entry.name === FRAMEWORK_MARKETPLACE_NAME && entry.scope === "user"
    );
    if (marketplace === undefined) {
      throw new Error(
        "--global --plugins installs from the shared framework source, and none is registered; drop --no-default-marketplace."
      );
    }
    const { catalog, localPath } = await this.resolveMarketplace.execute({
      marketplace,
      projectRoot: command.projectRoot,
    });
    return (catalog?.plugins ?? []).map((entry) => ({
      marketplaceName: marketplace.name,
      githubMarketplace: marketplace.source.kind === "github",
      entry,
      source: resolvePluginSourceFromMarketplace(entry.source, marketplace, localPath),
    }));
  }
}
