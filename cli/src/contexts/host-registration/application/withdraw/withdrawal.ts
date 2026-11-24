import type { Scope } from "../../../../shared/domain/scope.js";
import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import type { WithdrawalClaimsView } from "../../contract/claims-view.js";
import type { NativeMarketplaceRegistration } from "../../domain/record/native-marketplace-source.js";
import type {
  RegistrationRecord,
  RegistrationRecordData,
} from "../../domain/record/registration-record.js";
import type { HostActions } from "../../ports/host-actions.js";
import type { HostPorts } from "../../ports/host-ports.js";
import type { HostedTool, HostRefCounter, NativeHostTool } from "../../ports/host-tool.js";

/** One installed plugin the host may have registered, by aidd's own marketplace alias. */
export interface WithdrawnPlugin {
  readonly name: string;
  readonly marketplace: string;
  readonly scope: Scope;
}

export interface WithdrawFromHostRequest {
  readonly tool: NativeHostTool;
  readonly plugin: WithdrawnPlugin;
  readonly projectRoot: string;
  readonly registrations: RegistrationRecordData | undefined;
  readonly claims: WithdrawalClaimsView;
  /** Root of the host's own plugin cache; absent when the host keeps none. */
  readonly pluginCacheRoot: string | undefined;
}

export type ProjectSourceRequest = Pick<
  WithdrawFromHostRequest,
  "tool" | "projectRoot" | "registrations"
> & {
  readonly plugin: WithdrawnPlugin;
  readonly isMachineOwned: WithdrawalClaimsView["isMachineOwned"];
};

export interface ClaimedHostRef {
  readonly tool: AiToolId;
  readonly ref: string;
}

/** `<cacheRoot>/<relativeSegments>` once proven to sit inside `cacheRoot`, else `null`. */
export type CacheCandidateResolver = WithdrawalClaimsView["resolveCacheCandidate"];

/** A tool whose host holds registrations this project or machine made. */
export interface RegisteredTool {
  readonly tool: NativeHostTool;
  readonly registrations: RegistrationRecordData;
  /** Root of the host's own plugin cache; absent when the host keeps none. */
  readonly cacheRoot: string | undefined;
}

export interface ProjectRegistrationWithdrawal extends RegisteredTool {
  /** The scope this project's own manifest recorded for each plugin ref, by ref. */
  readonly refScopes: ReadonlyMap<string, Scope>;
}

export interface UserRegistrationWithdrawal extends RegisteredTool {
  /** Every ref a canonical machine claim owns for this tool. */
  readonly claimedRefs: readonly string[];
}

/** A tool a pass withdrew from, with its record as the host read it and the host names removed. */
export interface RemovedFromHost {
  readonly withdrawal: RegisteredTool;
  readonly registrations: RegistrationRecord;
  readonly removedHostNames: ReadonlySet<string>;
}

/** What a withdrawal reads and acts through: files, the log, and the host's ports. */
export interface WithdrawalDeps {
  readonly fs: FileReader & FileWriter;
  readonly logger: Logger;
  readonly ports: HostPorts;
}

/** A catalogue proven removable, with the refs this machine claims on it and the scope the host
 * holds each at, held until the removal acts. */
export interface ProvenMarketplaceRemoval {
  readonly hostName: string;
  readonly activator: HostActions;
  readonly refs: readonly string[];
  readonly scopes: ReadonlyMap<string, Scope | undefined>;
}

/** A host ref proven removable, held until every proof of the batch has passed. */
export interface ProvenHostRef {
  readonly activator: HostActions;
  readonly ref: string;
  readonly scope: Scope;
}

/** What a project clean depends on that this context may not read itself. */
export interface ProjectCleanFacts {
  readonly projectRoot: string;
  /** The scope each marketplace is registered at, by this project's own alias. */
  readonly marketplaceScopes: ReadonlyMap<string, Scope>;
  /** The shared machine-scope source this project references, and who else does; absent when none. */
  readonly sharedSource:
    | { readonly alias: string; readonly otherProjects: readonly string[] }
    | undefined;
  /** The alias the framework's own marketplace is registered under. */
  readonly frameworkAlias: string;
  /** The machine-wide claims, answered by the caller that keeps them. */
  readonly machine: {
    /** The refs claimed on `tool`; `undefined` when no machine record exists. */
    readonly claimedRefs: (tool: AiToolId) => Promise<readonly string[] | undefined>;
    /** The projects other than `projectRoot` holding any of `refs`, once each. */
    readonly othersHolding: (
      tool: AiToolId,
      refs: readonly string[],
      projectRoot: string
    ) => Promise<readonly string[]>;
  };
  /** Runs `action` holding the machine record's lock when there is one to lock. */
  readonly exclusive: <T>(action: () => Promise<T>) => Promise<T>;
  readonly resolveCacheCandidate: CacheCandidateResolver;
}

/** Every question a withdrawal answers, told apart by `kind`: the proofs refuse before any host
 * change, the withdrawals act. */
export type WithdrawalRequest =
  | {
      readonly kind: "prove-marketplace-removal";
      readonly tool: HostedTool & HostRefCounter;
      readonly registrations: RegistrationRecordData;
      readonly registration: NativeMarketplaceRegistration;
      readonly projectRoot: string;
      /** The refs the caller's own claims hold on the registrations. */
      readonly claimedRefs: readonly string[];
    }
  | { readonly kind: "withdraw-proven-marketplace"; readonly proven: ProvenMarketplaceRemoval }
  | ({ readonly kind: "withdraw-plugin" } & WithdrawFromHostRequest)
  | ({ readonly kind: "prove-project-source" } & ProjectSourceRequest)
  | {
      readonly kind: "prove-claimed-ref";
      readonly registrationData: RegistrationRecordData;
      readonly claim: ClaimedHostRef;
      readonly projectRoot: string;
    }
  | { readonly kind: "withdraw-proven-ref"; readonly proven: ProvenHostRef }
  | {
      readonly kind: "prove-project-registrations";
      readonly withdrawals: readonly ProjectRegistrationWithdrawal[];
      readonly facts: ProjectCleanFacts;
      /** The alias of the one marketplace to act on; every registration when absent. */
      readonly marketplace?: string;
    }
  | {
      readonly kind: "withdraw-project-registrations";
      readonly withdrawals: readonly ProjectRegistrationWithdrawal[];
      readonly facts: ProjectCleanFacts;
      /** The alias of the one marketplace to act on; every registration when absent. */
      readonly marketplace?: string;
    }
  | {
      readonly kind: "check-user-hosts";
      readonly withdrawals: readonly UserRegistrationWithdrawal[];
    }
  | {
      readonly kind: "prove-user-registrations";
      readonly withdrawals: readonly UserRegistrationWithdrawal[];
      readonly projectRoot: string;
    }
  | {
      readonly kind: "withdraw-user-registrations";
      readonly withdrawals: readonly UserRegistrationWithdrawal[];
      readonly resolveCacheCandidate: CacheCandidateResolver;
    };

export type WithdrawPluginRequest = Extract<WithdrawalRequest, { kind: "withdraw-plugin" }>;
export type ProveClaimedRefRequest = Extract<WithdrawalRequest, { kind: "prove-claimed-ref" }>;
export type ProveMarketplaceRemovalRequest = Extract<
  WithdrawalRequest,
  { kind: "prove-marketplace-removal" }
>;
export type WithdrawalStepRequest = Exclude<
  WithdrawalRequest,
  WithdrawPluginRequest | ProveClaimedRefRequest | ProveMarketplaceRemovalRequest
>;
