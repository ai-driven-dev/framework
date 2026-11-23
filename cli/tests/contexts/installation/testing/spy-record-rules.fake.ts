import { vi } from "vitest";
import { registrationRecordRules } from "../../../../src/composition/contexts/installation.js";

type RecordRules = typeof registrationRecordRules;

/** What every rewrite of the spied rules stamps on the record it hands back, so a test can tell
 * a record the host rewrote from one the use case built itself. */
export const REWRITTEN_BINARY = "rewritten-by-the-host";

type CallOf<Rule extends keyof RecordRules> = (...asked: Parameters<RecordRules[Rule]>) => void;

/** The record rules with each rewrite spied and answering a record only the host could have
 * produced. The lookups stay the real ones. A spy records what the rule was asked: a mock cannot
 * keep a rule's generic signature, so the rule itself is an arrow that calls it. */
export function spiedRecordRules() {
  const withoutRef = vi.fn<CallOf<"withoutRef">>();
  const withoutClaimedRef = vi.fn<CallOf<"withoutClaimedRef">>();
  const withoutMarketplace = vi.fn<CallOf<"withoutMarketplace">>();
  const rules: RecordRules = {
    ...registrationRecordRules,
    withoutRef: (record, ref) => {
      withoutRef(record, ref);
      return { ...record, binary: REWRITTEN_BINARY };
    },
    withoutClaimedRef: (record, ref) => {
      withoutClaimedRef(record, ref);
      return { ...record, binary: REWRITTEN_BINARY, pluginClaims: record.pluginClaims ?? [] };
    },
    withoutMarketplace: (record, alias) => {
      withoutMarketplace(record, alias);
      return { ...record, binary: REWRITTEN_BINARY, pluginClaims: record.pluginClaims ?? [] };
    },
  };
  return { rules, withoutRef, withoutClaimedRef, withoutMarketplace };
}
