import { resolve } from "node:path";
import type { MarketplaceScope } from "../../../../shared/domain/scope.js";
import type { ToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Hasher } from "../../../../shared/ports/hasher.js";
import type { Lock } from "../../../../shared/ports/lock.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { MarketplaceRegistrationAnswers } from "../../../tools/contract/tool-profile.js";
import type { NativeRegistrations } from "../../domain/manifest/native-registrations.js";
import { Manifest } from "../../domain/manifest.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type { DeclaredMarketplace } from "../../ports/marketplace-sources.js";
import type {
  HostRegistrationOutcome,
  RegisteredMarketplace,
  SameMarketplaceSource,
} from "../../ports/native-host.js";

/** What a run observed or caused, written back into the manifests that track it. */
export class RecordActivation {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly hasher: Hasher,
    private readonly sameSource: SameMarketplaceSource,
    private readonly userManifestRepo?: ManifestRepository & Lock
  ) {}

  /** Only for a tool this run actually activated. A `narrowed` run's `outcome` carries only the
   * marketplace it touched, so every other entry must survive the merge; an unnarrowed run replaces
   * outright, since anything absent from `outcome` is a dead registration nothing else ever drops.
   * `pluginRefs` merge by the `@<hostName>` suffix only for a hostName no retained marketplace
   * still owns — two local aliases may resolve to one hostName. */
  recordNativeRegistrations(
    tools: ToolCatalog,
    manifest: Manifest,
    activated: ReadonlyMap<ToolId, HostRegistrationOutcome>,
    narrowed: boolean
  ): boolean {
    let changed = false;
    for (const [toolId, outcome] of activated) {
      const binary = this.nativeActivationBinary(tools, toolId);
      if (binary === undefined) continue;
      const existing = manifest.getNativeRegistrations(toolId);
      const projected = [...outcome.marketplaces, ...outcome.preservedMarketplaces];
      const touchedAliases = new Set(projected.map((m) => m.alias));
      const touchedHostNames = new Set(projected.map((m) => m.hostName));
      const retainedMarketplaces = narrowed
        ? (existing?.marketplaces ?? []).filter((m) => !touchedAliases.has(m.alias))
        : [];
      const retainedHostNames = new Set(retainedMarketplaces.map((m) => m.hostName));
      const retainedRefs = narrowed
        ? (existing?.pluginRefs ?? []).filter(
            (ref) =>
              ![...touchedHostNames].some(
                (hostName) => !retainedHostNames.has(hostName) && ref.endsWith(`@${hostName}`)
              )
          )
        : [];
      const preservedHostNames = new Set(outcome.preservedMarketplaces.map((m) => m.hostName));
      const preservedRefs = (existing?.pluginRefs ?? []).filter((ref) =>
        [...preservedHostNames].some((hostName) => ref.endsWith(`@${hostName}`))
      );
      const registrations: NativeRegistrations = {
        binary,
        marketplaces: [...retainedMarketplaces, ...projected],
        pluginRefs: [...new Set([...retainedRefs, ...preservedRefs, ...outcome.pluginRefs])],
        ...(existing?.pluginClaims === undefined ? {} : { pluginClaims: existing.pluginClaims }),
      };
      if (nativeRegistrationsEqual(existing, registrations, this.sameSource)) continue;
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
    tools: ToolCatalog,
    projectRoot: string,
    manifest: Manifest,
    activated: readonly ToolId[]
  ): Promise<boolean> {
    let changed = false;
    for (const toolId of activated) {
      const settingsPath = this.marketplaceSettingsOf(tools, toolId)?.sharedSettingsFile();
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

  private marketplaceSettingsOf(
    tools: ToolCatalog,
    toolId: ToolId
  ): MarketplaceRegistrationAnswers | undefined {
    return tools.aiProfileIfAny(toolId)?.marketplaceRegistration() ?? undefined;
  }

  private nativeActivationBinary(tools: ToolCatalog, toolId: ToolId): string | undefined {
    return tools.aiProfileIfAny(toolId)?.nativeActivation()?.hostBinary();
  }

  async recordMachinePluginClaims(
    tools: ToolCatalog,
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
        scope === "user" || enablementIsMachineGlobal(tools, toolId) ? outcome.pluginRefs : [];
      const machineMarketplaces = outcome.catalogClaims.filter((registration) =>
        marketplaces.some(
          (marketplace) =>
            marketplace.name === registration.alias &&
            (marketplace.scope === "user" || enablementIsMachineGlobal(tools, toolId))
        )
      );
      if (machineRefs.length === 0 && machineMarketplaces.length === 0) continue;
      if (!machine.hasTool(toolId)) {
        const version = project.getToolVersion(toolId);
        if (version === undefined) continue;
        machine.addTool(toolId, version, []);
      }
      const existing = machine.getNativeRegistrations(toolId);
      const registered = [...(existing?.marketplaces ?? [])];
      for (const registration of machineMarketplaces) {
        const index = registered.findIndex(
          (entry) => entry.alias === registration.alias && entry.hostName === registration.hostName
        );
        if (index >= 0) {
          if (
            registration.provenance === undefined ||
            (registered[index].provenance !== undefined &&
              this.sameSource(registered[index].provenance, registration.provenance))
          )
            continue;
          registered[index] = registration;
        } else registered.push(registration);
        changed = true;
      }
      const claims = [...(existing?.pluginClaims ?? [])].map((claim) => ({
        ref: claim.ref,
        dependents: [...claim.dependents],
      }));
      for (const ref of machineRefs) {
        const claim = claims.find((candidate) => candidate.ref === ref);
        if (claim === undefined) {
          claims.push({ ref, dependents: root === undefined ? [] : [root] });
          changed = true;
        } else if (root !== undefined && !claim.dependents.includes(root)) {
          claim.dependents.push(root);
          changed = true;
        }
      }
      if (changed)
        machine.setNativeRegistrations(toolId, {
          binary: existing?.binary ?? this.nativeActivationBinary(tools, toolId) ?? toolId,
          marketplaces: registered,
          pluginRefs: existing?.pluginRefs ?? [],
          pluginClaims: claims,
        });
    }
    if (changed) await this.userManifestRepo.save(machine);
  }
}

/** Order included: both sides are built from the same marketplace/plugin iteration order each
 * run, so a difference is real. Keeps a no-op sync from rewriting the manifest. */
function nativeRegistrationsEqual(
  a: NativeRegistrations | undefined,
  b: NativeRegistrations,
  sameSource: SameMarketplaceSource
): boolean {
  if (a === undefined) return false;
  return (
    a.binary === b.binary &&
    marketplaceRegistrationsEqual(a.marketplaces, b.marketplaces, sameSource) &&
    arraysEqual(a.pluginRefs, b.pluginRefs)
  );
}

function marketplaceRegistrationsEqual(
  a: readonly RegisteredMarketplace[],
  b: readonly RegisteredMarketplace[],
  sameSource: SameMarketplaceSource
): boolean {
  return (
    a.length === b.length &&
    a.every((value, index) => {
      const other = b[index];
      if (other === undefined || value.alias !== other.alias || value.hostName !== other.hostName)
        return false;
      if (value.provenance === undefined || other.provenance === undefined)
        return value.provenance === other.provenance;
      return sameSource(value.provenance, other.provenance);
    })
  );
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** Whether enabling a plugin acts on the whole machine; true for an editor. */
function enablementIsMachineGlobal(tools: ToolCatalog, toolId: ToolId): boolean {
  return tools.aiProfileIfAny(toolId)?.pluginEnablementIsMachineGlobal() ?? true;
}
