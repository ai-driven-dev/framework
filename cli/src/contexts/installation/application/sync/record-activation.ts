import { resolve } from "node:path";
import type { MarketplaceScope } from "../../../../shared/domain/scope.js";
import type { ToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Hasher } from "../../../../shared/ports/hasher.js";
import type { Lock } from "../../../../shared/ports/lock.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { MarketplaceRegistrationAnswers } from "../../../tools/contract/tool-profile.js";
import { Manifest } from "../../domain/manifest.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type { DeclaredMarketplace } from "../../ports/marketplace-sources.js";
import type { HostRegistrationOutcome, RegistrationRecordRules } from "../../ports/native-host.js";

/** What a run observed or caused, written back into the manifests that track it. */
export class RecordActivation {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly hasher: Hasher,
    private readonly records: RegistrationRecordRules,
    private readonly tools: ToolCatalog,
    private readonly userManifestRepo?: ManifestRepository & Lock
  ) {}

  /** Only for a tool this run actually activated. */
  recordNativeRegistrations(
    manifest: Manifest,
    activated: ReadonlyMap<ToolId, HostRegistrationOutcome>,
    narrowed: boolean
  ): boolean {
    let changed = false;
    for (const [toolId, outcome] of activated) {
      const binary = this.nativeActivationBinary(toolId);
      if (binary === undefined) continue;
      const registrations = this.records.afterActivation(
        manifest.getNativeRegistrations(toolId),
        outcome,
        binary,
        narrowed
      );
      if (registrations === undefined) continue;
      manifest.setNativeRegistrations(toolId, registrations);
      changed = true;
    }
    return changed;
  }

  /**
   * A host's own CLI writes its registration into the very file `syncTool` had just hashed, so
   * the hash is re-read from disk after activation rather than re-derived — what is stored is
   * then the observation, not a guess at what the host would have written.
   */
  async recordWhatActivationWrote(
    projectRoot: string,
    manifest: Manifest,
    activated: readonly ToolId[]
  ): Promise<boolean> {
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
      const hash = this.hasher.hash(content);
      if (hash.value === tracked.hash.value) continue;
      manifest.updateTrackedFileHash(toolId, settingsPath, hash);
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

  async recordMachinePluginClaims(
    project: Manifest,
    outcomes: ReadonlyMap<ToolId, HostRegistrationOutcome>,
    marketplaces: readonly DeclaredMarketplace[],
    scope: MarketplaceScope,
    projectRoot?: string
  ): Promise<void> {
    if (this.userManifestRepo === undefined) return;
    const machine = (await this.userManifestRepo.load()) ?? Manifest.create();
    const root = projectRoot === undefined ? undefined : await this.fs.realpath(projectRoot);
    let changed = false;
    for (const [toolId, outcome] of outcomes) {
      const machineRefs =
        scope === "user" || this.enablementIsMachineGlobal(toolId) ? outcome.pluginRefs : [];
      const machineMarketplaces = outcome.catalogClaims.filter((registration) =>
        marketplaces.some(
          (marketplace) =>
            marketplace.name === registration.alias &&
            (marketplace.scope === "user" || this.enablementIsMachineGlobal(toolId))
        )
      );
      if (machineRefs.length === 0 && machineMarketplaces.length === 0) continue;
      if (!machine.hasTool(toolId)) {
        const version = project.getToolVersion(toolId);
        if (version === undefined) continue;
        machine.addTool(toolId, version, []);
      }
      const merged = this.records.mergeCatalogueClaims(
        machine.getNativeRegistrations(toolId),
        { marketplaces: machineMarketplaces, refs: machineRefs, dependent: root },
        this.nativeActivationBinary(toolId) ?? toolId
      );
      changed ||= merged.changed;
      if (changed) machine.setNativeRegistrations(toolId, merged.record);
    }
    if (changed) await this.userManifestRepo.save(machine);
  }

  /** Whether enabling a plugin acts on the whole machine; true for an editor. */
  private enablementIsMachineGlobal(toolId: ToolId): boolean {
    return this.tools.aiProfileIfAny(toolId)?.pluginEnablementIsMachineGlobal() ?? true;
  }
}
