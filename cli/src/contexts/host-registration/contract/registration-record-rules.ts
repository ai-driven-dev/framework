import type { RegistrationRecordView } from "./claims-view.js";

/** A marketplace the host registered: the record's reader needs only the two names. */
export type RegisteredMarketplaceView = Readonly<Record<string, unknown>> & {
  readonly alias: string;
  readonly hostName: string;
};

/** A record with the claims block kept beside it, carried through as is. */
type ClaimedRecordView = RegistrationRecordView & { readonly pluginClaims?: unknown };

/** The marketplaces and refs one activation reported, which a record is rebuilt from. */
export interface ActivationOutcomeView {
  readonly marketplaces: readonly RegisteredMarketplaceView[];
  readonly preservedMarketplaces: readonly RegisteredMarketplaceView[];
  readonly pluginRefs: readonly string[];
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
  /** The name the host knows an alias by: the recorded host name, the alias itself when nothing
   * was recorded. */
  readonly hostNameOrAlias: (record: RegistrationRecordView | undefined, alias: string) => string;
  /** The record an activation leaves, `undefined` when it equals the one recorded. */
  readonly afterActivation: (
    existing: ClaimedRecordView | undefined,
    outcome: ActivationOutcomeView,
    run: { readonly binary: string; readonly narrowed: boolean }
  ) => ClaimedRecordView | undefined;
  /** The refs, then the claimed refs, that sit on one of the host names. */
  readonly refsOnHosts: (
    record: RegistrationRecordView,
    claimedRefs: readonly string[],
    hostNames: Iterable<string>
  ) => string[];
  /** The ref a plugin has on the host under a catalogue's host name. */
  readonly refOnHostName: (plugin: string, hostName: string) => string;
  /** Whether a plugin selector names its catalogue, so it can only mean one exact ref. */
  readonly isQualifiedRef: (selector: string) => boolean;
  /** A qualified selector is one exact ref; a bare plugin name selects it in every catalogue. */
  readonly refSelectedBy: (ref: string, selector: string) => boolean;
  /** The record without one ref, every other entry untouched. */
  readonly withoutRef: <R extends RegistrationRecordView>(record: R, ref: string) => R;
}
