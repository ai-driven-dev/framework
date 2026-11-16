import type { MarketplaceScope } from "../../../shared/domain/scope.js";
import type {
  RegisterPluginWithHostCommand,
  RegisterPluginWithHostResult,
  RegistrationSubject,
} from "../../host-registration/contract/native-registration.js";
import type {
  NativeMarketplaceRegistration,
  RegistrationRecord,
} from "../../host-registration/contract/registration-record.js";
import type {
  ClaimedHostRef,
  ProjectSourceCommand,
  WithdrawFromHostCommand,
} from "../../host-registration/contract/withdrawal.js";
import type { AiToolProfile } from "../../tools/contract/tool-profile.js";

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
