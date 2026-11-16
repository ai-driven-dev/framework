import { ActiveMachineDependentsError } from "../../../../shared/domain/errors.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Lock } from "../../../../shared/ports/lock.js";
import type { NativeHostRegistrationGate } from "../../../host-registration/application/native-host-registration-gate.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type { UserPluginFileProof } from "../../ports/user-plugin-file-proof.js";
import { deletePluginFilesForTool } from "../plugin/plugin-helpers.js";

export interface PurgeMarketplacePluginsCommand {
  marketplace: string;
  tools: ToolCatalog;
  projectRoot: string;
  home: string;
  /** Runs once the machine lock is held, before anything is read from the user record. */
  whileLocked: () => Promise<void>;
  /** Runs once the plugins and host claims are gone, before the user record is saved. */
  forget: () => Promise<void>;
}

/** Removes everything the machine holds on behalf of one user-scope marketplace: the plugins
 * installed from it, and the host's catalogue and plugin claims, once none is still in use. */
export class PurgeMarketplacePlugins {
  constructor(
    private readonly fs: FileWriter,
    private readonly repo: ManifestRepository & Lock,
    private readonly nativeHost: Pick<NativeHostRegistrationGate, "planMarketplaceRemoval">,
    private readonly proveFiles: UserPluginFileProof
  ) {}

  /** The count of plugins and host plugin references removed. */
  async execute(command: PurgeMarketplacePluginsCommand): Promise<number> {
    return this.repo.withExclusiveAccess(() => this.purgeLocked(command));
  }

  private async purgeLocked(command: PurgeMarketplacePluginsCommand): Promise<number> {
    const { marketplace, tools, projectRoot, home } = command;
    await command.whileLocked();
    const manifest = await this.repo.load();
    if (manifest === null)
      throw new Error(
        `Cannot prove AIDD ownership of user-scope marketplace '${marketplace}': no user manifest.`
      );
    const plugins = tools.idsInCanonicalOrder("ai").flatMap((toolId) =>
      manifest
        .getPlugins(toolId)
        .filter((plugin) => plugin.scope === "user" && plugin.marketplace === marketplace)
        .map((plugin) => ({ toolId, plugin }))
    );
    const native = tools.idsInCanonicalOrder("ai").flatMap((toolId) => {
      const registrations = manifest.getNativeRegistrations(toolId);
      if (registrations === undefined) return [];
      return registrations.marketplaces
        .filter((registration) => registration.alias === marketplace)
        .map((registration) => ({ toolId, registrations, registration }));
    });
    if (plugins.length === 0 && native.length === 0) {
      throw new Error(
        `Cannot prove AIDD ownership of user-scope marketplace '${marketplace}': no canonical plugin or host catalogue claim.`
      );
    }
    const nativeRefs = native.flatMap(({ registrations, registration }) =>
      (registrations.pluginClaims ?? []).filter((claim) =>
        claim.ref.endsWith(`@${registration.hostName}`)
      )
    );
    const dependents = [
      ...new Set([
        ...plugins.flatMap(({ plugin }) => plugin.dependents),
        ...nativeRefs.flatMap((claim) => claim.dependents),
      ]),
    ];
    if (dependents.length > 0)
      throw new ActiveMachineDependentsError(`user-scope marketplace '${marketplace}'`, dependents);
    const safeFiles = await Promise.all(
      plugins.map(async ({ toolId, plugin }) => {
        const files = await this.proveFiles(plugin, tools.aiProfile(toolId), home);
        if (files.size !== plugin.files.size)
          throw new Error(
            `Refusing partial user-scope marketplace removal: '${plugin.name}' has a tracked file outside its boundary.`
          );
        return { toolId, plugin, files };
      })
    );
    const nativeCalls = await Promise.all(
      native.map(async ({ toolId, registrations, registration }) => ({
        toolId,
        registrations,
        registration,
        ...(await this.nativeHost.planMarketplaceRemoval(
          tools.aiProfile(toolId),
          registrations,
          registration,
          projectRoot
        )),
      }))
    );
    for (const { registration, activator, refs, scopes } of nativeCalls) {
      for (const claim of refs)
        activator.uninstallPlugin(claim.ref, scopes.get(claim.ref) ?? "user");
      activator.removeMarketplace(registration.hostName, "user");
    }
    for (const { toolId, plugin, files } of safeFiles) {
      await deletePluginFilesForTool(
        files,
        "user",
        tools.aiProfile(toolId),
        projectRoot,
        this.fs,
        "user"
      );
      manifest.removePlugin(toolId, plugin.name);
    }
    for (const { toolId, registrations, registration } of nativeCalls) {
      manifest.setNativeRegistrations(toolId, {
        ...registrations,
        marketplaces: registrations.marketplaces.filter(
          (entry) => entry.alias !== registration.alias
        ),
        pluginRefs: registrations.pluginRefs.filter(
          (ref) => !ref.endsWith(`@${registration.hostName}`)
        ),
        pluginClaims: (registrations.pluginClaims ?? []).filter(
          (claim) => !claim.ref.endsWith(`@${registration.hostName}`)
        ),
      });
    }
    await command.forget();
    await this.repo.save(manifest);
    return plugins.length + nativeRefs.length;
  }
}
