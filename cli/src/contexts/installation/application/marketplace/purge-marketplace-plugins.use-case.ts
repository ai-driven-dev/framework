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

export interface PurgeMarketplacePluginsRequest {
  marketplace: string;
  projectRoot: string;
  home: string;
  /** Runs once the machine lock is held, before anything is read from the user record. */
  whileLocked: () => Promise<void>;
  /** Runs once the plugins and host claims are gone, before the user record is saved. */
  forget: () => Promise<void>;
}

/** What PurgeMarketplacePlugins is built from. */
export interface PurgeMarketplacePluginsDeps {
  readonly repo: ManifestRepository & Lock;
  readonly nativeHost: MarketplaceRemovalPlanner;
  readonly userScopePluginFiles: UserScopePluginFileRemoval;
  readonly records: RegistrationRecordRules;
}

function applyNativeRemovals(
  calls: readonly Awaited<ReturnType<PurgeMarketplacePlugins["planNativeRemovals"]>>[number][]
): void {
  for (const { registration, activator, refs, scopes } of calls) {
    for (const claim of refs) activator.uninstallPlugin(claim.ref, scopes.get(claim.ref) ?? "user");
    activator.removeMarketplace(registration.hostName, "user");
  }
}

/** Removes everything the machine holds on behalf of one user-scope marketplace: the plugins
 * installed from it, and the host's catalogue and plugin claims, once none is still in use. */
export class PurgeMarketplacePlugins {
  constructor(
    private readonly deps: PurgeMarketplacePluginsDeps,
    private readonly tools: ToolCatalog
  ) {}

  /** The count of plugins and host plugin references removed. */
  async execute(command: PurgeMarketplacePluginsRequest): Promise<number> {
    return this.deps.repo.withExclusiveAccess(() => this.purgeLocked(command));
  }

  private async purgeLocked(command: PurgeMarketplacePluginsRequest): Promise<number> {
    const { marketplace, projectRoot, home } = command;
    await command.whileLocked();
    const manifest = await this.deps.repo.load();
    if (manifest === null)
      throw new Error(
        `Cannot prove AIDD ownership of user-scope marketplace '${marketplace}': no user manifest.`
      );
    const { plugins, native, nativeRefs } = this.claimsOn(manifest, marketplace);
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
    applyNativeRemovals(nativeCalls);
    for (const { toolId, plugin, files } of safeFiles) {
      await this.deps.userScopePluginFiles.remove(files, this.tools.aiProfile(toolId), projectRoot);
      manifest.removePlugin(toolId, plugin.name);
    }
    for (const { toolId, registrations, registration } of nativeCalls) {
      manifest.setNativeRegistrations(
        toolId,
        this.deps.records.withoutMarketplace(registrations, registration.alias)
      );
    }
    await command.forget();
    await this.deps.repo.save(manifest);
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
      const registration = this.deps.records.marketplaceOf(registrations, marketplace);
      return registration === undefined ? [] : [{ toolId, registrations, registration }];
    });
    if (plugins.length === 0 && native.length === 0) {
      throw new Error(
        `Cannot prove AIDD ownership of user-scope marketplace '${marketplace}': no canonical plugin or host catalogue claim.`
      );
    }
    const nativeRefs = native.flatMap(({ registrations }) =>
      this.deps.records.claimsOnMarketplace(registrations, marketplace)
    );
    return { plugins, native, nativeRefs };
  }

  private proveFiles(plugins: readonly PluginOf[], home: string) {
    return Promise.all(
      plugins.map(async ({ toolId, plugin }) => {
        const files = await this.deps.userScopePluginFiles.proven(
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
        ...(await this.deps.nativeHost.planMarketplaceRemoval(
          this.tools.aiProfile(toolId),
          registrations,
          { registration, projectRoot }
        )),
      }))
    );
  }
}
