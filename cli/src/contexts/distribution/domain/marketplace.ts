import {
  type PluginSource,
  pluginSourceIdentity,
  serializePluginSource,
} from "../../../shared/domain/plugin/source.js";
import { parsePluginSource } from "../../../shared/domain/plugin/source-parsing.js";
import { isScope, type Scope } from "../../../shared/domain/scope.js";
import { InvalidMarketplaceNameError } from "../../../shared/domain/shared.error.js";
import { InvalidMarketplaceScopeError } from "../contract/distribution.error.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../contract/marketplace.js";

export const MARKETPLACE_NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface MarketplaceData {
  name: string;
  source: Record<string, unknown>;
  scope: Scope;
  addedAt: string;
  lastFetched?: string;
  version?: string;
}

/** A marketplace record as it comes off disk: `scope` is whatever the file said, which is
 * exactly why `fromJSON` checks it. Saying so lets a caller hand over an unchecked value
 * without pretending it is already one of the two the domain accepts. */
export type StoredMarketplaceData = Omit<MarketplaceData, "scope"> & { scope: string };

export class Marketplace {
  readonly name: string;
  readonly source: PluginSource;
  readonly scope: Scope;
  readonly addedAt: string;
  readonly lastFetched?: string;
  readonly version?: string;

  private constructor(params: {
    name: string;
    source: PluginSource;
    scope: Scope;
    addedAt: string;
    lastFetched?: string;
    version?: string;
  }) {
    this.name = params.name;
    this.source = params.source;
    this.scope = params.scope;
    this.addedAt = params.addedAt;
    this.lastFetched = params.lastFetched;
    this.version = params.version;
  }

  static create(params: {
    name: string;
    source: PluginSource;
    scope: Scope;
    addedAt: string;
  }): Marketplace {
    return Marketplace.fromJSON({
      name: params.name,
      source: serializePluginSource(params.source),
      scope: params.scope,
      addedAt: params.addedAt,
    });
  }

  static fromJSON(data: StoredMarketplaceData): Marketplace {
    if (!MARKETPLACE_NAME_REGEX.test(data.name)) {
      throw new InvalidMarketplaceNameError(data.name);
    }
    if (!isScope(data.scope)) {
      throw new InvalidMarketplaceScopeError(String(data.scope));
    }
    const source = parsePluginSource(data.source);
    return new Marketplace({
      name: data.name,
      source,
      scope: data.scope,
      addedAt: data.addedAt,
      lastFetched: data.lastFetched,
      version: data.version,
    });
  }

  toJSON(): MarketplaceData {
    const data: MarketplaceData = {
      name: this.name,
      source: serializePluginSource(this.source),
      scope: this.scope,
      addedAt: this.addedAt,
    };
    if (this.lastFetched !== undefined) data.lastFetched = this.lastFetched;
    if (this.version !== undefined) data.version = this.version;
    return data;
  }

  withLastFetched(when: string): Marketplace {
    return new Marketplace({
      name: this.name,
      source: this.source,
      scope: this.scope,
      addedAt: this.addedAt,
      lastFetched: when,
      version: this.version,
    });
  }

  withVersion(version: string): Marketplace {
    return new Marketplace({
      name: this.name,
      source: this.source,
      scope: this.scope,
      addedAt: this.addedAt,
      lastFetched: this.lastFetched,
      version,
    });
  }

  isSourcedFrom(source: PluginSource): boolean {
    return pluginSourceIdentity(this.source) === pluginSourceIdentity(source);
  }

  isFramework(): boolean {
    return this.name === FRAMEWORK_MARKETPLACE_NAME;
  }
}

export function isMarketplaceStale(
  marketplace: Marketplace,
  now: number,
  maxDays: number
): boolean {
  if (!marketplace.lastFetched) return true;
  const lastMs = Date.parse(marketplace.lastFetched);
  if (Number.isNaN(lastMs)) return true;
  return now - lastMs > maxDays * MS_PER_DAY;
}
