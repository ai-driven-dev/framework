import { judgeRegistration } from "../../domain/policy/registration-policy.js";
import { isRefOnHost } from "../../domain/record/host-ref.js";
import {
  type RegistrationRecord,
  recordedRegistrations,
} from "../../domain/record/registration-record.js";
import type { HostActions } from "../../ports/host-actions.js";
import {
  assertNoForeignNativeRefs,
  inspectNativeMarketplaceSource,
} from "../native-marketplace-source-proof.js";
import {
  callHost,
  describeSharedSourceSurvival,
  machineRefs,
  survivingCachePaths,
  uninstallAtFirstAcceptedScope,
} from "./host-call.js";
import { resolveUninstallScopeOrder } from "./uninstall-scope-order.js";
import type {
  ProjectCleanFacts,
  ProjectRegistrationWithdrawal,
  RemovedFromHost,
  WithdrawalDeps,
} from "./withdrawal.js";

/** One tool's withdrawal, with the host CLI proven reachable. */
interface ProjectToolRun {
  readonly deps: WithdrawalDeps;
  readonly activator: HostActions;
  readonly withdrawal: ProjectRegistrationWithdrawal;
  readonly registrations: RegistrationRecord;
  readonly facts: ProjectCleanFacts;
}

type RegisteredMarketplace = RegistrationRecord["marketplaces"][number];

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
  const activator = deps.ports.activators.get(binary);
  if (activator === undefined || !activator.isAvailable()) {
    deps.logger.warn(
      `${binary}: registration left in place, the ${binary} CLI is not on the PATH.` +
        survivingCachePaths(withdrawal.cacheRoot, registrations)
    );
    return undefined;
  }
  const run = { deps, activator, withdrawal, registrations, facts };
  // Every plugin ref uninstalled before any marketplace is removed: only Copilot
  // declares `forceRemoveArgs`, so Claude and Codex can refuse to remove a
  // marketplace that still has plugins installed from it.
  for (const ref of registrations.pluginRefs) {
    await uninstallProjectRef(run, ref);
  }
  const removedHostNames = new Set<string>();
  for (const { alias, hostName } of registrations.marketplaces) {
    if (await removeProjectMarketplace(run, alias, hostName)) removedHostNames.add(hostName);
  }
  return removedHostNames;
}

/**
 * Uninstalls one plugin ref at the scope it was actually registered at, never a default:
 * `resolveUninstallScopeOrder` asks the host's own registry first. A real `claude` binary
 * refuses a mismatched-scope uninstall outright, so the resolved list is tried in order until
 * one succeeds; best-effort throughout, a ref the host will not forget is named, not thrown.
 */
async function uninstallProjectRef(run: ProjectToolRun, ref: string): Promise<void> {
  const { deps, activator, withdrawal, registrations, facts } = run;
  if (await leftEnabledForMachine(run, ref)) return;
  const sourceRegistration = await provenCatalogue(run, ref);
  if (sourceRegistration === undefined) return;
  const reader = deps.ports.pluginRegistries.get(withdrawal.tool.toolId);
  try {
    await assertNoForeignNativeRefs(
      { reader, tool: withdrawal.tool },
      {
        hostName: sourceRegistration.hostName,
        ownedRefs: new Set([
          ...registrations.pluginRefs,
          ...(await machineRefs(facts, withdrawal.tool.toolId)),
        ]),
        projectRoot: facts.projectRoot,
      }
    );
  } catch (error) {
    deps.logger.warn(`${registrations.binary}: '${ref}' left enabled; ${String(error)}`);
    return;
  }
  const order = await resolveUninstallScopeOrder({
    reader,
    ref,
    projectRoot: facts.projectRoot,
    manifestScope: withdrawal.refScopes.get(ref) ?? "project",
  });
  const refusal = uninstallAtFirstAcceptedScope(activator, ref, order);
  if (refusal !== undefined)
    deps.logger.warn(`${registrations.binary} plugin uninstall '${ref}' failed: ${refusal}`);
}

