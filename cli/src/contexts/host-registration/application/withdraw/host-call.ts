/** What every withdrawal step shares: the host call, the host's own names, and what survives a skip.
 * A step imports this and `withdrawal.ts`, never another step. */
import { join } from "node:path";
import type { Scope } from "../../../../shared/domain/scope.js";
import type { AiToolId } from "../../../../shared/domain/tool.js";
import { NativePluginCliError } from "../../domain/host-registration.error.js";
import type { RegistrationRecord } from "../../domain/record/registration-record.js";
import type { HostActions } from "../../ports/host-actions.js";
import { bestEffortNativeCall } from "../confirmation.js";
import type { ProjectCleanFacts, WithdrawalDeps } from "./withdrawal.js";

/** Runs `action` against the host, naming a failure in a warning instead of throwing it. */
export function callHost(deps: WithdrawalDeps, action: () => void, label: string): boolean {
  return bestEffortNativeCall(
    action,
    (reason) => `${label} failed: ${reason}`,
    (warning) => deps.logger.warn(warning)
  ).confirmed;
}

/** The first refusal message when the host accepted no scope in `order`, else `undefined`. */
export function uninstallAtFirstAcceptedScope(
  activator: HostActions,
  ref: string,
  order: readonly Scope[]
): string | undefined {
  let lastMessage = "";
  for (const scope of order) {
    try {
      activator.uninstallPlugin(ref, scope);
      return undefined;
    } catch (error) {
      if (!(error instanceof NativePluginCliError)) throw error;
      lastMessage = error.detail;
    }
  }
  return lastMessage;
}

/** One marketplace's own surviving cache path: empty for a host that keeps no plugin cache. */
export function survivingCachePath(hostName: string, cacheRoot: string | undefined): string {
  return cacheRoot === undefined ? "" : `, and its cache at: ${join(cacheRoot, hostName)}`;
}

/** Named for the "not on the PATH" warning: the cache a skipped tool would have had purged
 * survives silently unless this names it. */
export function survivingCachePaths(
  cacheRoot: string | undefined,
  registrations: RegistrationRecord
): string {
  if (cacheRoot === undefined) return "";
  const paths = registrations.marketplaces.map((m) => join(cacheRoot, m.hostName));
  return paths.length === 0 ? "" : ` Its cache survives at: ${paths.join(", ")}.`;
}

/** What survives a shared registration this run left in place, plus which other projects still
 * claim the shared source: purging it is a machine-scope decision, not one project's `clean`. */
export function describeSharedSourceSurvival(
  hostName: string,
  cacheRoot: string | undefined,
  sharedSource: ProjectCleanFacts["sharedSource"]
): string {
  const base = `Its entry survives at userConfigDir()/marketplaces.json${survivingCachePath(hostName, cacheRoot)}.`;
  if (sharedSource === undefined) return base;
  const { otherProjects } = sharedSource;
  if (otherProjects.length > 0) {
    const plural = otherProjects.length === 1 ? "project" : "projects";
    return `${base} Still referenced by ${otherProjects.length} other ${plural} on this machine.`;
  }
  return `${base} No project on this machine still references it — \`aidd clean --scope user\` is what purges it for the machine.`;
}

/** The host's own name for `alias`; `undefined` when `registrations` is absent or names no entry
 * for it. `alias` is aidd's own key into this project's registry, never what a host learns. */
export function hostNameFor(
  registrations: RegistrationRecord | undefined,
  alias: string
): string | undefined {
  return registrations?.marketplaces.find((m) => m.alias === alias)?.hostName;
}

export async function machineRefs(
  facts: ProjectCleanFacts,
  tool: AiToolId
): Promise<readonly string[]> {
  return ((await facts.machineClaims(tool)) ?? []).map((claim) => claim.ref);
}
