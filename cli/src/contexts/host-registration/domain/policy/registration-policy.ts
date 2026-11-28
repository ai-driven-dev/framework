import type { Verdict } from "./verdict.js";

/** What a reading proved about who owns a catalogue's source. */
export interface SourceProof {
  readonly status: "absent" | "owned" | "unproven";
  readonly reason?: string;
}

/** What was proven about a host catalogue before a registration touches it. */
export interface RegisterReadings {
  readonly intent: "register";
  readonly canonical: boolean;
  readonly hostReadable: boolean;
  readonly sourceStatus: SourceProof["status"];
  readonly foreignRef?: string;
}

/** The proofs a refresh and a ref withdrawal share: the ref enabled on the host and a canonical
 * catalogue whose source is owned; `source` is undefined when the ref has no canonical catalogue
 * to read. */
interface RefProofReadings {
  readonly refEnabled: boolean;
  readonly source: SourceProof | undefined;
}

export interface RefreshReadings extends RefProofReadings {
  readonly intent: "refresh";
}

export interface WithdrawRefReadings extends RefProofReadings {
  readonly intent: "withdraw-ref";
}

/** A catalogue withdrawal needs an owned source and every claimed ref still enabled;
 * `unenabledClaim` is the first claimed ref the host does not provably enable. */
export interface WithdrawCatalogReadings {
  readonly intent: "withdraw-catalog";
  readonly source: SourceProof;
  readonly unenabledClaim: string | undefined;
}

/** What the host and the records hold about one ref a run asks to enable. */
export interface EnableReadings {
  readonly intent: "enable";
  readonly ref: string;
  readonly enabledOnHost: boolean;
  readonly claimedByMachine: boolean;
  readonly recordedByProject: boolean;
  /** Whether this project's own claim on a ref it recorded still stands. */
  readonly projectClaimStands: boolean;
}

export type Readings =
  | RegisterReadings
  | EnableReadings
  | RefreshReadings
  | WithdrawRefReadings
  | WithdrawCatalogReadings;

export type Refusal =
  | "not-canonical"
  | "host-unreadable"
  | "source-not-owned"
  | "ref-not-enabled"
  | "no-canonical-source"
  | "claim-not-enabled";

/** Why a ref already enabled on the host is left alone: a claim covers it, this project's
 * claim was handed on, or somebody else enabled it first. */
export type EnableSkip = "owned" | "kept" | "foreign";

type Found = { readonly reason: Refusal; readonly reconcile: string | undefined } | undefined;

const found = (reason: Refusal, reconcile: string | undefined): Found => ({ reason, reconcile });

/**
 * The one place that says whether a registration intent may touch a host catalogue, from
 * readings already made. A refusal names the first proof that failed; `reconcile` is what a
 * person must look at to lift it, never a message.
 */
export function judgeRegistration(
  readings: EnableReadings
): Verdict<EnableReadings, never, EnableSkip>;
export function judgeRegistration<R extends Exclude<Readings, EnableReadings>>(
  readings: R
): Verdict<R, Refusal>;
export function judgeRegistration(readings: Readings): Verdict<Readings, Refusal, EnableSkip> {
  if (readings.intent === "enable") return judgeEnable(readings);
  const refusal = firstRefusal(readings);
  return refusal === undefined
    ? { outcome: "proceed", evidence: readings }
    : { outcome: "refuse", ...refusal };
}

function judgeEnable(readings: EnableReadings): Verdict<EnableReadings, never, EnableSkip> {
  if (!readings.enabledOnHost) return { outcome: "proceed", evidence: readings };
  if (readings.claimedByMachine) return { outcome: "skip", reason: "owned" };
  if (!readings.recordedByProject) return { outcome: "skip", reason: "foreign" };
  return { outcome: "skip", reason: readings.projectClaimStands ? "owned" : "kept" };
}

function firstRefusal(readings: Exclude<Readings, EnableReadings>): Found {
  switch (readings.intent) {
    case "register":
      return registerRefusal(readings);
    case "refresh":
    case "withdraw-ref":
      return refProofRefusal(readings);
    case "withdraw-catalog":
      return withdrawCatalogRefusal(readings);
  }
}

/** The ref no claim names that refuses a registration: on an owned source it is the person's own,
 * tolerated, never adopted and never removed, so only a source aidd does not own names one. */
export function refusingForeignRef(
  readings: Pick<RegisterReadings, "sourceStatus" | "foreignRef">
): string | undefined {
  return readings.sourceStatus === "owned" ? undefined : readings.foreignRef;
}

function registerRefusal(readings: RegisterReadings): Found {
  const foreignRef = refusingForeignRef(readings);
  if (!readings.canonical) return found("not-canonical", foreignRef);
  if (!readings.hostReadable) return found("host-unreadable", foreignRef);
  if (readings.sourceStatus !== "owned") return found("source-not-owned", foreignRef);
  return undefined;
}

function refProofRefusal(readings: RefProofReadings): Found {
  if (!readings.refEnabled) return found("ref-not-enabled", undefined);
  if (readings.source === undefined) return found("no-canonical-source", undefined);
  return readings.source.status === "owned"
    ? undefined
    : found("source-not-owned", readings.source.reason);
}

function withdrawCatalogRefusal(readings: WithdrawCatalogReadings): Found {
  if (readings.source.status !== "owned") return found("source-not-owned", readings.source.reason);
  return readings.unenabledClaim === undefined
    ? undefined
    : found("claim-not-enabled", readings.unenabledClaim);
}
