import { resolve } from "node:path";
import { FileHash } from "../../../../shared/domain/file.js";
import type { Scope } from "../../../../shared/domain/scope.js";
import type { ToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Lock } from "../../../../shared/ports/lock.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { MarketplaceRegistrationAnswers } from "../../../tools/contract/tool-profile.js";
import { driftOf } from "../../domain/manifest/drift.js";
import { Manifest } from "../../domain/manifest.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type { DeclaredMarketplace } from "../../ports/marketplace-sources.js";
import type { HostRegistrationOutcome, RegistrationRecordRules } from "../../ports/native-host.js";

/** What a run observed or caused. Each answer says whether it changed a manifest. */
export type RecordActivationRequest =
  | {
      readonly kind: "native-registrations";
      readonly manifest: Manifest;
      readonly activated: ReadonlyMap<ToolId, HostRegistrationOutcome>;
      readonly narrowed: boolean;
    }
  | {
      readonly kind: "settings-written-by-host";
      readonly projectRoot: string;
      readonly manifest: Manifest;
      readonly activated: readonly ToolId[];
    }
  | {
      readonly kind: "machine-claims";
      readonly project: Manifest;
      readonly outcomes: ReadonlyMap<ToolId, HostRegistrationOutcome>;
      readonly marketplaces: readonly DeclaredMarketplace[];
      readonly scope: Scope;
      readonly projectRoot?: string;
    };

type Of<K extends RecordActivationRequest["kind"]> = Extract<RecordActivationRequest, { kind: K }>;

/** What a run observed or caused, written back into the manifests that track it. */
export class RecordActivation {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly records: RegistrationRecordRules,
    private readonly tools: ToolCatalog,
    private readonly userManifestRepo?: ManifestRepository & Lock
  ) {}

  async execute(request: RecordActivationRequest): Promise<boolean> {
    switch (request.kind) {
      case "native-registrations":
        return this.recordNativeRegistrations(request);
      case "settings-written-by-host":
        return this.recordWhatActivationWrote(request);
      case "machine-claims":
        return this.recordMachinePluginClaims(request);
    }
  }

  /** Only for a tool this run actually activated. */
  private recordNativeRegistrations({
    manifest,
    activated,
    narrowed,
  }: Of<"native-registrations">): boolean {
    let changed = false;
    for (const [toolId, outcome] of activated) {
      const binary = this.nativeActivationBinary(toolId);
      if (binary === undefined) continue;
      const registrations = this.records.afterActivation(
        manifest.getNativeRegistrations(toolId),
        outcome,
        { binary, narrowed }
      );
      if (registrations === undefined) continue;
      manifest.setNativeRegistrations(toolId, registrations);
      changed = true;
    }
    return changed;
  }

  /**
   * A host's own CLI writes its registration into the very file `syncTool` had just hashed, so
   * the hash is re-read from disk after activation rather than re-derived: what is stored is
   * then the observation, not a guess at what the host would have written.
   */
  private async recordWhatActivationWrote({
    projectRoot,
    manifest,
    activated,
  }: Of<"settings-written-by-host">): Promise<boolean> {
    let changed = false;
    for (const toolId of activated) {
      const settingsPath = this.marketplaceSettingsOf(toolId)?.sharedSettingsFile();
      if (settingsPath === undefined) continue;
      const tracked = manifest
        .getToolFiles(toolId)
        .find((file) => file.relativePath === settingsPath);
      if (tracked === undefined) continue;
      const content = await this.fs.readFile(resolve(projectRoot, settingsPath)).catch(() => null);
      if (content === null) continue;
      const hash = FileHash.of(content);
      if (driftOf(tracked.hash.value, hash) === "ok") continue;
      manifest.recordFileHash(toolId, settingsPath, hash);
      changed = true;
    }
    return changed;
  }

  private marketplaceSettingsOf(toolId: ToolId): MarketplaceRegistrationAnswers | undefined {
    return this.tools.aiProfileIfAny(toolId)?.marketplaceRegistration() ?? undefined;
  }

  private nativeActivationBinary(toolId: ToolId): string | undefined {
    return this.tools.aiProfileIfAny(toolId)?.nativeActivation()?.hostBinary();
  }

  private async recordMachinePluginClaims(request: Of<"machine-claims">): Promise<boolean> {
    if (this.userManifestRepo === undefined) return false;
    const machine = (await this.userManifestRepo.load()) ?? Manifest.create();
    const root =
      request.projectRoot === undefined ? undefined : await this.fs.realpath(request.projectRoot);
    let changed = false;
    for (const [toolId, outcome] of request.outcomes) {
      const claims = this.machineClaimsOf(toolId, outcome, request);
      if (claims.refs.length === 0 && claims.marketplaces.length === 0) continue;
      if (!this.machineTracks(machine, request.project, toolId)) continue;
      const merged = this.records.mergeCatalogueClaims(
        machine.getNativeRegistrations(toolId),
        { ...claims, dependent: root },
        this.nativeActivationBinary(toolId) ?? toolId
      );
      changed ||= merged.changed;
      if (changed) machine.setNativeRegistrations(toolId, merged.record);
    }
    if (changed) await this.userManifestRepo.save(machine);
    return changed;
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
    { scope, marketplaces }: Pick<Of<"machine-claims">, "scope" | "marketplaces">
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
}
