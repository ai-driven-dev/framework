import type { ToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type {
  ClaimedOutcome,
  MachineClaimsRecording,
  RecordMachineClaimsRequest,
} from "../../contract/machine-claims-recording.js";
import type { RecordClaimRules } from "../../contract/record-claim-rules.js";
import type {
  ClaimingMachineManifest,
  MachineManifestRepository,
} from "../../ports/machine-manifest.js";
import type { ClaimingTools } from "../../ports/user-scope-tool.js";

interface MachineClaim {
  machine: ClaimingMachineManifest;
  request: RecordMachineClaimsRequest;
  root: string | undefined;
}

/** What RecordMachineClaims is built from. The installation owns the record and hands over the
 * real repository, and an empty record for a machine that has none yet. */
export interface RecordMachineClaimsDeps {
  readonly fs: Pick<FileReader, "realpath">;
  readonly userManifestRepo?: MachineManifestRepository<ClaimingMachineManifest>;
  readonly emptyManifest: () => ClaimingMachineManifest;
  readonly mergeClaims: RecordClaimRules["mergeCatalogueClaims"];
}

/** The machine-wide record of the plugins and marketplaces a project's host registration claimed. */
export class RecordMachineClaims implements MachineClaimsRecording {
  constructor(
    private readonly deps: RecordMachineClaimsDeps,
    private readonly tools: ClaimingTools
  ) {}

  /** True when the machine record changed; false without a machine manifest to write to. */
  async execute(request: RecordMachineClaimsRequest): Promise<boolean> {
    if (this.deps.userManifestRepo === undefined) return false;
    const machine = (await this.deps.userManifestRepo.load()) ?? this.deps.emptyManifest();
    const root = await this.realRootOf(request.projectRoot);
    const claim: MachineClaim = { machine, request, root };
    let changed = false;
    for (const [toolId, outcome] of request.outcomes) {
      const merged = this.mergeInto(claim, toolId, outcome);
      if (merged === null) continue;
      changed ||= merged.changed;
      if (changed) machine.setNativeRegistrations(toolId, merged.record);
    }
    if (changed) await this.deps.userManifestRepo.save(machine);
    return changed;
  }

  private async realRootOf(projectRoot: string | undefined): Promise<string | undefined> {
    return projectRoot === undefined ? undefined : this.deps.fs.realpath(projectRoot);
  }

  /** The tool's claims merged into the machine record; null when it has none to add. */
  private mergeInto(claim: MachineClaim, toolId: ToolId, outcome: ClaimedOutcome) {
    const { machine, request, root } = claim;
    const claims = this.machineClaimsOf(toolId, outcome, request);
    if (claims.refs.length === 0 && claims.marketplaces.length === 0) return null;
    if (!this.machineTracks(machine, request.project, toolId)) return null;
    return this.deps.mergeClaims(
      machine.getNativeRegistrations(toolId),
      { ...claims, dependent: root },
      this.nativeActivationBinary(toolId) ?? toolId
    );
  }

  /** Adds the tool to the machine record at the project's version; false when the project has none. */
  private machineTracks(
    machine: ClaimingMachineManifest,
    project: RecordMachineClaimsRequest["project"],
    toolId: ToolId
  ): boolean {
    if (machine.hasTool(toolId)) return true;
    const version = project.getToolVersion(toolId);
    if (version === undefined) return false;
    machine.addTool(toolId, version, []);
    return true;
  }

  /** What of one tool's outcome reaches the machine record. */
  private machineClaimsOf(
    toolId: ToolId,
    outcome: ClaimedOutcome,
    { scope, marketplaces }: Pick<RecordMachineClaimsRequest, "scope" | "marketplaces">
  ) {
    const global = this.enablementIsMachineGlobal(toolId);
    return {
      refs: scope === "user" || global ? outcome.pluginRefs : [],
      marketplaces: outcome.catalogClaims.filter((registration) =>
        marketplaces.some(
          (marketplace) =>
            marketplace.name === registration.alias && (marketplace.scope === "user" || global)
        )
      ),
    };
  }

  /** Whether enabling a plugin acts on the whole machine; true for an editor. */
  private enablementIsMachineGlobal(toolId: ToolId): boolean {
    return this.tools.aiProfileIfAny(toolId)?.pluginEnablementIsMachineGlobal() ?? true;
  }

  private nativeActivationBinary(toolId: ToolId): string | undefined {
    return this.tools.aiProfileIfAny(toolId)?.nativeActivation()?.hostBinary();
  }
}
