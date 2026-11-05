import { type CloneIdentity, sameClone } from "../consent/clone-identity.js";
import type { ConsentInterval } from "../consent/consent-history.js";
import type { StoredUsage } from "../stored-usage.js";
import { type AttributionFacts, attribute } from "./attribution.js";

export type SessionFeature =
  | { readonly state: "unbound" | "ambiguous" }
  | { readonly state: "confirmed"; readonly feature: string; readonly branch: string };

export interface SessionAdmission {
  readonly feature: SessionFeature;
  readonly cwd: string | null;
  readonly repositoryId: string | null;
}

/** A session cannot move to another clone or repository during a pending delivery. */
export function sameSessionAdmission(
  expected: SessionAdmission | undefined,
  current: SessionAdmission | undefined
): boolean {
  return Boolean(
    expected?.cwd &&
      expected.repositoryId &&
      current?.cwd === expected.cwd &&
      current.repositoryId === expected.repositoryId
  );
}

export function sameSessionFeature(left: SessionFeature, right: SessionFeature): boolean {
  return (
    left.state === right.state &&
    (left.state !== "confirmed" ||
      (right.state === "confirmed" &&
        left.feature === right.feature &&
        left.branch === right.branch))
  );
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: control characters cannot name a branch
const CONTROL = /[\u0000-\u001f\u007f]/u;

/** A cumulative point may only cross time covered by one uninterrupted consent interval. */
export function coversConsentWindow(
  intervals: readonly ConsentInterval[],
  clone: CloneIdentity,
  start: number,
  end: number
): boolean {
  return (
    start <= end &&
    intervals.some(
      (interval) =>
        sameClone(interval.clone, clone) &&
        interval.from <= start &&
        (interval.to === null || end < interval.to)
    )
  );
}

/** A whole session is linked only when every recorded call agrees on an explicitly declared
 * canonical ticket and an observed branch. An unknown call is never assigned by proximity. */
export function sessionFeatureOf(
  records: readonly StoredUsage[],
  facts: AttributionFacts
): SessionFeature {
  let candidate: { feature: string; branch: string } | undefined;
  let missing = false;
  for (const record of records) {
    const resolution = attribute(record, facts);
    const feature = resolution.state === "attributed" ? resolution.ticket : null;
    const branch = record.git_branch;
    if (
      !feature ||
      !/^[^\s/#]+\/[^\s/#]+#[1-9][0-9]*$/u.test(feature) ||
      !branch ||
      branch.length > 255 ||
      CONTROL.test(branch)
    ) {
      missing = true;
      continue;
    }
    if (candidate && (candidate.feature !== feature || candidate.branch !== branch))
      return { state: "ambiguous" };
    candidate = { feature, branch };
  }
  if (!candidate) return { state: "unbound" };
  return missing ? { state: "ambiguous" } : { state: "confirmed", ...candidate };
}
