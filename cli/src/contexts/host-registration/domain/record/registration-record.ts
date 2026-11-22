import { join } from "node:path";
import { asPlainObject } from "../../../../shared/domain/reading/plain-object.js";
import { CATALOGUE_SEPARATOR, isRefOnHost, refOnAnyHost, refOnHostName } from "./host-ref.js";
import {
  type NativeMarketplaceRegistration,
  readMarketplaceRegistration,
} from "./native-marketplace-source.js";

/** What aidd asked a host's own CLI to register: the host data only. The installation manifest
 * stores it, and the claims on its refs stay with the manifest. */
export type RegistrationRecord = {
  readonly binary: string;
  readonly marketplaces: readonly NativeMarketplaceRegistration[];
  readonly pluginRefs: readonly string[];
};

/** A record as the manifest holds it: opaque to every reader but this one, which narrows it
 * through {@link readRegistrationRecord}. */
export type RegistrationRecordData = Readonly<Record<string, unknown>>;

/** A record together with the claims block the manifest keeps beside it, carried through as is. */
export type ClaimedRegistrationRecord = RegistrationRecordData & {
  readonly pluginClaims?: unknown;
};

interface RegistrationPreview {
  readonly binary: string;
  readonly marketplaceCount: number;
  readonly pluginRefCount: number;
  readonly cachePaths: readonly string[];
}

/** Whether a plugin selector names its catalogue, so it can only mean one exact ref. */
export function isQualifiedRef(selector: string): boolean {
  return selector.includes(CATALOGUE_SEPARATOR);
}

/** A qualified selector is one exact ref; a bare plugin name selects it in every catalogue. */
export function refSelectedBy(ref: string, selector: string): boolean {
  return isQualifiedRef(selector)
    ? ref === selector
    : ref.startsWith(`${selector}${CATALOGUE_SEPARATOR}`);
}

/** The record as the host reads it: every entry copied, a provenance that proves nothing dropped
 * while the registration stays. `undefined` when nothing was recorded or no binary was. Limit: a
 * hand-edited entry that is no registration is skipped; no manifest has been seen to hold one. */
export function readRegistrationRecord(data: unknown): RegistrationRecord | undefined {
  const record = asPlainObject(data);
  if (record === null || typeof record.binary !== "string") return undefined;
  return {
    binary: record.binary,
    marketplaces: recordedMarketplaces(record),
    pluginRefs: refsIn(record),
  };
}

/** The record as the manifest stores it: an independent copy of the host data. */
export function registrationRecordData(record: RegistrationRecord): RegistrationRecord {
  return {
    binary: record.binary,
    marketplaces: record.marketplaces.map((m) => ({
      ...m,
      ...(m.provenance === undefined ? {} : { provenance: { ...m.provenance } }),
    })),
    pluginRefs: [...record.pluginRefs],
  };
}

const refsIn = (data: unknown): readonly string[] => {
  const refs = asPlainObject(data)?.pluginRefs;
  return Array.isArray(refs) ? refs.filter((ref) => typeof ref === "string") : [];
};

export const recordedMarketplaces = (data: unknown): NativeMarketplaceRegistration[] => {
  const entries = asPlainObject(data)?.marketplaces;
  if (!Array.isArray(entries)) return [];
  return entries.flatMap((entry) => readMarketplaceRegistration(entry) ?? []);
};

/** What a tool's host holds when its record is absent or unreadable. */
const NOTHING_RECORDED: RegistrationRecord = { binary: "", marketplaces: [], pluginRefs: [] };

/** The record as the host reads it, or an empty one for data that names no binary. */
export function recordedRegistrations(data: unknown): RegistrationRecord {
  return readRegistrationRecord(data) ?? NOTHING_RECORDED;
}

/** The refs recorded on the host, none when nothing was recorded. */
export function pluginRefsOf(record: RegistrationRecordData | undefined): readonly string[] {
  return refsIn(record);
}

/** The registration aidd's local name stands for, `undefined` when the alias is absent or was
 * never registered. */
export function marketplaceOf(
  record: RegistrationRecordData | undefined,
  alias: string | undefined
): NativeMarketplaceRegistration | undefined {
  return recordedMarketplaces(record).find((entry) => entry.alias === alias);
}

const hostNameOf = (
  record: RegistrationRecordData | undefined,
  alias: string | undefined
): string | undefined => marketplaceOf(record, alias)?.hostName;

/**
 * The ref a plugin has on the host, `undefined` when nothing was recorded for the alias.
 * Limit: a plugin without a marketplace has no alias to look up and so no ref; only a
 * hand-edited manifest lacks one, and no real manifest has been seen to.
 */
export function refOf(
  record: RegistrationRecordData | undefined,
  plugin: string,
  alias: string | undefined
): string | undefined {
  const hostName = hostNameOf(record, alias);
  return hostName === undefined ? undefined : refOnHostName(plugin, hostName);
}

export function withoutRef<R extends RegistrationRecordData>(record: R, ref: string): R {
  return { ...record, pluginRefs: pluginRefsOf(record).filter((recorded) => recorded !== ref) };
}

/** The marketplace and every ref on the host name it was registered under. Every ref stays for
 * an alias that was never registered. */
export function withoutMarketplace<R extends RegistrationRecordData>(record: R, alias: string): R {
  const hostName = hostNameOf(record, alias);
  const offHost = (ref: string): boolean => hostName === undefined || !isRefOnHost(ref, hostName);
  return {
    ...record,
    marketplaces: recordedMarketplaces(record).filter((entry) => entry.alias !== alias),
    pluginRefs: pluginRefsOf(record).filter(offHost),
  };
}

export function registrationPreview(
  data: RegistrationRecordData,
  cacheRoot: string | undefined
): RegistrationPreview {
  const record = recordedRegistrations(data);
  return {
    binary: record.binary,
    marketplaceCount: record.marketplaces.length,
    pluginRefCount: record.pluginRefs.length,
    cachePaths:
      cacheRoot === undefined
        ? []
        : record.marketplaces.map((entry) => join(cacheRoot, entry.hostName)),
  };
}

/** The refs, then the claimed refs, that sit on one of the proven host names. */
export function refsOnHosts(
  record: RegistrationRecordData,
  claimedRefs: readonly string[],
  hostNames: Iterable<string>
): string[] {
  return [...pluginRefsOf(record), ...claimedRefs].filter((ref) => refOnAnyHost(ref, hostNames));
}
