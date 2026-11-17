import type { MarketplaceScope } from "../../../shared/domain/scope.js";
import type { AiToolId, ToolId } from "../../../shared/domain/tool.js";
import type { ToolCatalog } from "../../tools/contract/tool-catalog.js";
import type { AiToolProfile } from "../../tools/contract/tool-profile.js";
import type {
  NativeMarketplaceRegistration,
  NativeMarketplaceSource,
  RegistrationRecord,
} from "../domain/manifest/native-registrations.js";

/** What installation asks of a host to register marketplaces and enable refs. */
export interface NativeHostRegistration {
  execute<M extends RegistrationSubject>(
    command: RegisterPluginWithHostCommand<M>
  ): Promise<RegisterPluginWithHostResult>;
}

/** The part of a proven ref that `uninstallProven` is handed back. */
export interface ProvenHostRefHandle {
  readonly ref: string;
  readonly scope: MarketplaceScope;
}

/** What installation asks of a host to remove a plugin. */
export interface HostWithdrawal {
  assertProjectSource(command: ProjectSourceCommand): Promise<void>;
  proveClaimedRef(
    registrations: RegistrationRecord,
    claim: ClaimedHostRef,
    projectRoot: string
  ): Promise<ProvenHostRefHandle>;
  uninstallProven(proven: ProvenHostRefHandle): void;
  /** `undefined` when nothing was registered, else whether the host confirmed. */
  execute(command: WithdrawFromHostCommand): Promise<boolean | undefined>;
}

/** What installation does to a host once a catalogue removal is proven. */
export interface MarketplaceRemovalActions {
  uninstallPlugin(pluginRef: string, scope?: MarketplaceScope): void;
  removeMarketplace(name: string, scope: MarketplaceScope): void;
}

/** What installation asks of a host to plan a catalogue removal. */
export interface MarketplaceRemovalPlanner {
  /** The claims on the refs come back as given, narrowed to the catalogue. */
  planMarketplaceRemoval<Claim extends { readonly ref: string }>(
    tool: AiToolProfile,
    registrations: RegistrationRecord & { readonly pluginClaims?: readonly Claim[] },
    registration: NativeMarketplaceRegistration,
    projectRoot: string
  ): Promise<{
    activator: MarketplaceRemovalActions;
    refs: readonly Claim[];
    scopes: ReadonlyMap<string, "project" | "user" | undefined>;
  }>;
}

/** Answers the removal asks of whoever keeps the machine-wide claims. */
interface WithdrawalClaims {
  isMachineOwned(ref: string): Promise<boolean>;
  /** Why `ref` must stay enabled for another project, when it must. */
  guardMessage(
    binary: string,
    ref: string,
    alias: string,
    hostName: string
  ): Promise<string | undefined>;
  /** The path under `cacheRoot` when it stays inside it, else `null`. */
  resolveCacheCandidate(
    cacheRoot: string,
    relativeSegments: string,
    label: string
  ): Promise<string | null>;
}

/** An installed plugin to withdraw, by this project's marketplace alias. */
interface WithdrawnPlugin {
  readonly name: string;
  readonly marketplace: string;
  readonly scope: MarketplaceScope;
}

export interface WithdrawFromHostCommand {
  readonly tool: AiToolProfile;
  readonly plugin: WithdrawnPlugin;
  readonly projectRoot: string;
  readonly registrations: RegistrationRecord | undefined;
  readonly claims: WithdrawalClaims;
  /** Absent when the host keeps no plugin cache. */
  readonly pluginCacheRoot: string | undefined;
}

export type ProjectSourceCommand = Pick<
  WithdrawFromHostCommand,
  "tool" | "projectRoot" | "registrations"
> & {
  readonly plugin: WithdrawnPlugin;
  readonly isMachineOwned: WithdrawalClaims["isMachineOwned"];
};

export interface ClaimedHostRef {
  readonly tool: AiToolId;
  readonly ref: string;
}

export type CacheCandidateResolver = WithdrawalClaims["resolveCacheCandidate"];

interface RegisteredTool {
  readonly tool: AiToolProfile;
  readonly registrations: RegistrationRecord;
  readonly cacheRoot: string | undefined;
}

export interface ProjectRegistrationWithdrawal extends RegisteredTool {
  /** The scope the manifest recorded for each plugin ref, by ref. */
  readonly refScopes: ReadonlyMap<string, MarketplaceScope>;
}

export interface UserRegistrationWithdrawal extends RegisteredTool {
  /** The refs a machine claim owns for this tool. */
  readonly claimedRefs: readonly string[];
}

interface RegistrationLogger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
}

/** What a registration needs of each marketplace it is given. */
export interface RegistrationSubject {
  readonly name: string;
  readonly scope: MarketplaceScope;
}

export type RegisteredMarketplace = NativeMarketplaceRegistration;

/** What the manifest records after one tool's registration. */
export interface HostRegistrationOutcome {
  readonly marketplaces: readonly RegisteredMarketplace[];
  readonly preservedMarketplaces: readonly RegisteredMarketplace[];
  readonly catalogClaims: readonly RegisteredMarketplace[];
  readonly pluginRefs: readonly string[];
  /** True when a build failed, so the host keeps its earlier registration for it. */
  readonly buildFailed: boolean;
}

interface MachineRegistrations {
  readonly marketplaces: readonly RegisteredMarketplace[];
  readonly pluginClaims?: readonly { readonly ref: string }[];
}

/** The records the caller holds, read only when the registration needs them. */
export interface RegistrationClaims {
  readonly recorded: RegistrationRecord | undefined;
  readonly machine: () => Promise<MachineRegistrations | undefined>;
  readonly machineKept: boolean;
  readonly persistedProject: () => Promise<RegistrationRecord | undefined>;
}

export interface RegisterPluginWithHostCommand<M extends RegistrationSubject> {
  readonly tools: ToolCatalog;
  readonly toolId: ToolId;
  readonly projectRoot: string;
  readonly scope: MarketplaceScope;
  readonly marketplaces: readonly M[];
  readonly claims: RegistrationClaims;
  /** The tree to register a marketplace from; null when it cannot be built. */
  readonly build: (marketplace: M) => Promise<string | null>;
  readonly refsToEnable: (hostNameByAlias: ReadonlyMap<string, string>) => string[];
  readonly userCacheRoot: () => string;
  /** Warnings go to the logger and are kept in order for the caller. */
  readonly sink: { readonly logger: RegistrationLogger; readonly warnings: string[] };
}

export type RegisterPluginWithHostResult =
  | { readonly status: "unconfigured" }
  | { readonly status: "binary-missing"; readonly binary: string }
  | { readonly status: "activated"; readonly outcome: HostRegistrationOutcome };

/** Whether two sources name one marketplace; the composition hands in the host's rule. */
export type SameMarketplaceSource = (
  recorded: NativeMarketplaceSource,
  current: NativeMarketplaceSource
) => boolean;
