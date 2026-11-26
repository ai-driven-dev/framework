import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import { PluginNotFoundError } from "../../contract/installation.error.js";
import type { ToolRecord, ToolRecords } from "../../contract/records/scope-records.js";
import type { ActivatedTool, InstallationCatalog } from "../../ports/tool-sections.js";
import type { MachineClaimsReading } from "../../ports/user-scope/machine-claims-reading.js";
import type { UpdatePluginRequest } from "./update-plugin-command.js";

/** How a plugin selection reads a native ref: the host registration's to answer, and the claims
 * on it the machine claims'. */
export interface RefSelection extends MachineClaimsReading {
  /** Whether a plugin selector names its catalogue, so it can only mean one exact ref. */
  isQualifiedRef(selector: string): boolean;
  /** A qualified selector is one exact ref; a bare plugin name selects it in every catalogue. */
  refSelectedBy(ref: string, selector: string): boolean;
}

/** A host refresh whose proofs all held: applying it is the only step left. */
export interface ProvenNativeRefresh {
  apply(): void;
}

/** Proves, then refreshes, one AIDD-owned native ref on its host. The scenario supplies it. */
export type RefreshNativeRef = (request: {
  readonly tool: ActivatedTool;
  readonly ref: string;
  readonly projectRoot: string;
  readonly registrations: ToolRecord | undefined;
}) => Promise<ProvenNativeRefresh>;

/** The native refs a machine-scope update refreshes. */
export type NativeTargets = ReturnType<typeof nativeTargets>;

/** The native refs aidd owns for the selected tools, narrowed to the plugins the person named.
 * A rebuild re-materializes the files aidd wrote; a host enabling plugins itself picks the
 * rebuilt tree up through its own marketplace refresh, which activation drives. */
export function nativeTargets(
  records: RefSelection,
  registered: ToolRecords,
  selection: { readonly toolIds: readonly AiToolId[]; readonly options: UpdatePluginRequest }
) {
  const { toolIds, options } = selection;
  return (options.rebuild === true ? [] : toolIds).flatMap((toolId) =>
    records
      .claimsOf(registered.get(toolId))
      .filter(
        (claim) =>
          options.pluginNames === undefined ||
          options.pluginNames.some((name) => records.refSelectedBy(claim.ref, name))
      )
      .map((claim) => ({ toolId, claim, registrations: registered.get(toolId) }))
  );
}

/** Refuses a plugin selection that resolves to nothing, or to several native catalogues. */
export function assertSelectionResolves(
  records: RefSelection,
  options: UpdatePluginRequest,
  selected: { files: number; native: NativeTargets }
): void {
  const { pluginNames } = options;
  if (pluginNames === undefined) return;
  if (selected.files === 0 && selected.native.length === 0) {
    throw new PluginNotFoundError(pluginNames.join(", "));
  }
  if (pluginNames.some((name) => matchesSeveralCatalogues(records, selected.native, name))) {
    throw new Error(
      "Multiple native catalogues match this plugin name; use an exact <plugin>@<catalogue> ref for targeted update."
    );
  }
}

function matchesSeveralCatalogues(
  records: RefSelection,
  native: NativeTargets,
  name: string
): boolean {
  if (records.isQualifiedRef(name)) return false;
  return native.filter(({ claim }) => records.refSelectedBy(claim.ref, name)).length > 1;
}

/** Proves every refresh first, then applies them all, so none runs on a partial proof. */
export async function refreshNativeRefs(
  logger: Logger,
  tools: InstallationCatalog,
  refreshing: {
    readonly targets: NativeTargets;
    readonly options: { readonly projectRoot: string; readonly refreshNative: RefreshNativeRef };
  }
): Promise<string[]> {
  const { targets, options } = refreshing;
  const refreshes = await Promise.all(
    targets.map(async ({ toolId, claim, registrations }) => ({
      toolId,
      claim,
      refresh: await options.refreshNative({
        tool: tools.aiProfile(toolId),
        ref: claim.ref,
        projectRoot: options.projectRoot,
        registrations,
      }),
    }))
  );
  const updated: string[] = [];
  for (const { toolId, claim, refresh } of refreshes) {
    if (claim.dependents.length > 0)
      logger.warn(
        `${toolId}: updating native ref '${claim.ref}' affects ${claim.dependents.join(", ")}; projects must refresh their local integrations afterward.`
      );
    refresh.apply();
    updated.push(claim.ref);
  }
  return updated;
}
