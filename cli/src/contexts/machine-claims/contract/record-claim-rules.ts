/** A record with the claims it keeps, on its refs and on machine plugins. */
export type ClaimedRecordView<Claim extends object = HeldClaimView> = Readonly<
  Record<string, unknown>
> & {
  readonly pluginClaims?: readonly Claim[];
};

/** A claim on a machine plugin, with the projects holding it. */
export interface PluginClaimView {
  readonly plugin: string;
  readonly dependents: readonly string[];
}

/** A claim on a ref, with the projects holding it. */
interface DependentClaimView {
  readonly ref: string;
  readonly dependents: readonly string[];
}

/** A claim a record keeps, on a ref or on a machine plugin. */
type HeldClaimView = DependentClaimView | PluginClaimView;

/** What a run claims on a machine's record, and for which project, none when it is unknown. */
export interface CatalogueClaimsView {
  readonly marketplaces: readonly (Readonly<Record<string, unknown>> & {
    readonly alias: string;
    readonly hostName: string;
  })[];
  readonly refs: readonly string[];
  readonly dependent: string | undefined;
}

/** A machine's record with the claims of one run merged in, and whether that changed it. */
export interface MergedCatalogueClaimsView {
  readonly record: ClaimedRecordView<HeldClaimView> & {
    readonly pluginClaims: readonly HeldClaimView[];
  };
  readonly changed: boolean;
}

/** What the machine claims answer over the claims a record keeps beside the host data. */
export interface RecordClaimRules {
  /** The claims a record keeps on its refs with the projects holding each, none for a record
   * that is absent or keeps none. Refuses a claims block it did not write. */
  readonly claimsOf: (
    record: Readonly<Record<string, unknown>> | undefined
  ) => readonly DependentClaimView[];
  /** The refs a record keeps claims on, none for a record that is absent or keeps none. Refuses a
   * claims block it did not write. */
  readonly claimedRefs: (
    record: Readonly<Record<string, unknown>> | undefined
  ) => readonly string[];
  /** The claims a record keeps on the named machine plugins, none for a record that is absent or
   * keeps none. Refuses a claims block it did not write. */
  readonly pluginClaimsOf: (
    record: Readonly<Record<string, unknown>> | undefined,
    names: readonly string[]
  ) => readonly PluginClaimView[];
  /** The project roots holding these claims, once each, none when nothing is held. */
  readonly holdersOf: (
    claims: readonly { readonly dependents: readonly string[] }[]
  ) => readonly string[];
  /** The claims on the refs sitting on the host name the alias was registered under. */
  readonly claimsOnMarketplace: (
    record: ClaimedRecordView,
    alias: string
  ) => readonly DependentClaimView[];
  /** The record without a marketplace, nor any ref or claim on the host name it was registered
   * under, its claims list always written. */
  readonly withoutMarketplace: <R extends ClaimedRecordView>(
    record: R,
    alias: string
  ) => R & { readonly pluginClaims: readonly HeldClaimView[] };
  /** A machine's record with the claims of one run merged in, and whether that changed it. */
  readonly mergeCatalogueClaims: (
    existing: ClaimedRecordView | undefined,
    claimed: CatalogueClaimsView,
    fallbackBinary: string
  ) => MergedCatalogueClaimsView;
  /** The record without a ref and the claim kept on it, claims list always written. */
  readonly withoutClaimedRef: <R extends ClaimedRecordView>(
    record: R,
    ref: string
  ) => R & { readonly pluginClaims: readonly HeldClaimView[] };
}
