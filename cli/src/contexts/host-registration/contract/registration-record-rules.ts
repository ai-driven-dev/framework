import type { RegistrationRecordView } from "./claims-view.js";

/** A marketplace the host registered: the record's reader needs only the two names. */
export type RegisteredMarketplaceView = Readonly<Record<string, unknown>> & {
  readonly alias: string;
  readonly hostName: string;
};

/** A record with the claims kept on its refs. */
type ClaimedRecordView<Claim extends { readonly ref: string } = { readonly ref: string }> =
  RegistrationRecordView & { readonly pluginClaims?: readonly Claim[] };

/** The marketplaces and refs one activation reported, which a record is rebuilt from. */
export interface ActivationOutcomeView {
  readonly marketplaces: readonly RegisteredMarketplaceView[];
  readonly preservedMarketplaces: readonly RegisteredMarketplaceView[];
  readonly pluginRefs: readonly string[];
}

/** A claim on a ref, with the projects holding it. */
interface DependentClaimView {
  readonly ref: string;
  readonly dependents: readonly string[];
}

/** What a run claims on a machine's record, and for which project, none when it is unknown. */
export interface CatalogueClaimsView {
  readonly marketplaces: readonly RegisteredMarketplaceView[];
  readonly refs: readonly string[];
  readonly dependent: string | undefined;
}

/** What a clean announces of one tool's recorded registration. */
export interface RegistrationPreviewView {
  readonly binary: string;
  readonly marketplaceCount: number;
  readonly pluginRefCount: number;
  readonly cachePaths: readonly string[];
}

/** What the host registration answers over a record another context keeps for it, without that
 * context reading the record's shape. */
export interface RegistrationRecordRules {
  /** The refs recorded on the host, none when nothing was recorded. */
  readonly pluginRefsOf: (record: RegistrationRecordView | undefined) => readonly string[];
  /** What a clean announces of the record, with the cache paths it would purge under the root. */
  readonly registrationPreview: (
    record: RegistrationRecordView,
    cacheRoot: string | undefined
  ) => RegistrationPreviewView;
  /** The ref a plugin has on the host, `undefined` when nothing was recorded for the alias. */
  readonly refOf: (
    record: RegistrationRecordView | undefined,
    plugin: string,
    alias: string | undefined
  ) => string | undefined;
  /** The registration an alias stands for, `undefined` when it was never registered. */
  readonly marketplaceOf: (
    record: RegistrationRecordView,
    alias: string | undefined
  ) => RegisteredMarketplaceView | undefined;
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
  /** The record an activation leaves, `undefined` when it equals the one recorded. */
  readonly afterActivation: <Claim extends { readonly ref: string }>(
    existing: ClaimedRecordView<Claim> | undefined,
    outcome: ActivationOutcomeView,
    run: { readonly binary: string; readonly narrowed: boolean }
  ) => ClaimedRecordView<Claim> | undefined;
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
  /** The refs, then the claimed refs, that sit on one of the host names. */
  readonly refsOnHosts: (record: ClaimedRecordView, hostNames: Iterable<string>) => string[];
  /** The ref a plugin has on the host under a catalogue's host name. */
  readonly refOnHostName: (plugin: string, hostName: string) => string;
  /** Whether a plugin selector names its catalogue, so it can only mean one exact ref. */
  readonly isQualifiedRef: (selector: string) => boolean;
  /** A qualified selector is one exact ref; a bare plugin name selects it in every catalogue. */
  readonly refSelectedBy: (ref: string, selector: string) => boolean;
  /** The record without a ref and the claim kept on it, claims list always written. */
  readonly withoutClaimedRef: <R extends ClaimedRecordView>(
    record: R,
    ref: string
  ) => R & { readonly pluginClaims: readonly { readonly ref: string }[] };
  /** The record without one ref, every other entry untouched. */
  readonly withoutRef: <R extends RegistrationRecordView>(record: R, ref: string) => R;
}
