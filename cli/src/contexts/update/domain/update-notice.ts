import { compareSemver, isSemver } from "../../../shared/domain/semver.js";

/** What the last check learned: when it ran, and the latest release it saw. */
export interface CheckEntry {
  checkedAt: number;
  latest: string;
}

const withoutV = (version: string): string => version.replace(/^v/, "");

/** The lines to show a person running `current`, none when nothing newer is known or when
 * `current` is no release (a development build). */
export function noticeFor(entry: CheckEntry, current: string): string[] {
  if (!isSemver(current) || compareSemver(current, entry.latest) >= 0) return [];
  return [
    `CLI update available: v${withoutV(current)} → v${withoutV(entry.latest)}`,
    "Run `aidd update`.",
  ];
}
