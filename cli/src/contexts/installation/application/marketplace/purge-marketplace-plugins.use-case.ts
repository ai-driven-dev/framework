import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { Lock } from "../../../../shared/ports/lock.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import { ActiveMachineDependentsError } from "../../domain/installation.error.js";
import type { NativeRegistrations } from "../../domain/manifest/native-registrations.js";
import type { Manifest } from "../../domain/manifest.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type { RegistrationRecordRules } from "../../ports/native-host.js";
import type { HostRefCountingTool } from "../../ports/tool-sections.js";
import type { UserScopePluginFileRemoval } from "../../ports/user-scope-plugin-files.js";

type PluginOf = { toolId: AiToolId; plugin: InstalledPlugin; dependents: readonly string[] };
type NativeOf = {
  toolId: AiToolId;
  registrations: NativeRegistrations;
  registration: NonNullable<ReturnType<RegistrationRecordRules["marketplaceOf"]>>;
};

/** One tool's record of the catalogue being removed. */
export interface MarketplaceHostTarget {
  readonly tool: HostRefCountingTool;
  readonly registrations: NativeRegistrations;
  readonly registration: NativeOf["registration"];
}

/** The host's side of a catalogue removal, the caller's: every plan is made before any is
 * applied, so a host that refuses stops the removal before anything is withdrawn. */
export interface MarketplaceHostRemoval<Plan> {
  plan(target: MarketplaceHostTarget): Promise<Plan>;
  apply(plan: Plan): void;
}

export interface PurgeMarketplacePluginsRequest<Plan> {
  marketplace: string;
  projectRoot: string;
  home: string;
  /** Runs once the machine lock is held, before anything is read from the user record. */
  whileLocked: () => Promise<void>;
  /** Runs once the plugins and host claims are gone, before the user record is saved. */
  forget: () => Promise<void>;
  hostRemoval: MarketplaceHostRemoval<Plan>;
}

/** What PurgeMarketplacePlugins is built from. */
export interface PurgeMarketplacePluginsDeps {
  readonly repo: ManifestRepository & Lock;
  readonly userScopePluginFiles: UserScopePluginFileRemoval;
  readonly records: RegistrationRecordRules;
}

/** Who still depends on the plugins or the native references about to be removed, once each. */
function dependentsOf(
  plugins: readonly { dependents: readonly string[] }[],
  refs: readonly { dependents: readonly string[] }[]
): string[] {
  return [
    ...new Set([
      ...plugins.flatMap((claim) => claim.dependents),
      ...refs.flatMap((claim) => claim.dependents),
    ]),
  ];
}

/** Removes everything the machine holds on behalf of one user-scope marketplace: the plugins
 * installed from it, and the host's catalogue and plugin claims, once none is still in use. */
export class PurgeMarketplacePlugins {
  constructor(
    private readonly deps: PurgeMarketplacePluginsDeps,
    private readonly tools: ToolCatalog
  ) {}

  /** The count of plugins and host plugin references removed. */
  async execute<Plan>(command: PurgeMarketplacePluginsRequest<Plan>): Promise<number> {
    return this.deps.repo.withExclusiveAccess(() => this.purgeLocked(command));
  }

  private async purgeLocked<Plan>(command: PurgeMarketplacePluginsRequest<Plan>): Promise<number> {
    const { marketplace, projectRoot, home } = command;
    await command.whileLocked();
    const manifest = await this.deps.repo.load();
    if (manifest === null)
      throw new Error(
        `Cannot prove AIDD ownership of user-scope marketplace '${marketplace}': no user manifest.`
      );
    const { plugins, native, nativeRefs } = this.claimsOn(manifest, marketplace);
    const dependents = dependentsOf(plugins, nativeRefs);
    if (dependents.length > 0)
      throw new ActiveMachineDependentsError(`user-scope marketplace '${marketplace}'`, dependents);
    const safeFiles = await this.proveFiles(plugins, home);
    await this.withdrawFromHosts(native, command.hostRemoval);
    const where = { projectRoot, home };
    for (const { toolId, plugin, files } of safeFiles) {
      await this.deps.userScopePluginFiles.remove(files, this.tools.aiProfile(toolId), where);
      manifest.removePlugin(toolId, plugin.name);
    }
    for (const { toolId, registrations, registration } of native) {
      manifest.setNativeRegistrations(
        toolId,
        this.deps.records.withoutMarketplace(registrations, registration.alias)
      );
    }
    await command.forget();
    await this.deps.repo.save(manifest);
    return plugins.length + nativeRefs.length;
  }

  private async withdrawFromHosts<Plan>(
    native: readonly NativeOf[],
    hostRemoval: MarketplaceHostRemoval<Plan>
  ): Promise<void> {
    const plans = await Promise.all(
      native.map(({ toolId, registrations, registration }) =>
        hostRemoval.plan({ tool: this.tools.aiProfile(toolId), registrations, registration })
      )
    );
    for (const plan of plans) hostRemoval.apply(plan);
  }

  private claimsOn(manifest: Manifest, marketplace: string) {
    const plugins: PluginOf[] = this.tools.idsInCanonicalOrder("ai").flatMap((toolId) =>
      manifest
        .getRecordedPlugins(toolId)
        .filter((p) => p.plugin.scope === "user" && p.marketplace === marketplace)
        .map(({ plugin, dependents }) => ({ toolId, plugin, dependents }))
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
}
