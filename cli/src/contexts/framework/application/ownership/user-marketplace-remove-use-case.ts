import {
  ActiveMachineDependentsError,
  InvalidMarketplaceNameError,
  MarketplaceNotFoundError,
} from "../../../../kernel/errors.js";
import type { FileReader } from "../../../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../../../kernel/ports/file-writer.js";
import { resolveHomeDir } from "../../../../kernel/reading/home-dir.js";
import { AI_TOOL_IDS } from "../../../../kernel/tool.js";
import {
  FRAMEWORK_MARKETPLACE_NAME,
  type Marketplace,
} from "../../../distribution/domain/marketplace.js";
import type { MarketplaceRegistry } from "../../../distribution/domain/ports/marketplace-registry.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import type {
  MarketplaceRemoveOptions,
  MarketplaceRemoveResult,
} from "../flows/marketplace-remove-use-case.js";
import { deletePluginFilesForTool } from "../plugin/plugin-helpers.js";
import { userScopeFilesSafeToDelete } from "../shared/user-scope-plugin-files.js";
import type { NativeHostRegistrationGate } from "./native-host-registration-gate.js";

export class UserMarketplaceRemoveUseCase {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly repo: ManifestRepository,
    private readonly registry: MarketplaceRegistry,
    private readonly nativeHost: NativeHostRegistrationGate
  ) {}

  async execute(options: MarketplaceRemoveOptions): Promise<MarketplaceRemoveResult> {
    if (options.name === FRAMEWORK_MARKETPLACE_NAME) {
      throw new InvalidMarketplaceNameError(
        `"${FRAMEWORK_MARKETPLACE_NAME}" is shared by every project on this machine and is removed by \`aidd clean --scope user\`, not marketplace remove.`
      );
    }
    const marketplace = await this.findOrThrow(options.projectRoot, options.name);
    const run = () => this.removeLocked(options, marketplace);
    return this.repo.withExclusiveAccess === undefined ? run() : this.repo.withExclusiveAccess(run);
  }

  private async findOrThrow(projectRoot: string, name: string): Promise<Marketplace> {
    const found = (await this.registry.list(projectRoot)).find(
      (entry) => entry.name === name && entry.scope === "user"
    );
    if (found === undefined) throw new MarketplaceNotFoundError(name);
    return found;
  }

  private async removeLocked(
    options: MarketplaceRemoveOptions,
    marketplace: Marketplace
  ): Promise<MarketplaceRemoveResult> {
    const current = await this.findOrThrow(options.projectRoot, marketplace.name);
    if (JSON.stringify(current.source) !== JSON.stringify(marketplace.source)) {
      throw new Error(
        `User-scope marketplace '${marketplace.name}' changed while waiting for the machine lock; retry against its current source.`
      );
    }
    const manifest = await this.repo.load();
    if (manifest === null)
      throw new Error(
        `Cannot prove AIDD ownership of user-scope marketplace '${marketplace.name}': no user manifest.`
      );
    const plugins = AI_TOOL_IDS.flatMap((toolId) =>
      manifest
        .getPlugins(toolId)
        .filter((plugin) => plugin.scope === "user" && plugin.marketplace === marketplace.name)
        .map((plugin) => ({ toolId, plugin }))
    );
    const native = AI_TOOL_IDS.flatMap((toolId) => {
      const registrations = manifest.getNativeRegistrations(toolId);
      if (registrations === undefined) return [];
      return registrations.marketplaces
        .filter((registration) => registration.alias === marketplace.name)
        .map((registration) => ({ toolId, registrations, registration }));
    });
    if (plugins.length === 0 && native.length === 0) {
      throw new Error(
        `Cannot prove AIDD ownership of user-scope marketplace '${marketplace.name}': no canonical plugin or host catalogue claim.`
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
      throw new ActiveMachineDependentsError(
        `user-scope marketplace '${marketplace.name}'`,
        dependents
      );
    const safeFiles = await Promise.all(
      plugins.map(async ({ toolId, plugin }) => {
        const files = await userScopeFilesSafeToDelete(
          this.fs,
          { debug() {}, info() {}, warn() {} },
          plugin,
          toolId,
          resolveHomeDir()
        );
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
          toolId,
          registrations,
          registration,
          options.projectRoot
        )),
      }))
    );
    for (const { registration, activator, refs, scopes } of nativeCalls) {
      for (const claim of refs)
        activator.uninstallPlugin(claim.ref, scopes.get(claim.ref) ?? "user");
      activator.removeMarketplace(registration.hostName, "user");
    }
    for (const { toolId, plugin, files } of safeFiles) {
      await deletePluginFilesForTool(files, "user", toolId, options.projectRoot, this.fs, "user");
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
    await this.registry.delete(options.projectRoot, marketplace.name, "user");
    await this.repo.save(manifest);
    return { marketplace, removedPluginCount: plugins.length + nativeRefs.length, orphanCount: 0 };
  }
}
