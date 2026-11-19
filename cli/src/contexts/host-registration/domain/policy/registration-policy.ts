import type { Verdict } from "./verdict.js";

/** What was proven about a host catalogue before a registration touches it. */
export interface RegisterReadings {
  readonly intent: "register";
  readonly canonical: boolean;
  readonly hostReadable: boolean;
  readonly sourceStatus: "absent" | "owned" | "unproven";
  readonly foreignRef?: string;
}

export type RegisterRefusal =
  | "not-canonical"
  | "host-unreadable"
  | "source-not-owned"
  | "foreign-ref";

/**
 * The one place that says whether a registration intent may touch a host catalogue, from
 * readings already made. A refusal names the first proof that failed; `reconcile` is what a
 * person must look at to lift it, never a message.
 */
export function judgeRegistration(
  readings: RegisterReadings
): Verdict<RegisterReadings, RegisterRefusal> {
  const refuse = (reason: RegisterRefusal) =>
    ({ outcome: "refuse", reason, reconcile: readings.foreignRef }) as const;
  if (!readings.canonical) return refuse("not-canonical");
  if (!readings.hostReadable) return refuse("host-unreadable");
  if (readings.sourceStatus !== "owned") return refuse("source-not-owned");
  if (readings.foreignRef !== undefined) return refuse("foreign-ref");
  return { outcome: "proceed", evidence: readings };
}
