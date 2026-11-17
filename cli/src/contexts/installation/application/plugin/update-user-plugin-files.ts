import { PluginNotFoundError } from "../../../../shared/domain/errors.js";
import type { Lock } from "../../../../shared/ports/lock.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import type { RegistrationRecord } from "../../domain/manifest/native-registrations.js";
import { Manifest } from "../../domain/manifest.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type { ActivatedHostSection } from "../../ports/tool-sections.js";
import type { ContainmentCheck } from "./global-plugin-files.js";
import type { PluginMaterializer } from "./plugin-materializer.js";
import { resolvePluginToolIds } from "./plugin-target-resolution.js";
import type { UpdatePluginCommand } from "./update-plugin.js";

/** A host refresh whose proofs all held: applying it is the only step left. */
export interface ProvenNativeRefresh {
  apply(): void;
}

/** Proves, then refreshes, one AIDD-owned native ref on its host. The scenario supplies it. */
export type RefreshNativeRef = (request: {
  readonly tool: ActivatedHostSection;
  readonly ref: string;
  readonly projectRoot: string;
  readonly registrations: RegistrationRecord | undefined;
}) => Promise<ProvenNativeRefresh>;

/** What a machine-scope update needs beyond the plugins it names. */
export interface UpdateUserPluginFilesCommand extends UpdatePluginCommand {
  readonly isWithinUserScope: ContainmentCheck;
  readonly refreshNative: RefreshNativeRef;
}

/** Brings the machine-scope plugins, and the native refs aidd owns, to their latest version. */
export class UpdateUserPluginFiles {
  constructor(
    private readonly repo: ManifestRepository & Lock,
    private readonly materializer: PluginMaterializer,
    private readonly logger: Logger
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
    const manifest = Manifest.fromJSON(loaded.toJSON(), (raw) => options.tools.toolId(raw));
    const toolIds = resolvePluginToolIds(options.toolIds, manifest, options.tools);
    const targets = toolIds.flatMap((toolId) =>
      manifest
        .getPlugins(toolId)
        .filter(
          (plugin) =>
            plugin.scope === "user" &&
            (options.pluginNames === undefined || options.pluginNames.includes(plugin.name))
        )
        .map((plugin) => ({ toolId, plugin }))
    );
    // A rebuild re-materializes the files aidd wrote; a host enabling plugins itself picks the
    // rebuilt tree up through its own marketplace refresh, which activation drives.
    const nativeTargets = (options.rebuild === true ? [] : toolIds).flatMap((toolId) =>
      (manifest.getNativeRegistrations(toolId)?.pluginClaims ?? [])
        .filter(
          (claim) =>
            options.pluginNames === undefined ||
            options.pluginNames.some((name) =>
              name.includes("@") ? claim.ref === name : claim.ref.startsWith(`${name}@`)
            )
        )
        .map((claim) => ({ toolId, claim, registrations: manifest.getNativeRegistrations(toolId) }))
    );
    if (options.pluginNames !== undefined && targets.length === 0 && nativeTargets.length === 0) {
      throw new PluginNotFoundError(options.pluginNames.join(", "));
    }
    if (
      options.pluginNames?.some(
        (name) =>
          !name.includes("@") &&
          nativeTargets.filter(({ claim }) => claim.ref.startsWith(`${name}@`)).length > 1
      )
    ) {
      throw new Error(
        "Multiple native catalogues match this plugin name; use an exact <plugin>@<catalogue> ref for targeted update."
      );
    }
    // One plan at a time: plans for one tool share its built tree, which the first one builds.
    const filePlans = [];
    for (const { toolId, plugin } of targets) {
      const plan = await this.materializer.planUpdate(
        plugin,
        options.tools.aiProfile(toolId),
        options.projectRoot,
        this.logger,
        options.rebuild === true,
        options.isWithinUserScope
      );
      filePlans.push({ toolId, plugin, plan });
    }
    const nativeUpdates = await Promise.all(
      nativeTargets.map(async ({ toolId, claim, registrations }) => ({
        toolId,
        claim,
        refresh: await options.refreshNative({
          tool: options.tools.aiProfile(toolId),
          ref: claim.ref,
          projectRoot: options.projectRoot,
          registrations,
        }),
      }))
    );
    const updated: string[] = [];
    for (const { toolId, claim, refresh } of nativeUpdates) {
      if (claim.dependents.length > 0)
        this.logger.warn(
          `${toolId}: updating native ref '${claim.ref}' affects ${claim.dependents.join(", ")}; projects must refresh their local integrations afterward.`
        );
      refresh.apply();
      updated.push(claim.ref);
    }
    for (const { toolId, plugin, plan } of filePlans) {
      if (plan === null) continue;
      if (plugin.dependents.length > 0)
        this.logger.warn(
          `${toolId}: updating user-scope '${plugin.name}' affects ${plugin.dependents.join(", ")}; each project must refresh its own integration afterward.`
        );
      let next: InstalledPlugin;
      try {
        next = await this.materializer.applyUpdate(plan, this.logger, options.isWithinUserScope);
      } catch (error) {
        throw new Error(
          `${toolId}: user plugin file update failed after preflight; a native ref may already have been updated and file bytes may be partial. Canonical claim not saved; reconcile manually before retrying.`,
          { cause: error }
        );
      }
      manifest.updatePlugin(toolId, next);
      updated.push(plugin.name);
    }
    if (updated.length > 0) await this.repo.save(manifest);
    return updated;
  }
}
