import type { HintedMessage } from "../../../shared/domain/describe-error.js";
/** A registration record as the machine keeps it: opaque here, narrowed by the one reader that
 * owns its shape. */
export type RegistrationRecordView = Readonly<Record<string, unknown>>;

/** What the machine-wide record holds for a tool. Read when needed, never ahead of it. */
export type MachineRegistrationsView = RegistrationRecordView & {
  readonly pluginClaims?: readonly { readonly ref: string }[];
};

/** What other records say about a tool's registrations, handed over by the caller that owns
 * them. A value, not a port: the context never reaches the records itself. */
export interface ClaimsView {
  /** The registrations this run's own record already holds for the tool. */
  readonly recorded: RegistrationRecordView | undefined;
  /** The machine-wide record, absent when it is empty or not kept. */
  readonly machine: () => Promise<MachineRegistrationsView | undefined>;
  /** Whether a machine-wide record is kept at all. */
  readonly machineKept: boolean;
  /** The project record as last saved. */
  readonly persistedProject: () => Promise<RegistrationRecordView | undefined>;
}

/** The facts about machine-wide ownership a withdrawal depends on, none of which this context
 * may read itself: the caller answers them from where claims live. */
export interface WithdrawalClaimsView {
  /** Whether a canonical machine claim owns `ref`. */
  readonly isMachineOwned: (ref: string) => Promise<boolean>;
  /** The warning that says why `ref` must stay enabled for another project, if it must. */
  readonly guardMessage: (
    binary: string,
    ref: string,
    alias: string
  ) => Promise<string | HintedMessage | undefined>;
  /** `<cacheRoot>/<relativeSegments>` once proven to sit inside `cacheRoot`, else `null`. */
  readonly resolveCacheCandidate: (
    cacheRoot: string,
    relativeSegments: string,
    label: string
  ) => Promise<string | null>;
}
