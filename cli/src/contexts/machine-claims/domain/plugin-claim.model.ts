import { asPlainObject } from "../../../shared/domain/reading/plain-object.js";
import type { ToolId } from "../../../shared/domain/tool.js";

/** The project roots holding what these claims are on, once each. */
export function holdersOf(
  claims: readonly { readonly dependents: readonly string[] }[]
): readonly string[] {
  return [...new Set(claims.flatMap((claim) => claim.dependents))];
}

/** A claim kept on a host ref: the ref, and the project roots holding it. */
export interface HeldRefClaim {
  readonly ref: string;
  readonly dependents: readonly string[];
}

/** A claim kept on a machine plugin: its name, and the project roots holding it. */
export interface HeldPluginClaim {
  readonly plugin: string;
  readonly dependents: readonly string[];
}

/** A claim a record keeps, on a ref or on a plugin, keyed beside the tool by that ref or name. */
export type HeldClaim = HeldRefClaim | HeldPluginClaim;

const isPluginClaim = (claim: HeldClaim): claim is HeldPluginClaim => "plugin" in claim;

const isRefClaim = (claim: HeldClaim): claim is HeldRefClaim => "ref" in claim;

/** The claims a record keeps, each copied; none when it keeps none. Refuses a list, or a claim,
 * that is not exactly a ref or a plugin with the paths of the projects holding it. */
export function readHeldClaims(value: unknown): HeldClaim[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error("nativeRegistrations.pluginClaims: expected an array.");
  }
  return value.map(readHeldClaim);
}

function readHeldClaim(item: unknown): HeldClaim {
  const { ref, plugin, dependents } = asPlainObject(item) ?? {};
  if (isRoots(dependents)) {
    if (typeof ref === "string" && plugin === undefined)
      return { ref, dependents: [...dependents] };
    if (typeof plugin === "string" && ref === undefined)
      return { plugin, dependents: [...dependents] };
  }
  throw new Error(
    "nativeRegistrations.pluginClaims: expected a ref or a plugin, and its dependents."
  );
}

function isRoots(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((root) => typeof root === "string");
}

/** The claims a record keeps on its refs, each copied; none when it keeps none. */
export function readHeldRefClaims(value: unknown): HeldRefClaim[] {
  return readHeldClaims(value).filter(isRefClaim);
}

/** The claims on the named plugins. */
export function pluginClaimsNamed(
  claims: readonly HeldClaim[],
  names: readonly string[]
): HeldPluginClaim[] {
  return claims.filter(isPluginClaim).filter((claim) => names.includes(claim.plugin));
}

/** The claims with the dependent holding the plugin's claim, opened after the others when the
 * plugin had none. Every claim is copied, never the ones it was given. */
export function withPluginDependent(
  claims: readonly HeldClaim[],
  plugin: string,
  dependent: string
): HeldClaim[] {
  const held = claims.some((claim) => isPluginClaim(claim) && claim.plugin === plugin);
  const copied = claims.map((claim) =>
    isPluginClaim(claim) && claim.plugin === plugin
      ? { plugin, dependents: [...new Set([...claim.dependents, dependent])] }
      : { ...claim, dependents: [...claim.dependents] }
  );
  return held ? copied : [...copied, { plugin, dependents: [dependent] }];
}

/** The claims once the dependent no longer holds the plugin, its claim closed when none does,
 * and whether that changed anything. */
export function withoutPluginDependent(
  claims: readonly HeldClaim[],
  plugin: string,
  dependent: string
): { readonly claims: HeldClaim[]; readonly changed: boolean } {
  const holds = (claim: HeldClaim): claim is HeldPluginClaim =>
    isPluginClaim(claim) && claim.plugin === plugin && claim.dependents.includes(dependent);
  if (!claims.some(holds)) return { claims: [...claims], changed: false };
  const released = claims.flatMap((claim): HeldClaim[] => {
    if (!holds(claim)) return [claim];
    const dependents = claim.dependents.filter((root) => root !== dependent);
    return dependents.length === 0 ? [] : [{ plugin, dependents }];
  });
  return { claims: released, changed: true };
}

type OpenClaim = { ref: string; dependents: string[] } | { plugin: string; dependents: string[] };

/** The claims once one run's refs are merged in, and whether the merge changed anything. */
interface MergedRefClaims {
  readonly entries: OpenClaim[];
  readonly changed: boolean;
}

/** The claims with the dependent holding each ref's claim, a claim opened for a ref nobody
 * claimed yet. The claims on plugins stay as they are. Every claim is copied, never the ones it
 * was given. */
export function mergeRefClaims(
  recorded: readonly HeldClaim[],
  refs: readonly string[],
  dependent: string | undefined
): MergedRefClaims {
  const entries: OpenClaim[] = recorded.map((claim) => ({
    ...claim,
    dependents: [...claim.dependents],
  }));
  let changed = false;
  for (const ref of refs) changed = holdRef(entries, ref, dependent) || changed;
  return { entries, changed };
}

/** Records the dependent as a holder of the ref's claim, adding the claim when it is new. Says
 * whether anything changed. */
function holdRef(entries: OpenClaim[], ref: string, dependent: string | undefined): boolean {
  const claim = entries.find((candidate) => "ref" in candidate && candidate.ref === ref);
  if (claim === undefined) {
    entries.push({ ref, dependents: dependent === undefined ? [] : [dependent] });
    return true;
  }
  if (dependent === undefined || claim.dependents.includes(dependent)) return false;
  claim.dependents.push(dependent);
  return true;
}

/** The claims whose ref is kept, and every claim on a plugin. */
export function claimsKeeping(
  claims: readonly HeldClaim[],
  keep: (ref: string) => boolean
): HeldClaim[] {
  return claims.filter((claim) => isPluginClaim(claim) || keep(claim.ref));
}

type RecordData = Readonly<Record<string, unknown>>;

/** Each tool's record in two: its host data, whole but for the claims block, and the claims block
 * of a tool holding one. */
export function splitPluginClaims(records: ReadonlyMap<ToolId, RecordData>): {
  readonly host: Map<ToolId, RecordData>;
  readonly claims: Map<ToolId, unknown>;
} {
  const host = new Map<ToolId, RecordData>();
  const claims = new Map<ToolId, unknown>();
  for (const [toolId, { pluginClaims, ...hostData }] of records) {
    host.set(toolId, hostData);
    if (pluginClaims !== undefined) claims.set(toolId, pluginClaims);
  }
  return { host, claims };
}

/** The two halves joined back: each tool's claims beside its host data, a tool holding only claims
 * recorded with them alone. */
export function joinPluginClaims(
  host: ReadonlyMap<ToolId, RecordData>,
  claims: ReadonlyMap<ToolId, unknown>
): Map<ToolId, RecordData> {
  const records = new Map<ToolId, RecordData>(host);
  for (const [toolId, pluginClaims] of claims) {
    records.set(toolId, { ...host.get(toolId), pluginClaims });
  }
  return records;
}
