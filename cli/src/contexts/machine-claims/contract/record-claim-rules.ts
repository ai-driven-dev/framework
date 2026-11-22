/** A record with the claims kept on its refs. */
type ClaimedRecordView<Claim extends { readonly ref: string } = { readonly ref: string }> =
  Readonly<Record<string, unknown>> & { readonly pluginClaims?: readonly Claim[] };

/** A claim on a ref, with the projects holding it. */
interface DependentClaimView {
  readonly ref: string;
  readonly dependents: readonly string[];
}

/** What a run claims on a machine's record, and for which project, none when it is unknown. */
export interface CatalogueClaimsView {
  readonly marketplaces: readonly (Readonly<Record<string, unknown>> & {
    readonly alias: string;
    readonly hostName: string;
  })[];
  readonly refs: readonly string[];
  readonly dependent: string | undefined;
}

/** What the machine claims answer over the claims a record keeps beside the host data. */
export interface RecordClaimRules {
  /** The claims a record keeps on its refs with the projects holding each, none for a record
   * that is absent or keeps none. Refuses a claims block it did not write. */
  readonly claimsOf: (
    record: Readonly<Record<string, unknown>> | undefined
  ) => readonly DependentClaimView[];
  /** The claims on the refs sitting on the host name the alias was registered under. */
  readonly claimsOnMarketplace: <Claim extends { readonly ref: string }>(
    record: ClaimedRecordView<Claim>,
    alias: string
  ) => readonly Claim[];
  /** The record without a marketplace, nor any ref or claim on the host name it was registered
   * under, its claims list always written. */
  readonly withoutMarketplace: <R extends ClaimedRecordView>(
    record: R,
    alias: string
  ) => R & { readonly pluginClaims: readonly { readonly ref: string }[] };
  /** A machine's record with the claims of one run merged in, and whether that changed it. */
  readonly mergeCatalogueClaims: (
    existing: ClaimedRecordView<DependentClaimView> | undefined,
    claimed: CatalogueClaimsView,
    fallbackBinary: string
  ) => {
    readonly record: ClaimedRecordView<DependentClaimView> & {
      readonly pluginClaims: readonly DependentClaimView[];
    };
    readonly changed: boolean;
  };
  /** The record without a ref and the claim kept on it, claims list always written. */
  readonly withoutClaimedRef: <R extends ClaimedRecordView>(
    record: R,
    ref: string
  ) => R & { readonly pluginClaims: readonly { readonly ref: string }[] };
}
