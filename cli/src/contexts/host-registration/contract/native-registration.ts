import type { MarketplaceScope } from "../../../shared/domain/scope.js";
import type { ToolId } from "../../../shared/domain/tool.js";
import type { ToolCatalog } from "../../tools/contract/tool-catalog.js";
import type { NativeMarketplaceRegistration, RegistrationRecord } from "./registration-record.js";

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
