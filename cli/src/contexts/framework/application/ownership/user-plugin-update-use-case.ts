import { PluginNotFoundError } from "../../../../kernel/errors.js";
import type { Logger } from "../../../../kernel/ports/logger.js";
import { Manifest } from "../../domain/manifest.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import { resolvePluginToolIds } from "../plugin/plugin-target-resolution.js";
import type { PluginUpdateOptions } from "../plugin/plugin-update-use-case.js";
import type { NativeHostRegistrationGate } from "./native-host-registration-gate.js";
import type { UserPluginFileUpdater } from "./user-plugin-file-updater.js";

export class UserPluginUpdateUseCase {
  constructor(
    private readonly repo: ManifestRepository,
    private readonly fileUpdater: UserPluginFileUpdater,
    private readonly logger: Logger,
    private readonly nativeHost: NativeHostRegistrationGate
  ) {}

  async execute(options: PluginUpdateOptions): Promise<string[]> {
    const run = () => this.updateLocked(options);
    return this.repo.withExclusiveAccess === undefined ? run() : this.repo.withExclusiveAccess(run);
  }

  private async updateLocked(options: PluginUpdateOptions): Promise<string[]> {
    const loaded = await this.repo.load();
    if (loaded === null)
      throw new Error(
        "No machine manifest: cannot prove AIDD ownership for user-scope plugin update."
      );
    const manifest = Manifest.fromJSON(loaded.toJSON());
    const toolIds = resolvePluginToolIds(options.toolIds, manifest);
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
    const nativeTargets = toolIds.flatMap((toolId) =>
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
    const filePlans = await Promise.all(
      targets.map(async ({ toolId, plugin }) => ({
        toolId,
        plugin,
        plan: await this.fileUpdater.planUpdate(plugin, toolId, options.projectRoot, this.logger),
      }))
    );
    const nativeUpdates = await Promise.all(
      nativeTargets.map(async ({ toolId, claim, registrations }) => ({
        toolId,
        claim,
        activator: await this.nativeHost.requireTargetedUpdate(
          toolId,
          claim,
          options.projectRoot,
          registrations
        ),
      }))
    );
    const updated: string[] = [];
    for (const { toolId, claim, activator } of nativeUpdates) {
      if (claim.dependents.length > 0)
        this.logger.warn(
          `${toolId}: updating native ref '${claim.ref}' affects ${claim.dependents.join(", ")}; projects must refresh their local integrations afterward.`
        );
      if (activator.updatePlugin === undefined)
        throw new Error(
          `${toolId}: targeted native update became unavailable; canonical claims retained.`
        );
      activator.updatePlugin(claim.ref);
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
        next = await this.fileUpdater.applyUpdate(plan, this.logger);
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
