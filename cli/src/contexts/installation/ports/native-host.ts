import type { Scope } from "../../../shared/domain/scope.js";
import type { AiToolId } from "../../../shared/domain/tool.js";
import type {
  NativePluginClaim,
  NativeRegistrations,
} from "../domain/manifest/native-registrations.js";
import type { HostRefCountingTool, NativeHostTool } from "./tool-sections.js";

/** What a clean announces of one tool's recorded registration. */
export interface RegistrationPreview {
  readonly binary: string;
  readonly marketplaceCount: number;
  readonly pluginRefCount: number;
  readonly cachePaths: readonly string[];
}

/** A claim the manifest keeps on a ref: only the ref is the host's business. */
interface RecordedClaim {
  readonly ref: string;
}

type ClaimedRecord<Claim extends RecordedClaim = RecordedClaim> = Omit<
  NativeRegistrations,
  "pluginClaims"
> & {
  readonly pluginClaims?: readonly Claim[];
};

/** What a run claims on a machine's record, and for which project. */
interface CatalogueClaims {
  readonly marketplaces: readonly RegisteredMarketplace[];
  readonly refs: readonly string[];
  /** The project root holding the claims, none when the project is unknown. */
  readonly dependent: string | undefined;
}

/** The machine record once the claims are merged, and whether the merge changed anything. */
interface MergedClaims {
  readonly record: ClaimedRecord<NativePluginClaim> & {
    readonly pluginClaims: readonly NativePluginClaim[];
  };
  readonly changed: boolean;
}

/** The record with its claims list always written, as the manifest rewrites it. */
type WithClaims<R> = R & { readonly pluginClaims: readonly RecordedClaim[] };

/** What installation asks of the host registration to read or rewrite a record it keeps. */
export interface RegistrationRecordRules {
  /** The refs recorded on the host, none when nothing was recorded. */
  readonly pluginRefsOf: (record: NativeRegistrations | undefined) => readonly string[];
  /** The registration an alias stands for, `undefined` when it was never registered. */
  readonly marketplaceOf: (
    record: NativeRegistrations,
    alias: string | undefined
  ) => RegisteredMarketplace | undefined;
  /** The claims on the refs sitting on the host name the alias was registered under. */
  readonly claimsOnMarketplace: <Claim extends RecordedClaim>(
    record: ClaimedRecord<Claim>,
    alias: string
  ) => readonly Claim[];
  /** Whether a ref sits on one of the host names. */
  readonly refOnAnyHost: (ref: string, hostNames: Iterable<string>) => boolean;
  /** Whether a plugin selector names its catalogue, so it can only mean one exact ref. */
  readonly isQualifiedRef: (selector: string) => boolean;
  /** A qualified selector is one exact ref; a bare plugin name selects it in every catalogue. */
  readonly refSelectedBy: (ref: string, selector: string) => boolean;
  /** The ref a plugin has on a host catalogue, which the host knows by its own name. */
  readonly refOnHostName: (plugin: string, hostName: string) => string;
  /** The ref a plugin has on the host, `undefined` when nothing was recorded for the alias. */
  readonly refOf: (
    record: NativeRegistrations | undefined,
    plugin: string,
    alias: string | undefined
  ) => string | undefined;
  /** The refs, then the claimed refs, that sit on one of the host names. */
  readonly refsOnHosts: (record: ClaimedRecord, hostNames: Iterable<string>) => string[];
  readonly registrationPreview: (
    record: NativeRegistrations,
    cacheRoot: string | undefined
  ) => RegistrationPreview;
  /** The record without one ref, every other entry untouched. */
  readonly withoutRef: <R extends NativeRegistrations>(record: R, ref: string) => R;
  /** The record without a ref and the claim the manifest keeps on it, claims list always written. */
  readonly withoutClaimedRef: <R extends ClaimedRecord>(record: R, ref: string) => WithClaims<R>;
  /** The record without a marketplace, nor any ref or claim on the host name it was registered under. */
  readonly withoutMarketplace: <R extends ClaimedRecord>(record: R, alias: string) => WithClaims<R>;
  /** The record a tool's activation leaves, `undefined` when it equals the one recorded. */
  readonly afterActivation: <Claim extends RecordedClaim>(
    existing: ClaimedRecord<Claim> | undefined,
    outcome: Pick<HostRegistrationOutcome, "marketplaces" | "preservedMarketplaces" | "pluginRefs">,
    run: { readonly binary: string; readonly narrowed: boolean }
  ) => ClaimedRecord<Claim> | undefined;
  /** A machine's record with the claims of one run merged in. */
  readonly mergeCatalogueClaims: (
    existing: ClaimedRecord<NativePluginClaim> | undefined,
    claimed: CatalogueClaims,
    fallbackBinary: string
  ) => MergedClaims;
}

