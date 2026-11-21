import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { Lock } from "../../../../shared/ports/lock.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import { PluginNotFoundError } from "../../domain/installation.error.js";
import type { NativeRegistrations } from "../../domain/manifest/native-registrations.js";
import { Manifest } from "../../domain/manifest.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type { RegistrationRecordRules } from "../../ports/native-host.js";
import type {
  ContainmentCheck,
  PlannedUserPluginFileUpdate,
  UserPluginMaterialization,
} from "../../ports/plugin/user-plugin-materialization.js";
import type { ActivatedTool } from "../../ports/tool-sections.js";
import { resolvePluginToolIds } from "./plugin-target-resolution.js";
import type { UpdatePluginCommand } from "./update-plugin.js";

/** A host refresh whose proofs all held: applying it is the only step left. */
export interface ProvenNativeRefresh {
  apply(): void;
}

/** Proves, then refreshes, one AIDD-owned native ref on its host. The scenario supplies it. */
export type RefreshNativeRef = (request: {
  readonly tool: ActivatedTool;
  readonly ref: string;
  readonly projectRoot: string;
  readonly registrations: NativeRegistrations | undefined;
}) => Promise<ProvenNativeRefresh>;

/** What a machine-scope update needs beyond the plugins it names. */
export interface UpdateUserPluginFilesCommand extends UpdatePluginCommand {
  readonly isWithinUserScope: ContainmentCheck;
  readonly refreshNative: RefreshNativeRef;
}

type NativeTargets = ReturnType<UpdateUserPluginFiles["nativeTargets"]>;

/** Brings the machine-scope plugins, and the native refs aidd owns, to their latest version. */
export class UpdateUserPluginFiles {
  constructor(
    private readonly repo: ManifestRepository & Lock,
    private readonly materializer: UserPluginMaterialization,
    private readonly logger: Logger,
    private readonly records: RegistrationRecordRules,
    private readonly tools: ToolCatalog
  ) {}

  async execute(options: UpdateUserPluginFilesCommand): Promise<string[]> {
    const run = () => this.updateLocked(options);
    return this.repo.withExclusiveAccess(run);
  }

  private async updateLocked(options: UpdateUserPluginFilesCommand): Promise<string[]> {
    const loaded = await this.repo.load();
    if (loaded === null)
      throw new Error(
        "No machine manifest: cannot prove AIDD ownership for user-scope plugin update."
      );
    const manifest = Manifest.fromJSON(loaded.toJSON(), (raw) => this.tools.toolId(raw));
    const toolIds = resolvePluginToolIds(options.toolIds, manifest, this.tools);
    const targets = this.fileTargets(manifest, toolIds, options);
    const nativeTargets = this.nativeTargets(manifest, toolIds, options);
    this.assertSelectionResolves(options, { files: targets.length, native: nativeTargets });
    // One plan at a time: plans for one tool share its built tree, which the first one builds.
    const filePlans = [];
    for (const { toolId, plugin } of targets) {
      const plan = await this.materializer.planUpdate({
        plugin,
        tool: this.tools.aiProfile(toolId),
        projectRoot: options.projectRoot,
        logger: this.logger,
        rebuild: options.rebuild === true,
        isWithinUserScope: options.isWithinUserScope,
      });
      filePlans.push({ toolId, plugin, plan });
    }
    const updated = await this.refreshNativeRefs(nativeTargets, options);
    for (const { toolId, plugin, plan } of filePlans) {
      if (plan === null) continue;
      manifest.updatePlugin(toolId, await this.applyFilePlan({ toolId, plugin, plan }, options));
      updated.push(plugin.name);
    }
    if (updated.length > 0) await this.repo.save(manifest);
    return updated;
  }

  private fileTargets(
    manifest: Manifest,
    toolIds: readonly AiToolId[],
    options: UpdatePluginCommand
  ) {
    return toolIds.flatMap((toolId) =>
      manifest
        .getPlugins(toolId)
        .filter(
          (plugin) =>
            plugin.scope === "user" &&
            (options.pluginNames === undefined || options.pluginNames.includes(plugin.name))
        )
        .map((plugin) => ({ toolId, plugin }))
    );
  }

  // A rebuild re-materializes the files aidd wrote; a host enabling plugins itself picks the
  // rebuilt tree up through its own marketplace refresh, which activation drives.
  private nativeTargets(
    manifest: Manifest,
    toolIds: readonly AiToolId[],
    options: UpdatePluginCommand
  ) {
    return (options.rebuild === true ? [] : toolIds).flatMap((toolId) =>
      (manifest.getNativeRegistrations(toolId)?.pluginClaims ?? [])
        .filter(
          (claim) =>
            options.pluginNames === undefined ||
            options.pluginNames.some((name) => this.records.refSelectedBy(claim.ref, name))
        )
        .map((claim) => ({ toolId, claim, registrations: manifest.getNativeRegistrations(toolId) }))
    );
  }

  private assertSelectionResolves(
    options: UpdatePluginCommand,
    selected: { files: number; native: NativeTargets }
  ): void {
    const { pluginNames } = options;
    if (pluginNames === undefined) return;
    if (selected.files === 0 && selected.native.length === 0) {
      throw new PluginNotFoundError(pluginNames.join(", "));
    }
    if (
      pluginNames.some(
        (name) =>
          !this.records.isQualifiedRef(name) &&
          selected.native.filter(({ claim }) => this.records.refSelectedBy(claim.ref, name))
            .length > 1
      )
    ) {
      throw new Error(
        "Multiple native catalogues match this plugin name; use an exact <plugin>@<catalogue> ref for targeted update."
      );
    }
  }

  private async refreshNativeRefs(
    targets: NativeTargets,
    options: UpdateUserPluginFilesCommand
  ): Promise<string[]> {
    const refreshes = await Promise.all(
      targets.map(async ({ toolId, claim, registrations }) => ({
        toolId,
        claim,
        refresh: await options.refreshNative({
          tool: this.tools.aiProfile(toolId),
          ref: claim.ref,
          projectRoot: options.projectRoot,
          registrations,
        }),
      }))
    );
    const updated: string[] = [];
    for (const { toolId, claim, refresh } of refreshes) {
      if (claim.dependents.length > 0)
        this.logger.warn(
          `${toolId}: updating native ref '${claim.ref}' affects ${claim.dependents.join(", ")}; projects must refresh their local integrations afterward.`
        );
      refresh.apply();
      updated.push(claim.ref);
    }
    return updated;
  }

  private async applyFilePlan(
    planned: { toolId: AiToolId; plugin: InstalledPlugin; plan: PlannedUserPluginFileUpdate },
    options: UpdateUserPluginFilesCommand
  ): Promise<InstalledPlugin> {
    const { toolId, plugin, plan } = planned;
    if (plugin.dependents.length > 0)
      this.logger.warn(
        `${toolId}: updating user-scope '${plugin.name}' affects ${plugin.dependents.join(", ")}; each project must refresh its own integration afterward.`
      );
    try {
      return await this.materializer.applyUpdate(plan, {
        logger: this.logger,
        isWithinUserScope: options.isWithinUserScope,
      });
    } catch (error) {
      throw new Error(
        `${toolId}: user plugin file update failed after preflight; a native ref may already have been updated and file bytes may be partial. Canonical claim not saved; reconcile manually before retrying.`,
        { cause: error }
      );
    }
  }
}
