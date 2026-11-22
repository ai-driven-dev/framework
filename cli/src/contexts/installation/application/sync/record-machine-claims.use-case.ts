import type { Scope } from "../../../../shared/domain/scope.js";
import type { ToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Lock } from "../../../../shared/ports/lock.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type {
  NativePluginClaim,
  NativeRegistrations,
} from "../../domain/manifest/native-registrations.js";
import { Manifest } from "../../domain/manifest.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type { DeclaredMarketplace } from "../../ports/marketplace-sources.js";
import type { HostRegistrationOutcome, RegisteredMarketplace } from "../../ports/native-host.js";

/** A machine's record with one run's claims merged in, and whether that changed it: the host
 * registration's to answer. */
export type MachineClaimsMerge = (
  existing: NativeRegistrations | undefined,
  claimed: {
    readonly marketplaces: readonly RegisteredMarketplace[];
    readonly refs: readonly string[];
    readonly dependent: string | undefined;
  },
  fallbackBinary: string
) => {
  readonly record: NativeRegistrations & { readonly pluginClaims: readonly NativePluginClaim[] };
  readonly changed: boolean;
};

/** Which plugins and marketplaces a project's activation claimed on the machine, and for whom. */
export interface RecordMachineClaimsRequest {
  readonly kind: "machine-claims";
  readonly project: Manifest;
  readonly outcomes: ReadonlyMap<ToolId, HostRegistrationOutcome>;
  readonly marketplaces: readonly DeclaredMarketplace[];
  readonly scope: Scope;
  readonly projectRoot?: string;
}

interface MachineClaim {
  machine: Manifest;
  request: RecordMachineClaimsRequest;
  root: string | undefined;
}

/** What RecordMachineClaims is built from. */
export interface RecordMachineClaimsDeps {
  readonly fs: FileReader & FileWriter;
  readonly userManifestRepo?: ManifestRepository & Lock;
  readonly mergeClaims: MachineClaimsMerge;
}

/** The machine-wide record of the plugins and marketplaces a project's host registration claimed. */
export class RecordMachineClaims {
  constructor(
    private readonly deps: RecordMachineClaimsDeps,
    private readonly tools: ToolCatalog
  ) {}

  /** True when the machine record changed; false without a machine manifest to write to. */
  async execute(request: RecordMachineClaimsRequest): Promise<boolean> {
    if (this.deps.userManifestRepo === undefined) return false;
    const machine = (await this.deps.userManifestRepo.load()) ?? Manifest.create();
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
  private mergeInto(claim: MachineClaim, toolId: ToolId, outcome: HostRegistrationOutcome) {
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
  private machineTracks(machine: Manifest, project: Manifest, toolId: ToolId): boolean {
    if (machine.hasTool(toolId)) return true;
    const version = project.getToolVersion(toolId);
    if (version === undefined) return false;
    machine.addTool(toolId, version, []);
    return true;
  }

  /** What of one tool's outcome reaches the machine record. */
  private machineClaimsOf(
    toolId: ToolId,
    outcome: HostRegistrationOutcome,
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
