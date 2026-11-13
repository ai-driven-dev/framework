import { compareSemver } from "../../../shared/domain/semver.js";

export interface UpdateFlags {
  /** Only say whether a newer release exists. */
  check: boolean;
  /** Say what would be installed, install nothing. */
  dryRun: boolean;
  /** Install although the installed version is not older. */
  force: boolean;
}

export type UpdateDecision =
  | "check-available"
  | "check-current"
  | "up-to-date"
  | "dry-run"
  | "install";

/** What `aidd update` does given the installed version, the latest release and the flags. */
export function decideUpdate(current: string, latest: string, flags: UpdateFlags): UpdateDecision {
  const outdated = compareSemver(current, latest) < 0;
  if (flags.check) return outdated ? "check-available" : "check-current";
  if (!outdated && !flags.force) return "up-to-date";
  return flags.dryRun ? "dry-run" : "install";
}
