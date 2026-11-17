import { vi } from "vitest";
import { registrationRecordRules } from "../../src/composition/installation.js";
import type { RegistrationRecordRules } from "../../src/contexts/installation/ports/native-host.js";

/** What every rewrite of the spied rules stamps on the record it hands back, so a test can tell
 * a record the host rewrote from one the use case built itself. */
export const REWRITTEN_BINARY = "rewritten-by-the-host";

const rewritten = <R extends { readonly binary: string }>(record: R): R => ({
  ...record,
  binary: REWRITTEN_BINARY,
});

/** The record rules with each rewrite spied and answering a record only the host could have
 * produced. The lookups stay the real ones. */
export function spiedRecordRules() {
  const withoutRef = vi.fn(rewritten);
  const withoutClaimedRef = vi.fn(rewritten);
  const withoutMarketplace = vi.fn(rewritten);
  const rules = {
    ...registrationRecordRules,
    withoutRef,
    withoutClaimedRef,
    withoutMarketplace,
  } as RegistrationRecordRules;
  return { rules, withoutRef, withoutClaimedRef, withoutMarketplace };
}
