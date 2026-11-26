import type { Scope } from "../../../shared/domain/scope.js";
import type { ToolId } from "../../../shared/domain/tool.js";

/** What one tool's host registration claimed, as far as the machine record keeps it. */
export interface ClaimedOutcome {
  readonly catalogClaims: readonly (Readonly<Record<string, unknown>> & {
    readonly alias: string;
    readonly hostName: string;
  })[];
  readonly pluginRefs: readonly string[];
}

/** Which plugins and marketplaces a project's activation claimed on the machine, and for whom. */
export interface RecordMachineClaimsRequest {
  readonly project: { getToolVersion(toolId: ToolId): string | undefined };
  readonly outcomes: ReadonlyMap<ToolId, ClaimedOutcome>;
  readonly marketplaces: readonly { readonly name: string; readonly scope: Scope }[];
  readonly scope: Scope;
  readonly projectRoot?: string;
}

/** Records what a project's activation claimed on the machine; true when the record changed. */
export interface MachineClaimsRecording {
  execute(request: RecordMachineClaimsRequest): Promise<boolean>;
}
