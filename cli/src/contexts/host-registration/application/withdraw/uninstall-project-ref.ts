import { isRefOnHost } from "../../domain/record/host-ref.js";
import type { RegistrationRecord } from "../../domain/record/registration-record.js";
import { judgeCatalogueWithdrawal } from "../../domain/source-proof.js";
import type { HostActions } from "../../ports/host-actions.js";
import { inspectHostSource } from "../read-host.js";
import { inspectForeignRefs, stillNeededBy, uninstallAtFirstAcceptedScope } from "./host-call.js";
import { resolveUninstallScopeOrder } from "./uninstall-scope-order.js";
import type {
  ProjectCleanFacts,
  ProjectRegistrationWithdrawal,
  WithdrawalDeps,
} from "./withdrawal.js";

/** One tool's withdrawal, with the host CLI proven reachable. */
export interface ProjectToolRun {
  readonly deps: WithdrawalDeps;
  readonly activator: HostActions;
  readonly withdrawal: ProjectRegistrationWithdrawal;
  readonly registrations: RegistrationRecord;
  readonly facts: ProjectCleanFacts;
}

type RegisteredMarketplace = RegistrationRecord["marketplaces"][number];

/**
 * Uninstalls one plugin ref at the scope it was actually registered at, never a default:
 * `resolveUninstallScopeOrder` asks the host's own registry first. A real `claude` binary
 * refuses a mismatched-scope uninstall outright, so the resolved list is tried in order until
 * one succeeds; best-effort throughout, a ref the host will not forget is named, not thrown.
 */
export async function uninstallProjectRef(run: ProjectToolRun, ref: string): Promise<void> {
  const { deps, activator, withdrawal, registrations, facts } = run;
  if (await leftEnabledForMachine(run, ref)) return;
  const sourceRegistration = await provenCatalogue(run, ref);
  if (sourceRegistration === undefined) return;
  const reader = deps.ports.pluginRegistries.get(withdrawal.tool.toolId);
  const held = await inspectForeignRefs(deps, run, sourceRegistration.hostName);
  if ("refusal" in held) {
    deps.logger.warn(
      `${registrations.binary}: '${ref}' left enabled; Error: ${held.refusal.detail}`
    );
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
  if ((await facts.machine.claimedRefs(tool.toolId))?.includes(ref) === true) {
    const others = await facts.machine.othersHolding(tool.toolId, [ref], facts.projectRoot);
    deps.logger.warn(
      `${binary}: '${ref}' is an AIDD-owned machine plugin ref — left enabled; project claim detached after local clean.${stillNeededBy(others)}`
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
    `${binary}: '${ref}' has no canonical machine claim — left enabled for manual reconciliation; project claim detached after local clean.${stillNeededBy(otherProjects)}`
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
  const proof = await inspectHostSource(
    deps.ports.sources.get(withdrawal.tool.toolId),
    facts.projectRoot,
    sourceRegistration
  );
  const verdict = judgeCatalogueWithdrawal(proof);
  if (verdict.outcome === "refuse") {
    deps.logger.warn(
      `${binary}: '${ref}' left enabled because its current host catalogue is unproven. ${verdict.reconcile ?? "Reconcile manually."}`
    );
    return undefined;
  }
  return sourceRegistration;
}
