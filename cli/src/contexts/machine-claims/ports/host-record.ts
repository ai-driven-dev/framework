/** A marketplace a run claims: only its two names are read, by the host registration. */
export type ClaimedMarketplace = Readonly<Record<string, unknown>> & {
  readonly alias: string;
  readonly hostName: string;
};

/** What the host registration answers over its own part of a record, which the claims follow. */
export interface HostRecordRules {
  readonly marketplaceOf: (
    record: Readonly<Record<string, unknown>>,
    alias: string | undefined
  ) => { readonly hostName: string } | undefined;
  readonly isRefOnHost: (ref: string, hostName: string) => boolean;
  /** The record without one ref, every other entry untouched. */
  readonly withoutRef: <R extends Readonly<Record<string, unknown>>>(record: R, ref: string) => R;
  /** The record without the marketplace nor any ref on the host name it was registered under. */
  readonly withoutMarketplace: <R extends Readonly<Record<string, unknown>>>(
    record: R,
    alias: string
  ) => R;
  /** The host data with a run's marketplaces merged in, and whether that changed it. */
  readonly mergeCatalogueMarketplaces: (
    existing: Readonly<Record<string, unknown>> | undefined,
    marketplaces: readonly ClaimedMarketplace[],
    fallbackBinary: string
  ) => { readonly record: Readonly<Record<string, unknown>>; readonly changed: boolean };
}
