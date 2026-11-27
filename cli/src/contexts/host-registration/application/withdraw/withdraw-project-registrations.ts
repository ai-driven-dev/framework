import { isRefOnHost } from "../../domain/record/host-ref.js";
import { recordedRegistrations } from "../../domain/record/registration-record.js";
import {
  callHost,
  describeSharedSourceSurvival,
  stillNeededBy,
  survivingCachePaths,
} from "./host-call.js";
import { type ProjectToolRun, uninstallProjectRef } from "./uninstall-project-ref.js";
import type {
  ProjectCleanFacts,
  ProjectRegistrationWithdrawal,
  RemovedFromHost,
  WithdrawalDeps,
} from "./withdrawal.js";

/**
 * Asks each tool's own CLI to forget what this project registered, never by a direct edit of the
 * host's own registry file: that file is the host's to write. Returns the tools it withdrew from,
 * for the caller to purge their caches once every tool is undone.
 *
 * A tool whose binary is absent is named and left alone, so it is never returned.
 */
export async function withdrawProjectRegistrations(
  deps: WithdrawalDeps,
  withdrawals: readonly ProjectRegistrationWithdrawal[],
  facts: ProjectCleanFacts
): Promise<readonly RemovedFromHost[]> {
  const removed: RemovedFromHost[] = [];
  for (const withdrawal of withdrawals) {
    const registrations = recordedRegistrations(withdrawal.registrations);
    const removedHostNames = await withdrawProjectTool(deps, { withdrawal, registrations }, facts);
    if (removedHostNames !== undefined) {
      removed.push({ withdrawal, registrations, removedHostNames });
    }
  }
  return removed;
}

async function withdrawProjectTool(
  deps: WithdrawalDeps,
  { withdrawal, registrations }: Pick<ProjectToolRun, "withdrawal" | "registrations">,
  facts: ProjectCleanFacts
): Promise<ReadonlySet<string> | undefined> {
  const { binary } = registrations;
  const activator = deps.ports.reachableActivator(binary);
  if (activator === undefined) {
    deps.logger.warn(
      `${binary}: registration left in place, the ${binary} CLI is not on the PATH.` +
        survivingCachePaths(withdrawal.cacheRoot, registrations)
    );
    return undefined;
  }
  const run = { deps, activator, withdrawal, registrations, facts };
  // Every plugin ref uninstalled before any marketplace is removed: only Copilot declares
  // `forceRemoveArgs`, Claude can refuse a plain remove, and Codex's leaves the refs enabled (probed 0.172.0).
  for (const ref of registrations.pluginRefs) {
    await uninstallProjectRef(run, ref);
  }
  const removedHostNames = new Set<string>();
  for (const { alias, hostName } of registrations.marketplaces) {
    if (await removeProjectMarketplace(run, alias, hostName)) removedHostNames.add(hostName);
  }
  return removedHostNames;
}

// `alias` resolves this project's own registry entry, the only place its `scope` is recorded;
// `hostName` is what reaches the host's own CLI, since a host knows a registration only by its
// catalog's own declared name. The two differ whenever a project registers under an alias its
// catalog does not declare, a supported capability: passing `alias` to a host-facing call
// would ask it to remove a name it never held.
async function removeProjectMarketplace(
  run: ProjectToolRun,
  alias: string,
  hostName: string
): Promise<boolean> {
  const { deps, activator, withdrawal, registrations, facts } = run;
  const { binary } = registrations;
  const scope = facts.marketplaceScopes.get(alias);
  if (scope === undefined) {
    deps.logger.warn(
      `${binary}: '${alias}' is no longer a registered marketplace here, so its scope cannot be resolved — its ${binary} registration was left in place.`
    );
    return false;
  }
  if (scope === "user") {
    // Machine-scope: every project on this machine shares this one registration, so a single
    // project's `clean` must never unregister it. Three things survive, not one: the host's
    // own registration, the `userConfigDir()/marketplaces.json` entry, and this tool's own
    // plugin cache, named by its absolute path when the profile declares one.
    const survival = describeSharedSourceSurvival(
      hostName,
      withdrawal.cacheRoot,
      facts.sharedSource
    );
    deps.logger.warn({
      ...survival,
      text: `${binary}: '${hostName}' is shared by every project on this machine — left registered. ${survival.text}`,
    });
    return false;
  }
  return facts.exclusive(async () => {
    if (await heldByMachine(run, alias, hostName)) return false;
    return callHost(
      deps,
      () => activator.removeMarketplace(hostName, scope),
      `${binary} marketplace remove '${hostName}'`
    );
  });
}

/** A machine-global host's marketplace another project may still use is left registered and
 * named; `true` when it was left. */
async function heldByMachine(
  run: ProjectToolRun,
  alias: string,
  hostName: string
): Promise<boolean> {
  const { deps, withdrawal, registrations, facts } = run;
  const { tool } = withdrawal;
  if (!tool.pluginEnablementIsMachineGlobal()) return false;
  const { binary } = registrations;
  const machine = await facts.machine.claimedRefs(tool.toolId);
  if (machine === undefined && alias !== facts.frameworkAlias) {
    deps.logger.warn(
      `${binary}: '${hostName}' is machine-global but no user manifest can prove no other project still uses it — left registered for manual cleanup.`
    );
    return true;
  }
  const refs = (machine ?? []).filter((ref) => isRefOnHost(ref, hostName));
  if (refs.length === 0) return false;
  const others = await facts.machine.othersHolding(tool.toolId, refs, facts.projectRoot);
  deps.logger.warn(
    `${binary}: '${hostName}' carries AIDD-owned machine plugin refs — left registered for explicit user-scope removal.${stillNeededBy(others)}`
  );
  return true;
}