/**
 * What installation asks of a host to remove a plugin. `Proof` is the host's own proof that a ref
 * is removable: installation only hands back what `proveClaimedRef` gave it, never reads it.
 */
export interface HostWithdrawal<Proof> {
  readonly assertProjectSource: (command: ProjectSourceRequest) => Promise<void>;
  readonly proveClaimedRef: (
    registrations: NativeRegistrations,
    claim: ClaimedHostRef,
    projectRoot: string
  ) => Promise<Proof>;
  readonly uninstallProven: (proof: Proof) => Promise<void>;
  /** `undefined` when nothing was registered, else whether the host confirmed. */
  readonly execute: (command: WithdrawFromHostRequest) => Promise<boolean | undefined>;
}

/** What installation does to a host once a catalogue removal is proven. */
export interface MarketplaceRemovalActions {
  readonly uninstallPlugin: (pluginRef: string, scope?: Scope) => void;
  readonly removeMarketplace: (name: string, scope: Scope) => void;
}

/** What installation asks of a host to plan a catalogue removal. */
export interface MarketplaceRemovalPlanner {
  /** The claims on the refs come back as given, narrowed to the catalogue. */
  readonly planMarketplaceRemoval: <Claim extends { readonly ref: string }>(
    tool: HostRefCountingTool,
    registrations: ClaimedRecord<Claim>,
    removal: { readonly registration: RegisteredMarketplace; readonly projectRoot: string }
  ) => Promise<{
    activator: MarketplaceRemovalActions;
    refs: readonly Claim[];
    scopes: ReadonlyMap<string, Scope | undefined>;
  }>;
}

/** An installed plugin to withdraw, by this project's marketplace alias. */
interface WithdrawnPlugin {
  readonly name: string;
  readonly marketplace: string;
  readonly scope: Scope;
}

export interface WithdrawFromHostRequest {
  readonly tool: NativeHostTool;
  readonly plugin: WithdrawnPlugin;
  readonly projectRoot: string;
  readonly registrations: NativeRegistrations | undefined;
  /** Absent when the host keeps no plugin cache. */
  readonly pluginCacheRoot: string | undefined;
}

export type ProjectSourceRequest = Pick<
  WithdrawFromHostRequest,
  "tool" | "projectRoot" | "registrations"
> & {
  readonly plugin: WithdrawnPlugin;
  readonly isMachineOwned: (ref: string) => Promise<boolean>;
};

export interface ClaimedHostRef {
  readonly tool: AiToolId;
  readonly ref: string;
}

/** The path under `cacheRoot` when it stays inside it, else `null`. */
export type CacheCandidateResolver = (
  cacheRoot: string,
  relativeSegments: string,
  label: string
) => Promise<string | null>;

interface RegisteredTool {
  readonly tool: NativeHostTool;
  readonly registrations: NativeRegistrations;
  readonly cacheRoot: string | undefined;
}

export interface ProjectRegistrationWithdrawal extends RegisteredTool {
  /** The scope the manifest recorded for each plugin ref, by ref. */
  readonly refScopes: ReadonlyMap<string, Scope>;
}

export interface UserRegistrationWithdrawal extends RegisteredTool {
  /** The refs a machine claim owns for this tool. */
  readonly claimedRefs: readonly string[];
}

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
