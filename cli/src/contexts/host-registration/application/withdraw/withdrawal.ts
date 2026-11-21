import type { Scope } from "../../../../shared/domain/scope.js";
import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import type { WithdrawalClaimsView } from "../../contract/claims-view.js";
import type {
  DependentClaim,
  RegistrationRecord,
  RegistrationRecordData,
} from "../../domain/record/registration-record.js";
import type { HostActions } from "../../ports/host-actions.js";
import type { HostPorts } from "../../ports/host-ports.js";
import type { NativeHostTool } from "../../ports/host-tool.js";

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
  /** The machine-wide claims on `tool`'s refs; `undefined` when no machine record exists. */
  readonly machineClaims: (tool: AiToolId) => Promise<readonly DependentClaim[] | undefined>;
  /** Runs `action` holding the machine record's lock when there is one to lock. */
  readonly exclusive: <T>(action: () => Promise<T>) => Promise<T>;
  readonly resolveCacheCandidate: CacheCandidateResolver;
}

/** Every question a withdrawal answers, told apart by `kind`: the proofs refuse before any host
 * change, the withdrawals act. */
export type WithdrawalRequest =
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
    }
  | {
      readonly kind: "withdraw-project-registrations";
      readonly withdrawals: readonly ProjectRegistrationWithdrawal[];
      readonly facts: ProjectCleanFacts;
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
export type WithdrawalStepRequest = Exclude<
  WithdrawalRequest,
  WithdrawPluginRequest | ProveClaimedRefRequest
>;
