/** A marketplace the host registered: the manifest reads the two names and keeps the rest. */
export type RegisteredMarketplace = Readonly<Record<string, unknown>> & {
  readonly alias: string;
  readonly hostName: string;
};

/** What the manifest records after one tool's registration. */
export type HostRegistrationOutcome = {
  readonly marketplaces: readonly RegisteredMarketplace[];
  readonly preservedMarketplaces: readonly RegisteredMarketplace[];
  readonly catalogClaims: readonly RegisteredMarketplace[];
  readonly pluginRefs: readonly string[];
  /** True when a build failed, so the host keeps its earlier registration for it. */
  readonly buildFailed: boolean;
};
