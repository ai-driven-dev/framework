import type { MarketplaceScope } from "../../../shared/domain/scope.js";
import type { PluginSource } from "../../../shared/domain/source.js";

/** A marketplace a project or the machine registered, as far as an installation needs to know:
 * the name plugins are filed under, where it is fetched from, and the scope it lives at. */
export interface DeclaredMarketplace {
  readonly name: string;
  readonly source: PluginSource;
  readonly scope: MarketplaceScope;
}

/** A plugin chosen from a marketplace catalogue, as far as copying it reads it. The distribution
 * owns the catalogue and the caller hands over its matches, which satisfy this shape. */
export interface UserPluginChoice {
  readonly marketplaceName: string;
  readonly entry: {
    readonly name: string;
    readonly version?: string;
    readonly strict: boolean;
  };
  readonly source: PluginSource;
}

/** The marketplaces an installation reads, and the one it lets go of at a machine purge. The
 * distribution owns the registry and hands over the real one, which satisfies this shape. */
export interface InstallationMarketplaceRegistry {
  list(projectRoot: string): Promise<readonly DeclaredMarketplace[]>;
  delete(projectRoot: string, name: string, scope: MarketplaceScope): Promise<void>;
}

export interface PluginFetchOptions {
  forceRefresh?: boolean;
}

/** Brings a plugin's source to a local directory. The distribution owns the fetching and hands
 * over the real one, which satisfies this shape. */
export interface PluginFetcher {
  fetch(source: PluginSource, cacheDir: string, options?: PluginFetchOptions): Promise<string>;
}

/** Brings a marketplace to a local path and reads the version its catalog declares. The
 * distribution owns the resolution and hands over the real one, which satisfies this shape. */
export interface MarketplaceResolver {
  execute(options: {
    marketplace: DeclaredMarketplace;
    projectRoot: string;
    forceRefresh?: boolean;
  }): Promise<{ localPath: string; catalog: { readonly version?: string } | null }>;
}

/** Registers the machine-scope framework source again, from the source a caller carries. */
export interface FrameworkMarketplaceRegistrar {
  execute(options: { projectRoot: string; pluginSource?: PluginSource }): Promise<unknown>;
}
