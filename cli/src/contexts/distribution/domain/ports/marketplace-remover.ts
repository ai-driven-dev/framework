import type { MarketplaceScope } from "../../../../kernel/scope.js";

export interface MarketplaceRemovalRequest {
  name: string;
  projectRoot: string;
  autoConfirm: boolean;
  scope?: MarketplaceScope;
}

/** Drops a registered marketplace, with whatever was installed from it. The work belongs to
 * whoever owns installed plugins, so distribution only asks for it. */
export interface MarketplaceRemover {
  remove(request: MarketplaceRemovalRequest): Promise<void>;
}
