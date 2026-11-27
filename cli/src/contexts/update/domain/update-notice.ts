import { compareSemver, isSemver } from "../../../shared/domain/plugin/semver.js";

/** What the last check learned: when it ran, and the latest release it saw. */
export interface CheckEntry {
  checkedAt: number;
  latest: string;
}

const withoutV = (version: string): string => version.replace(/^v/, "");

/** The two versions a person running `current` is told about, none when nothing newer is
 * known or when `current` is no release (a development build). */
export interface UpdateNotice {
  current: string;
  latest: string;
}

export function noticeFor(entry: CheckEntry, current: string): UpdateNotice | null {
  if (!isSemver(current) || compareSemver(current, entry.latest) >= 0) return null;
  return { current: withoutV(current), latest: withoutV(entry.latest) };
}
