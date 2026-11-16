import type { MarketplaceScope } from "../../../shared/domain/scope.js";
import type { AiToolId } from "../../../shared/domain/tool.js";
import type { AiToolProfile } from "../../tools/contract/tool-profile.js";
import type { RegistrationRecord } from "./registration-record.js";

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
