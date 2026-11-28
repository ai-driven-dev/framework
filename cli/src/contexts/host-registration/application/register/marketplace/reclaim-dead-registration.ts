import { samePathSegment } from "../../../../../shared/domain/paths.model.js";
import { nativeActivationWarning } from "../../../contract/native-activation-warning.js";
import { bestEffortNativeCall, skippedWarning } from "../../../domain/confirmation.js";
import type { NativeRefusal } from "../../../domain/native-refusal.js";
import { judgeRegistration } from "../../../domain/policy/registration-policy.js";
import {
  parseBuiltMarketplaceDir,
  parseUserBuiltMarketplaceDir,
} from "../../../domain/source/built-marketplace-location.js";
import { resolvedOrSelf } from "../../check-marketplace-source.use-case.js";
import { nativeCatalogProof } from "../native-catalog-proof.js";
import {
  type RegistrationRun,
  type RegistrationSubject,
  warnRegistration,
} from "../registration-run.js";

/** The registration the host refused to add: the marketplace it belongs to, the name the host
 * knows it by (never the project's alias) and the directory this run built for it. */
export interface DeadRegistration {
  readonly marketplace: RegistrationSubject;
  readonly hostName: string;
  readonly builtDir: string;
}

// Reclaim only a dead registration (a host declaring `sourceCheckVerb`) whose current source is recognisably AIDD-owned.
// `hostName`, never the project's alias, names every host-facing call.
export async function reclaimOrReport(
  run: RegistrationRun,
  registration: DeadRegistration,
  addError: NativeRefusal
): Promise<boolean> {
  const { hostName } = registration;
  const warn = (message: string): void => warnRegistration(run, message);
  const refusal = await refusalToReclaim(run, registration, addError);
  if (refusal !== undefined) {
    warn(refusal);
    return false;
  }
  warn(
    `Marketplace '${hostName}' was registered to a directory that no longer exists; re-registering it for this project. Plugins installed from it are removed and the ones this CLI manages are put back.`
  );
  return replaceRegistration(run, registration);
}

/** Forced out, re-added, then every ref listed from it put back: Copilot's forced remove uninstalls them, Codex keeps them on the old build (probed 1.0.114, 0.172.0). */
export function replaceRegistration(
  run: RegistrationRun,
  { marketplace, hostName, builtDir }: DeadRegistration
): boolean {
  const warn = (message: string): void => warnRegistration(run, message);
  const { activator } = run;
  const installed = activator.refsInstalledFrom(hostName);
  if (installed === undefined) {
    warn(
      nativeActivationWarning(
        `marketplace '${hostName}' not moved to this build: the plugins installed from it could not be listed.`
      )
    );
    return false;
  }
  const removed = bestEffortNativeCall(
    () => activator.removeMarketplace(hostName, marketplace.scope, { force: true }),
    skippedWarning(`unregister stale marketplace '${hostName}'`),
    warn
  ).confirmed;
  if (!removed) return false;
  const added = bestEffortNativeCall(
    () => activator.addMarketplace(builtDir, marketplace.scope),
    skippedWarning(`register marketplace '${hostName}'`),
    warn
  ).confirmed;
  if (!added) return false;
  for (const ref of installed)
    bestEffortNativeCall(
      () => activator.enablePlugin(ref, marketplace.scope),
      skippedWarning(`enable plugin '${ref}'`),
      warn
    );
  return true;
}

/** Why a dead registration is not reclaimed, or `undefined` when it is ours to take back. */
async function refusalToReclaim(
  run: RegistrationRun,
  { marketplace, hostName }: DeadRegistration,
  addError: NativeRefusal
): Promise<string | undefined> {
  const judged = judgeRegistration({
    intent: "register",
    ...(await nativeCatalogProof(run, hostName)),
  });
  if (judged.outcome === "refuse") {
    const foreignRef = judged.reconcile;
    return nativeActivationWarning(
      `catalogue '${hostName}' collides with unproven AIDD ownership` +
        `${foreignRef === undefined ? "" : ` and foreign ref '${foreignRef}'`}; host registration left untouched. ${addError.detail}`
    );
  }
  if (!(await builtByThisCli(run, marketplace, hostName)))
    return nativeActivationWarning(
      `catalogue '${hostName}' host catalogue source is unproven; host registration left untouched. ${addError.detail}`
    );
  if (run.activator.registrationState(hostName) !== "dead")
    return skippedWarning(`register marketplace '${hostName}'`)(addError.detail);
  return undefined;
}

/** Whether the directory the host holds for `hostName` is one this CLI built for this very
 * marketplace and tool, under the project or the shared user cache. */
async function builtByThisCli(
  run: RegistrationRun,
  marketplace: RegistrationSubject,
  hostName: string
): Promise<boolean> {
  const { fs, platform, projectRoot } = run;
  const registeredSource = (await run.hosts.marketplaceRegistry?.read())?.entries?.get(hostName);
  if (registeredSource === undefined) return false;
  const source = await resolvedOrSelf(fs, registeredSource);
  const userRoot = run.userCacheRoot();
  const locations = [
    parseBuiltMarketplaceDir(await resolvedOrSelf(fs, projectRoot), source, platform),
    userRoot === ""
      ? undefined
      : parseUserBuiltMarketplaceDir(await resolvedOrSelf(fs, userRoot), source, platform),
  ];
  return locations.some(
    (location) =>
      location !== undefined &&
      samePathSegment(location.marketplaceName, marketplace.name, platform) &&
      samePathSegment(location.target, run.toolId, platform)
  );
}
