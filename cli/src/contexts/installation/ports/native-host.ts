import type { MarketplaceScope } from "../../../shared/domain/scope.js";
import type { AiToolId, ToolId } from "../../../shared/domain/tool.js";
import type { ToolCatalog } from "../../tools/contract/tool-catalog.js";
import type { AiToolProfile } from "../../tools/contract/tool-profile.js";
import type {
  NativeMarketplaceRegistration,
  NativeMarketplaceSource,
  RegistrationRecord,
} from "../domain/manifest/native-registrations.js";

/** Registers a tool's marketplaces with its own host and enables the refs a run asks for. The
 * host registration owns it and hands over the real one, which satisfies this shape. */
export interface NativeHostRegistration {
  execute<M extends RegistrationSubject>(
    command: RegisterPluginWithHostCommand<M>
  ): Promise<RegisterPluginWithHostResult>;
}

/** A host ref proven removable. Only what the installation hands back to `uninstallProven` is
 * named here; the host registration's own proof carries the rest. */
export interface ProvenHostRefHandle {
  readonly ref: string;
  readonly scope: MarketplaceScope;
}

/** What a plugin removal asks of the host it was registered with. The host registration owns it
 * and hands over the real one, which satisfies this shape. */
export interface HostWithdrawal {
  assertProjectSource(command: ProjectSourceCommand): Promise<void>;
  proveClaimedRef(
    registrations: RegistrationRecord,
    claim: ClaimedHostRef,
    projectRoot: string
  ): Promise<ProvenHostRefHandle>;
  uninstallProven(proven: ProvenHostRefHandle): void;
  /** `undefined` when there was nothing to undo, otherwise whether the host confirmed it. */
  execute(command: WithdrawFromHostCommand): Promise<boolean | undefined>;
}

/** What the installation does to a host once a catalogue removal is proven. */
export interface MarketplaceRemovalActions {
  uninstallPlugin(pluginRef: string, scope?: MarketplaceScope): void;
  removeMarketplace(name: string, scope: MarketplaceScope): void;
}

/** Proves a host catalogue is AIDD's to remove and answers the refs and actions that remove it.
 * The host registration owns it and hands over the real one, which satisfies this shape. */
export interface MarketplaceRemovalPlanner {
  /** `registrations` carries the claims on its refs beside the host data: they come back as
   * they came, narrowed to the catalogue. */
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

/** The facts about machine-wide ownership a withdrawal depends on, none of which this context
 * may read itself: the caller answers them from where claims live. */
export interface WithdrawalClaims {
  /** Whether a canonical machine claim owns `ref`. */
  isMachineOwned(ref: string): Promise<boolean>;
  /** The warning that says why `ref` must stay enabled for another project, if it must. */
  guardMessage(
    binary: string,
    ref: string,
    alias: string,
    hostName: string
  ): Promise<string | undefined>;
  /** `<cacheRoot>/<relativeSegments>` once proven to sit inside `cacheRoot`, else `null`. */
  resolveCacheCandidate(
    cacheRoot: string,
    relativeSegments: string,
    label: string
  ): Promise<string | null>;
}

/** One installed plugin the host may have registered, by aidd's own marketplace alias. */
export interface WithdrawnPlugin {
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
  /** Root of the host's own plugin cache; absent when the host keeps none. */
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

/** `<cacheRoot>/<relativeSegments>` once proven to sit inside `cacheRoot`, else `null`. */
export type CacheCandidateResolver = WithdrawalClaims["resolveCacheCandidate"];

/** A tool whose host holds registrations this project or machine made. */
export interface RegisteredTool {
  readonly tool: AiToolProfile;
  readonly registrations: RegistrationRecord;
  /** Root of the host's own plugin cache; absent when the host keeps none. */
  readonly cacheRoot: string | undefined;
}

export interface ProjectRegistrationWithdrawal extends RegisteredTool {
  /** The scope this project's own manifest recorded for each plugin ref, by ref. */
  readonly refScopes: ReadonlyMap<string, MarketplaceScope>;
}

export interface UserRegistrationWithdrawal extends RegisteredTool {
  /** Every ref a canonical machine claim owns for this tool. */
  readonly claimedRefs: readonly string[];
}

/** What a registration says while it runs. The caller's own logger satisfies it. */
export interface RegistrationLogger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
}

/** A marketplace as the host sees it: aidd's own local name and the scope it lives at. */
export interface RegistrationSubject {
  readonly name: string;
  readonly scope: MarketplaceScope;
}

export type RegisteredMarketplace = NativeMarketplaceRegistration;

/** What one tool's host registration left behind, for the caller to record. */
export interface HostRegistrationOutcome {
  readonly marketplaces: readonly RegisteredMarketplace[];
  readonly preservedMarketplaces: readonly RegisteredMarketplace[];
  readonly catalogClaims: readonly RegisteredMarketplace[];
  readonly pluginRefs: readonly string[];
  /** A marketplace whose build failed was warned about and left unregistered this run: the
   * host's own registration for it is wherever it was before. */
  readonly buildFailed: boolean;
}

/** What the machine-wide record holds for a tool. Read when needed, never ahead of it. */
export interface MachineRegistrations {
  readonly marketplaces: readonly RegisteredMarketplace[];
  readonly pluginClaims?: readonly { readonly ref: string }[];
}

/** What other records say about a tool's registrations, handed over by the caller that owns them. */
export interface RegistrationClaims {
  /** The registrations this run's own record already holds for the tool. */
  readonly recorded: RegistrationRecord | undefined;
  /** The machine-wide record, absent when it is empty or not kept. */
  readonly machine: () => Promise<MachineRegistrations | undefined>;
  /** Whether a machine-wide record is kept at all. */
  readonly machineKept: boolean;
  /** The project record as last saved. */
  readonly persistedProject: () => Promise<RegistrationRecord | undefined>;
}

export interface RegisterPluginWithHostCommand<M extends RegistrationSubject> {
  readonly tools: ToolCatalog;
  readonly toolId: ToolId;
  readonly projectRoot: string;
  readonly scope: MarketplaceScope;
  readonly marketplaces: readonly M[];
  readonly claims: RegistrationClaims;
  /** Builds the tree one marketplace is registered from; null when it cannot be built. */
  readonly build: (marketplace: M) => Promise<string | null>;
  /** The refs this run enables, given the host name each proven marketplace answers to. */
  readonly refsToEnable: (hostNameByAlias: ReadonlyMap<string, string>) => string[];
  readonly userCacheRoot: () => string;
  /** Every warning goes to the logger and is kept, in order, for the caller's result. */
  readonly sink: { readonly logger: RegistrationLogger; readonly warnings: string[] };
}

export type RegisterPluginWithHostResult =
  | { readonly status: "unconfigured" }
  | { readonly status: "binary-missing"; readonly binary: string }
  | { readonly status: "activated"; readonly outcome: HostRegistrationOutcome };

/** Whether two sources name one marketplace. The host registration owns the comparison and the
 * composition hands it over, so a recorded source and a current one are judged by one rule. */
export type SameMarketplaceSource = (
  recorded: NativeMarketplaceSource,
  current: NativeMarketplaceSource
) => boolean;
