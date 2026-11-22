import type { Scope } from "../../../../shared/domain/scope.js";
import { bestEffortNativeCall, skippedWarning } from "../../domain/confirmation.js";
import { type EnableReadings, judgeRegistration } from "../../domain/policy/registration-policy.js";
import { pluginRefsOf } from "../../domain/record/registration-record.js";
import type { RegisteredMarketplace } from "./registration-outcome.js";
import { type RegistrationRun, warnRegistration } from "./registration-run.js";

/** The plugins to enable: the refs this run asks for, given the host name each proven
 * marketplace answers to. */
export interface EnableRequest {
  readonly scope: Scope;
  readonly refsToEnable: (hostNameByAlias: ReadonlyMap<string, string>) => string[];
}

export async function enableRefs(
  run: RegistrationRun,
  request: EnableRequest,
  proven: readonly RegisteredMarketplace[]
): Promise<string[]> {
  const hostNameByAlias = new Map(proven.map((m) => [m.alias, m.hostName]));
  const { toEnable, alreadyOwned } = await sortRefs(run, request.refsToEnable(hostNameByAlias));
  const enabledRefs = [...alreadyOwned];
  for (const ref of toEnable) {
    const call = bestEffortNativeCall(
      () => run.activator.enablePlugin(ref, request.scope),
      skippedWarning(`enable plugin '${ref}'`),
      (message) => warnRegistration(run, message)
    );
    if (call.confirmed) enabledRefs.push(ref);
  }
  return enabledRefs;
}

/** What the host and the records hold about the refs, read once. */
interface HeldRefs {
  readonly onHost: ReadonlyMap<string, { readonly enabled: boolean }> | undefined;
  readonly machineClaimed: ReadonlySet<string>;
  readonly ownRefs: readonly string[] | undefined;
  /** Whether this project's own claim on a ref it recorded still stands. */
  readonly ownClaimStands: boolean;
}

async function sortRefs(
  run: RegistrationRun,
  refs: string[]
): Promise<{ toEnable: string[]; alreadyOwned: string[] }> {
  const held = await heldRefs(run);
  if (held === undefined) return { toEnable: refs, alreadyOwned: [] };
  const toEnable: string[] = [];
  const alreadyOwned: string[] = [];
  for (const ref of refs) {
    const verdict = judgeRegistration(readingsOf(ref, held));
    if (verdict.outcome === "proceed") toEnable.push(ref);
    else if (verdict.reason === "owned") alreadyOwned.push(ref);
    else if (verdict.reason === "foreign")
      run.logger.info(
        `${run.toolId}: '${ref}' was already enabled before this project asked for it — left as it is, and this project's clean will leave it enabled.`
      );
  }
  return { toEnable, alreadyOwned };
}

/** What the host and the records hold, or nothing when the tool keeps no plugin registry. */
async function heldRefs(run: RegistrationRun): Promise<HeldRefs | undefined> {
  const { profile, claims } = run;
  const hostRegistry = run.hosts.pluginRegistries.get(profile.toolId);
  if (hostRegistry === undefined) return undefined;
  return {
    onHost: (await hostRegistry.read(run.projectRoot)).refs,
    machineClaimed: new Set((await claims.machine())?.claimedRefs),
    ownRefs: pluginRefsOf(claims.recorded),
    ownClaimStands: !profile.pluginEnablementIsMachineGlobal() || !claims.machineKept,
  };
}

function readingsOf(ref: string, held: HeldRefs): EnableReadings {
  return {
    intent: "enable",
    ref,
    enabledOnHost: held.onHost?.get(ref)?.enabled === true,
    claimedByMachine: held.machineClaimed.has(ref),
    recordedByProject: held.ownRefs?.includes(ref) === true,
    projectClaimStands: held.ownClaimStands,
  };
}
