import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { Lock } from "../../../../shared/ports/lock.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import { ActiveMachineDependentsError } from "../../domain/installation.error.js";
import type { NativeRegistrations } from "../../domain/manifest/native-registrations.js";
import type { Manifest } from "../../domain/manifest.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type {
  MarketplaceRemovalPlanner,
  RegistrationRecordRules,
} from "../../ports/native-host.js";
import type { UserScopePluginFileRemoval } from "../../ports/user-scope-plugin-files.js";

type PluginOf = { toolId: AiToolId; plugin: InstalledPlugin };
type NativeOf = {
  toolId: AiToolId;
  registrations: NativeRegistrations;
  registration: NonNullable<ReturnType<RegistrationRecordRules["marketplaceOf"]>>;
};

export interface PurgeMarketplacePluginsCommand {
  marketplace: string;
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
    private readonly repo: ManifestRepository & Lock,
    private readonly nativeHost: MarketplaceRemovalPlanner,
    private readonly userScopePluginFiles: UserScopePluginFileRemoval,
    private readonly records: RegistrationRecordRules,
    private readonly tools: ToolCatalog
  ) {}

  /** The count of plugins and host plugin references removed. */
  async execute(command: PurgeMarketplacePluginsCommand): Promise<number> {
    return this.repo.withExclusiveAccess(() => this.purgeLocked(command));
  }

  private async purgeLocked(command: PurgeMarketplacePluginsCommand): Promise<number> {
    const { marketplace, projectRoot, home } = command;
    await command.whileLocked();
    const manifest = await this.repo.load();
    if (manifest === null)
      throw new Error(
        `Cannot prove AIDD ownership of user-scope marketplace '${marketplace}': no user manifest.`
      );
    const claims = this.claimsOn(manifest, marketplace);
    const { plugins, native, nativeRefs } = claims;
    const dependents = [
      ...new Set([
        ...plugins.flatMap(({ plugin }) => plugin.dependents),
        ...nativeRefs.flatMap((claim) => claim.dependents),
      ]),
    ];
    if (dependents.length > 0)
      throw new ActiveMachineDependentsError(`user-scope marketplace '${marketplace}'`, dependents);
    const safeFiles = await this.proveFiles(plugins, home);
    const nativeCalls = await this.planNativeRemovals(native, projectRoot);
    for (const { registration, activator, refs, scopes } of nativeCalls) {
      for (const claim of refs)
        activator.uninstallPlugin(claim.ref, scopes.get(claim.ref) ?? "user");
      activator.removeMarketplace(registration.hostName, "user");
    }
    for (const { toolId, plugin, files } of safeFiles) {
      await this.userScopePluginFiles.remove(files, this.tools.aiProfile(toolId), projectRoot);
      manifest.removePlugin(toolId, plugin.name);
    }
    for (const { toolId, registrations, registration } of nativeCalls) {
      manifest.setNativeRegistrations(
        toolId,
        this.records.withoutMarketplace(registrations, registration.alias)
      );
    }
    await command.forget();
    await this.repo.save(manifest);
    return plugins.length + nativeRefs.length;
  }

  private claimsOn(manifest: Manifest, marketplace: string) {
    const plugins = this.tools.idsInCanonicalOrder("ai").flatMap((toolId) =>
      manifest
        .getPlugins(toolId)
        .filter((plugin) => plugin.scope === "user" && plugin.marketplace === marketplace)
        .map((plugin) => ({ toolId, plugin }))
    );
    const native = this.tools.idsInCanonicalOrder("ai").flatMap((toolId) => {
      const registrations = manifest.getNativeRegistrations(toolId);
      if (registrations === undefined) return [];
      const registration = this.records.marketplaceOf(registrations, marketplace);
      return registration === undefined ? [] : [{ toolId, registrations, registration }];
    });
    if (plugins.length === 0 && native.length === 0) {
      throw new Error(
        `Cannot prove AIDD ownership of user-scope marketplace '${marketplace}': no canonical plugin or host catalogue claim.`
      );
    }
    const nativeRefs = native.flatMap(({ registrations }) =>
      this.records.claimsOnMarketplace(registrations, marketplace)
    );
    return { plugins, native, nativeRefs };
  }

  private proveFiles(plugins: readonly PluginOf[], home: string) {
    return Promise.all(
      plugins.map(async ({ toolId, plugin }) => {
        const files = await this.userScopePluginFiles.proven(
          plugin,
          this.tools.aiProfile(toolId),
          home
        );
        if (files.size !== plugin.files.size)
          throw new Error(
            `Refusing partial user-scope marketplace removal: '${plugin.name}' has a tracked file outside its boundary.`
          );
        return { toolId, plugin, files };
      })
    );
  }

  private planNativeRemovals(native: readonly NativeOf[], projectRoot: string) {
    return Promise.all(
      native.map(async ({ toolId, registrations, registration }) => ({
        toolId,
        registrations,
        registration,
        ...(await this.nativeHost.planMarketplaceRemoval(
          this.tools.aiProfile(toolId),
          registrations,
          { registration, projectRoot }
        )),
      }))
    );
  }
}
