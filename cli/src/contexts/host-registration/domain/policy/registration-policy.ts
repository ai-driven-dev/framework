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

/** A refresh needs the ref enabled and a canonical catalogue whose source is owned; `source` is
 * undefined when the ref has no canonical catalogue to read. */
export interface RefreshReadings {
  readonly intent: "refresh";
  readonly refEnabled: boolean;
  readonly source: SourceProof | undefined;
}

/** A catalogue withdrawal needs an owned source and every claimed ref still enabled;
 * `unenabledClaim` is the first claimed ref the host does not provably enable. */
export interface WithdrawCatalogReadings {
  readonly intent: "withdraw-catalog";
  readonly source: SourceProof;
  readonly unenabledClaim: string | undefined;
}

export type Readings = RegisterReadings | RefreshReadings | WithdrawCatalogReadings;

export type Refusal =
  | "not-canonical"
  | "host-unreadable"
  | "source-not-owned"
  | "foreign-ref"
  | "ref-not-enabled"
  | "no-canonical-source"
  | "claim-not-enabled";

type Found = { readonly reason: Refusal; readonly reconcile: string | undefined } | undefined;

const found = (reason: Refusal, reconcile: string | undefined): Found => ({ reason, reconcile });

/**
 * The one place that says whether a registration intent may touch a host catalogue, from
 * readings already made. A refusal names the first proof that failed; `reconcile` is what a
 * person must look at to lift it, never a message.
 */
export function judgeRegistration<R extends Readings>(readings: R): Verdict<R, Refusal> {
  const refusal = firstRefusal(readings);
  return refusal === undefined
    ? { outcome: "proceed", evidence: readings }
    : { outcome: "refuse", ...refusal };
}

function firstRefusal(readings: Readings): Found {
  switch (readings.intent) {
    case "register":
      return registerRefusal(readings);
    case "refresh":
      return refreshRefusal(readings);
    case "withdraw-catalog":
      return withdrawCatalogRefusal(readings);
  }
}

function registerRefusal(readings: RegisterReadings): Found {
  const { foreignRef } = readings;
  if (!readings.canonical) return found("not-canonical", foreignRef);
  if (!readings.hostReadable) return found("host-unreadable", foreignRef);
  if (readings.sourceStatus !== "owned") return found("source-not-owned", foreignRef);
  return foreignRef === undefined ? undefined : found("foreign-ref", foreignRef);
}

function refreshRefusal(readings: RefreshReadings): Found {
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
