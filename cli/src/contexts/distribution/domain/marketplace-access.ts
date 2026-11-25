export interface MarketplaceAccessFacts {
  readonly tokenPresent: boolean;
  readonly repoPublic: boolean;
}

/** Whether a remote marketplace can be fetched: a token reaches any repository, and without one
 * only a public repository is readable. */
export class MarketplaceAccess {
  constructor(private readonly facts: MarketplaceAccessFacts) {}

  isReadable(): boolean {
    return this.facts.tokenPresent || this.facts.repoPublic;
  }
}
