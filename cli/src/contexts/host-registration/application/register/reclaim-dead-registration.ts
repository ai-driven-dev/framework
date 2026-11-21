import { samePathSegment } from "../../../../shared/domain/paths.js";
import type { NativePluginCliError } from "../../domain/host-registration.error.js";
import { judgeRegistration } from "../../domain/policy/registration-policy.js";
import {
  parseBuiltMarketplaceDir,
  parseUserBuiltMarketplaceDir,
} from "../../domain/source/built-marketplace-location.js";
import { bestEffortNativeCall, skippedWarning } from "../confirmation.js";
import { nativeCatalogProof } from "./native-catalog-proof.js";
import {
  type RegistrationRun,
  type RegistrationSubject,
  warnRegistration,
} from "./registration-run.js";

/** The registration the host refused to add: the marketplace it belongs to, the name the host
 * knows it by (never the project's alias) and the directory this run built for it. */
export interface DeadRegistration {
  readonly marketplace: RegistrationSubject;
  readonly hostName: string;
  readonly builtDir: string;
}

// Reclaim only a dead Claude registration whose current source is recognisably AIDD-owned.
// `hostName`, never the project's alias, names every host-facing call.
export async function reclaimOrReport(
  run: RegistrationRun,
  registration: DeadRegistration,
  addError: NativePluginCliError
): Promise<boolean> {
  const { marketplace, hostName } = registration;
  const warn = (message: string): void => warnRegistration(run, message);
  const refusal = await refusalToReclaim(run, registration, addError);
  if (refusal !== undefined) {
    warn(refusal);
    return false;
  }
  warn(
    `Marketplace '${hostName}' was registered to a directory that no longer exists; re-registering it for this project. Plugins installed from it are removed and the ones this CLI manages are put back.`
  );
  const { activator } = run;
  const removed = bestEffortNativeCall(
    () => activator.removeMarketplace(hostName, marketplace.scope, { force: true }),
    skippedWarning(`unregister stale marketplace '${hostName}'`),
    warn
  ).confirmed;
  if (!removed) return false;
  return bestEffortNativeCall(
    () => activator.addMarketplace(registration.builtDir, marketplace.scope),
    skippedWarning(`register marketplace '${hostName}'`),
    warn
  ).confirmed;
}

/** Why a dead registration is not reclaimed, or `undefined` when it is ours to take back. */
async function refusalToReclaim(
  run: RegistrationRun,
  { marketplace, hostName }: DeadRegistration,
  addError: NativePluginCliError
): Promise<string | undefined> {
  const judged = judgeRegistration({
    intent: "register",
    ...(await nativeCatalogProof(run, hostName)),
  });
  if (judged.outcome === "refuse") {
    const foreignRef = judged.reconcile;
    return (
      `Native plugin activation — catalogue '${hostName}' collides with unproven AIDD ownership` +
      `${foreignRef === undefined ? "" : ` and foreign ref '${foreignRef}'`}; host registration left untouched. ${addError.detail}`
    );
  }
  if (!(await builtByThisCli(run, marketplace, hostName)))
    return (
      `Native plugin activation — catalogue '${hostName}' host catalogue source is unproven; ` +
      `host registration left untouched. ${addError.detail}`
    );
  if (run.activator.registrationState(hostName) !== "dead")
    return `Native plugin activation — register marketplace '${hostName}' skipped: ${addError.detail}`;
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
  const registeredSource = (
    await run.hosts.marketplaceRegistries.get(run.profile.toolId)?.read()
  )?.entries?.get(hostName);
  if (registeredSource === undefined) return false;
  const source = await fs.realpath(registeredSource).catch(() => registeredSource);
  const userRoot = run.userCacheRoot();
  const locations = [
    parseBuiltMarketplaceDir(
      await fs.realpath(projectRoot).catch(() => projectRoot),
      source,
      platform
    ),
    userRoot === ""
      ? undefined
      : parseUserBuiltMarketplaceDir(
          await fs.realpath(userRoot).catch(() => userRoot),
          source,
          platform
        ),
  ];
  return locations.some(
    (location) =>
      location !== undefined &&
      samePathSegment(location.marketplaceName, marketplace.name, platform) &&
      samePathSegment(location.target, run.toolId, platform)
  );
}
