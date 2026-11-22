import { isRefOnHost } from "../../domain/record/host-ref.js";
import type {
  NativeMarketplaceRegistration,
  NativeMarketplaceSource,
} from "../../domain/record/native-marketplace-source.js";
import { pluginRefsOf, recordedMarketplaces } from "../../domain/record/registration-record.js";
import { inspectHostSource } from "../native-marketplace-source-proof.js";
import { type RegistrationRun, warnRegistration } from "./registration-run.js";

export interface NativeCatalogProof {
  readonly canonical: boolean;
  readonly hostReadable: boolean;
  readonly sourceStatus: "absent" | "owned" | "unproven";
  readonly source?: NativeMarketplaceSource;
  readonly sourceReason?: string;
  readonly foreignRef?: string;
  readonly unreadable?: string;
}

export async function nativeCatalogProof(
  run: RegistrationRun,
  hostName: string,
  fresh?: NativeMarketplaceRegistration
): Promise<NativeCatalogProof> {
  const { profile, projectRoot, claims } = run;
  const machine = await claims.machine();
  const persisted = await claims.persistedProject();
  const registration = registrationOf(run, hostName, { machine, persisted, fresh });
  const sourceProof = await inspectHostSource(
    run.hosts.sources.get(profile.toolId),
    projectRoot,
    registration.entry
  );
  const base = {
    canonical: registration.canonical,
    sourceStatus: sourceProof.status,
    ...(sourceProof.current === undefined ? {} : { source: sourceProof.current }),
    ...(sourceProof.reason === undefined ? {} : { sourceReason: sourceProof.reason }),
  };
  const reader = run.hosts.pluginRegistries.get(profile.toolId);
  if (reader === undefined) return { ...base, hostReadable: false };
  const reading = await reader.read(projectRoot);
  if (reading.absent === true) return { ...base, hostReadable: true };
  if (reading.refs === undefined)
    return { ...base, hostReadable: false, unreadable: reading.unreadable ?? reading.location };
  const claimed = claimedRefs(run, { machine, persisted });
  const foreignRef = [...reading.refs].find(
    ([ref, entry]) =>
      profile.hostRefInUse(entry.enabled) && isRefOnHost(ref, hostName) && !claimed.has(ref)
  )?.[0];
  return { ...base, hostReadable: true, ...(foreignRef === undefined ? {} : { foreignRef }) };
}

interface HeldRecords {
  readonly machine: Awaited<ReturnType<RegistrationRun["claims"]["machine"]>>;
  readonly persisted: Awaited<ReturnType<RegistrationRun["claims"]["persistedProject"]>>;
}

/** The registration a host name stands for, and whether this CLI holds a claim on it: a fresh
 * one, one the machine record keeps, or one this project's own record keeps. */
function registrationOf(
  run: RegistrationRun,
  hostName: string,
  { machine, persisted, fresh }: HeldRecords & { fresh: NativeMarketplaceRegistration | undefined }
): { entry: NativeMarketplaceRegistration; canonical: boolean } {
  const onMachine = recordedMarketplaces(machine).find((entry) => entry.hostName === hostName);
  const local = run.profile.pluginEnablementIsMachineGlobal()
    ? undefined
    : recordedMarketplaces(persisted).find((entry) => entry.hostName === hostName);
  return {
    entry: fresh ?? onMachine ?? local ?? { alias: hostName, hostName },
    canonical: fresh !== undefined || onMachine !== undefined || local !== undefined,
  };
}

/** Every plugin ref a claim of this CLI covers: the machine's, and this project's when the host
 * enables plugins per project. */
function claimedRefs(run: RegistrationRun, { machine, persisted }: HeldRecords): Set<string> {
  return new Set([
    ...(machine?.claimedRefs ?? []),
    ...(run.profile.pluginEnablementIsMachineGlobal() ? [] : pluginRefsOf(persisted)),
  ]);
}

export async function proveAddedSource(
  run: RegistrationRun,
  hostName: string,
  builtDir: string
): Promise<NativeMarketplaceSource | undefined> {
  const { toolId } = run;
  const reading = await run.hosts.sources.get(run.profile.toolId)?.read(run.projectRoot);
  const current = reading?.entries?.get(hostName);
  const expected = await run.fs.realpath(builtDir).catch(() => builtDir);
  const sourceMatches =
    current?.source === expected &&
    (current.kind === "registry" ||
      (current.kind === "effective-list" &&
        current.sourceType === "local" &&
        current.root === expected));
  if (sourceMatches) return current;
  warnRegistration(
    run,
    `${toolId}: catalogue '${hostName}' add returned but effective host source could not be proven as '${expected}'; no AIDD claim or enablement recorded. Reconcile manually.`
  );
  return undefined;
}