/** A ref a machine claim owns, or one a machine-global host cannot prove unused, stays enabled and
 * is named; `true` when it was left. */
async function leftEnabledForMachine(run: ProjectToolRun, ref: string): Promise<boolean> {
  const { deps, withdrawal, registrations, facts } = run;
  const { tool } = withdrawal;
  const { binary } = registrations;
  const claim = (await facts.machineClaims(tool.toolId))?.find(
    (candidate) => candidate.ref === ref
  );
  if (claim !== undefined) {
    const others = claim.dependents.filter((dependent) => dependent !== facts.projectRoot);
    deps.logger.warn(
      `${binary}: '${ref}' is an AIDD-owned machine plugin ref — left enabled; project claim detached after local clean.${others.length > 0 ? ` Still needed by ${others.join(", ")}.` : ""}`
    );
    return true;
  }
  if (!tool.pluginEnablementIsMachineGlobal()) return false;
  const sharedHostName = registrations.marketplaces.find(
    (registration) => registration.alias === facts.sharedSource?.alias
  )?.hostName;
  const otherProjects =
    sharedHostName !== undefined && isRefOnHost(ref, sharedHostName)
      ? (facts.sharedSource?.otherProjects ?? [])
      : [];
  deps.logger.warn(
    `${binary}: '${ref}' has no canonical machine claim — left enabled for manual reconciliation; project claim detached after local clean.${otherProjects.length > 0 ? ` Still needed by ${otherProjects.join(", ")}.` : ""}`
  );
  return true;
}

/** The catalogue `ref` came from once the host's source for it is proven owned; otherwise the
 * ref is named as left enabled and nothing is returned. */
async function provenCatalogue(
  run: ProjectToolRun,
  ref: string
): Promise<RegisteredMarketplace | undefined> {
  const { deps, withdrawal, registrations, facts } = run;
  const { binary } = registrations;
  const sourceRegistration = registrations.marketplaces.find((registration) =>
    isRefOnHost(ref, registration.hostName)
  );
  if (sourceRegistration === undefined) {
    deps.logger.warn(`${binary}: '${ref}' has no recorded host catalogue — left enabled.`);
    return undefined;
  }
  const proof = await inspectNativeMarketplaceSource(
    deps.ports.sources.get(withdrawal.tool.toolId),
    facts.projectRoot,
    sourceRegistration
  );
  const verdict = judgeRegistration({
    intent: "withdraw-catalog",
    source: proof,
    unenabledClaim: undefined,
  });
  if (verdict.outcome === "refuse") {
    deps.logger.warn(
      `${binary}: '${ref}' left enabled because its current host catalogue is unproven. ${verdict.reconcile ?? "Reconcile manually."}`
    );
    return undefined;
  }
  return sourceRegistration;
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
    deps.logger.warn(
      `${binary}: '${hostName}' is shared by every project on this machine — left registered. ` +
        describeSharedSourceSurvival(hostName, withdrawal.cacheRoot, facts.sharedSource)
    );
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
  const machine = await facts.machineClaims(tool.toolId);
  if (machine === undefined && alias !== facts.frameworkAlias) {
    deps.logger.warn(
      `${binary}: '${hostName}' is machine-global but no user manifest can prove no other project still uses it — left registered for manual cleanup.`
    );
    return true;
  }
  const claims = (machine ?? []).filter((claim) => isRefOnHost(claim.ref, hostName));
  if (claims.length === 0) return false;
  const others = [
    ...new Set(
      claims.flatMap((claim) =>
        claim.dependents.filter((dependent) => dependent !== facts.projectRoot)
      )
    ),
  ];
  deps.logger.warn(
    `${binary}: '${hostName}' carries AIDD-owned machine plugin refs — left registered for explicit user-scope removal.${others.length > 0 ? ` Still needed by ${others.join(", ")}.` : ""}`
  );
  return true;
}
