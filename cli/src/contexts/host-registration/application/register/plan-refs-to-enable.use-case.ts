import type { Scope } from "../../../../shared/domain/scope.js";
import { refOnHostName } from "../../domain/record/host-ref.js";
import {
  type RegistrationRecordData,
  refsOnHosts,
} from "../../domain/record/registration-record.js";

/** What a sync knows when it decides the refs a host enables. */
export interface PlanRefsToEnableRequest {
  readonly scope: Scope;
  /** The plugins the manifest records for the tool, each with the alias of its marketplace. */
  readonly recordedPlugins: readonly {
    readonly pluginName: string;
    readonly marketplace: string | null | undefined;
  }[];
  /** The aliases of the marketplaces this sync handles. */
  readonly marketplaceAliases: readonly string[];
  readonly hostNameByAlias: ReadonlyMap<string, string>;
  /** What is recorded for the tool's host registration. */
  readonly nativeRecord: RegistrationRecordData | undefined;
  /** Framework plugins a caller asked for, which only the framework marketplace can resolve. */
  readonly enablePlugins: readonly string[];
}

/** What PlanRefsToEnable is built from. */
export interface PlanRefsToEnableDeps {
  readonly frameworkName: string;
  /** The refs the machine claims for a tool's recorded registration. */
  readonly claimedRefs: (record: RegistrationRecordData) => readonly string[];
}

/**
 * The refs a sync has a host enable: the manifest's own, keyed by the host name a catalogue
 * declares and not by aidd's alias (the host resolves the marketplace half of a ref against its
 * own registry), then at user scope the refs a native-only install recorded or the machine claims,
 * which recover a selection an older sync dropped, then the framework plugins asked for.
 */
export class PlanRefsToEnable {
  constructor(private readonly deps: PlanRefsToEnableDeps) {}

  execute(request: PlanRefsToEnableRequest): string[] {
    return [
      ...new Set([
        ...this.declaredRefs(request),
        ...this.nativeRefs(request),
        ...this.requestedRefs(request),
      ]),
    ];
  }

  private declaredRefs(request: PlanRefsToEnableRequest): string[] {
    const known = new Set(request.marketplaceAliases);
    return request.recordedPlugins.flatMap(({ pluginName, marketplace }) => {
      const hostName =
        marketplace == null || !known.has(marketplace)
          ? undefined
          : request.hostNameByAlias.get(marketplace);
      return hostName === undefined ? [] : [refOnHostName(pluginName, hostName)];
    });
  }

  private nativeRefs(request: PlanRefsToEnableRequest): string[] {
    const { scope, nativeRecord, hostNameByAlias } = request;
    if (scope !== "user" || nativeRecord === undefined) return [];
    return refsOnHosts(nativeRecord, this.deps.claimedRefs(nativeRecord), [
      ...hostNameByAlias.values(),
    ]);
  }

  private requestedRefs(request: PlanRefsToEnableRequest): string[] {
    const frameworkHost = request.hostNameByAlias.get(this.deps.frameworkName);
    return frameworkHost === undefined
      ? []
      : request.enablePlugins.map((name) => refOnHostName(name, frameworkHost));
  }
}
