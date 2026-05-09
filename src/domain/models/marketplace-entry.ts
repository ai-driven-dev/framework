import {
  InvalidMarketplaceNameError,
  InvalidMarketplaceScopeError,
  MarketplaceAlreadyRegisteredError,
} from "../errors.js";
import { MARKETPLACE_NAME_REGEX, type MarketplaceScope } from "./marketplace.js";
import { type PluginSource, parsePluginSource, serializePluginSource } from "./plugin-source.js";

export interface MarketplaceEntryData {
  name: string;
  source: Record<string, unknown>;
  scope: MarketplaceScope;
  lastRefreshAt?: string;
  version?: string;
}

export class MarketplaceEntry {
  readonly name: string;
  readonly source: PluginSource;
  readonly scope: MarketplaceScope;
  readonly lastRefreshAt?: string;
  readonly version?: string;

  private constructor(params: {
    name: string;
    source: PluginSource;
    scope: MarketplaceScope;
    lastRefreshAt?: string;
    version?: string;
  }) {
    this.name = params.name;
    this.source = params.source;
    this.scope = params.scope;
    this.lastRefreshAt = params.lastRefreshAt;
    this.version = params.version;
  }

  static create(params: {
    name: string;
    source: PluginSource;
    scope: MarketplaceScope;
  }): MarketplaceEntry {
    if (!MARKETPLACE_NAME_REGEX.test(params.name)) {
      throw new InvalidMarketplaceNameError(params.name);
    }
    if (params.scope !== "project" && params.scope !== "user") {
      throw new InvalidMarketplaceScopeError(String(params.scope));
    }
    return new MarketplaceEntry(params);
  }

  static deserialize(data: MarketplaceEntryData): MarketplaceEntry {
    if (!MARKETPLACE_NAME_REGEX.test(data.name)) {
      throw new InvalidMarketplaceNameError(data.name);
    }
    if (data.scope !== "project" && data.scope !== "user") {
      throw new InvalidMarketplaceScopeError(String(data.scope));
    }
    const source = parsePluginSource(data.source);
    return new MarketplaceEntry({
      name: data.name,
      source,
      scope: data.scope,
      lastRefreshAt: data.lastRefreshAt,
      version: data.version,
    });
  }

  serialize(): MarketplaceEntryData {
    const data: MarketplaceEntryData = {
      name: this.name,
      source: serializePluginSource(this.source),
      scope: this.scope,
    };
    if (this.lastRefreshAt !== undefined) data.lastRefreshAt = this.lastRefreshAt;
    if (this.version !== undefined) data.version = this.version;
    return data;
  }

  withVersion(version: string): MarketplaceEntry {
    return new MarketplaceEntry({
      name: this.name,
      source: this.source,
      scope: this.scope,
      lastRefreshAt: this.lastRefreshAt,
      version,
    });
  }

  equals(other: MarketplaceEntry): boolean {
    return (
      this.name === other.name &&
      this.scope === other.scope &&
      this.lastRefreshAt === other.lastRefreshAt &&
      this.version === other.version &&
      JSON.stringify(serializePluginSource(this.source)) ===
        JSON.stringify(serializePluginSource(other.source))
    );
  }
}

// Re-export error for convenience in aggregate
export { MarketplaceAlreadyRegisteredError };
