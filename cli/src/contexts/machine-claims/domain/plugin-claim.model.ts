import { asPlainObject } from "../../../shared/domain/reading/plain-object.js";
import type { ToolId } from "../../../shared/domain/tool.js";

/** The project roots a machine plugin's claim lists, none when it keeps none. Refuses a claim
 * that is not a list of paths. */
export function readDependents(claim: unknown): readonly string[] {
  if (claim === undefined) return [];
  if (!Array.isArray(claim) || !claim.every((root) => typeof root === "string")) {
    throw new Error("plugin dependents: expected a list of project roots.");
  }
  return [...claim];
}

/** The project roots holding these plugins or these refs, once each. Refuses a plugin claim it
 * did not write. */
export function holdersOf(
  plugins: readonly { readonly machineClaim?: unknown }[],
  refClaims: readonly { readonly dependents: readonly string[] }[]
): readonly string[] {
  return [
    ...new Set([
      ...plugins.flatMap((plugin) => readDependents(plugin.machineClaim)),
      ...refClaims.flatMap((claim) => claim.dependents),
    ]),
  ];
}

/** The claim listing these project roots once each, none when there are none. */
export function dependentsClaim(dependents: readonly string[]): readonly string[] | undefined {
  return dependents.length === 0 ? undefined : [...new Set(dependents)];
}

/** A claim kept on a host ref: the ref, and the project roots holding it. */
export interface HeldRefClaim {
  readonly ref: string;
  readonly dependents: readonly string[];
}

/** The claims a record keeps on its refs, each copied; none when it keeps none. Refuses a list,
 * or a claim, that is not a ref with the paths of the projects holding it. */
export function readHeldClaims(value: unknown): HeldRefClaim[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error("nativeRegistrations.pluginClaims: expected an array.");
  }
  return value.map((item) => {
    const claim = asPlainObject(item);
    if (
      claim === null ||
      typeof claim.ref !== "string" ||
      !Array.isArray(claim.dependents) ||
      !claim.dependents.every((dependent) => typeof dependent === "string")
    ) {
      throw new Error("nativeRegistrations.pluginClaims: expected a ref and its dependents.");
    }
    return { ref: claim.ref, dependents: [...claim.dependents] };
  });
}

interface OpenClaim {
  readonly ref: string;
  readonly dependents: string[];
}

/** The claims once one run's refs are merged in, and whether the merge changed anything. */
interface MergedRefClaims {
  readonly entries: OpenClaim[];
  readonly changed: boolean;
}

/** The claims with the dependent holding each ref's claim, a claim opened for a ref nobody
 * claimed yet. Every claim is copied, never the ones it was given. */
export function mergeRefClaims(
  recorded: readonly HeldRefClaim[],
  refs: readonly string[],
  dependent: string | undefined
): MergedRefClaims {
  const entries = recorded.map((claim) => ({ ref: claim.ref, dependents: [...claim.dependents] }));
  let changed = false;
  for (const ref of refs) changed = holdRef(entries, ref, dependent) || changed;
  return { entries, changed };
}

/** Records the dependent as a holder of the ref's claim, adding the claim when it is new. Says
 * whether anything changed. */
function holdRef(entries: OpenClaim[], ref: string, dependent: string | undefined): boolean {
  const claim = entries.find((candidate) => candidate.ref === ref);
  if (claim === undefined) {
    entries.push({ ref, dependents: dependent === undefined ? [] : [dependent] });
    return true;
  }
  if (dependent === undefined || claim.dependents.includes(dependent)) return false;
  claim.dependents.push(dependent);
  return true;
}

/** The claims whose ref is kept. */
export function claimsKeeping(
  claims: readonly HeldRefClaim[],
  keep: (ref: string) => boolean
): HeldRefClaim[] {
  return claims.filter((claim) => keep(claim.ref));
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
