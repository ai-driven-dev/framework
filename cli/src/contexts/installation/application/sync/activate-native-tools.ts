import type { MarketplaceScope } from "../../../../shared/domain/scope.js";
import type { ToolId } from "../../../../shared/domain/tool.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../distribution/contract/marketplace.js";
import type { HostRegistrationOutcome } from "../../../host-registration/contract/native-registration.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { Manifest } from "../../domain/manifest.js";
import type { DeclaredMarketplace } from "../../ports/marketplace-sources.js";
import type { NativeHostRegistration } from "../../ports/native-host.js";
import type { BuildMarketplaceForTool } from "./build-marketplace-for-tool.js";
import type { SyncContext } from "./load-sync-context.js";

export interface ActivationRun {
  outcomes: ReadonlyMap<ToolId, HostRegistrationOutcome>;
  binaryMissing: readonly { toolId: ToolId; binary: string }[];
  warnings: readonly string[];
  errors: readonly { scope: string; message: string }[];
}

export interface ActivateNativeToolsRequest {
  tools: ToolCatalog;
  projectRoot: string;
  context: SyncContext;
  scope: MarketplaceScope;
  enablePlugins: readonly string[];
}

export class ActivateNativeTools {
  constructor(
    private readonly registerPluginWithHost: NativeHostRegistration,
    private readonly buildMarketplace: BuildMarketplaceForTool,
    private readonly logger: Logger,
    /** Root of a user-scope marketplace's built tree, mirroring `EnsureBuiltMarketplace`'s
     * own `userCacheRoot` — the version a drift is decided against comes from `builtDir` itself,
     * already built before this runs, never from a path recomputed without one. */
    private readonly userCacheRoot: () => string = () => ""
  ) {}

  /** Never a tool with no native activation, and never one whose binary is absent: neither wrote
   * anything, so a settings file that differs for it differs because a person changed it. */
  async execute(request: ActivateNativeToolsRequest): Promise<ActivationRun> {
    const { tools, projectRoot, context, scope, enablePlugins } = request;
    const { manifest, marketplaces } = context;
    const outcomes = new Map<ToolId, HostRegistrationOutcome>();
    const binaryMissing: { toolId: ToolId; binary: string }[] = [];
    const warnings: string[] = [];
    const errors: { scope: string; message: string }[] = [];
    for (const toolId of context.toolIds) {
      try {
        const result = await this.registerPluginWithHost.execute({
          tools,
          toolId,
          projectRoot,
          scope,
          marketplaces,
          claims: context.claimsOf(toolId),
          build: (marketplace) => this.buildMarketplace.execute(toolId, marketplace, projectRoot),
          refsToEnable: (hostNameByAlias) =>
            this.refsToEnableOn(
              toolId,
              manifest,
              marketplaces,
              hostNameByAlias,
              scope,
              enablePlugins
            ),
          userCacheRoot: this.userCacheRoot,
          sink: { logger: this.logger, warnings },
        });
        if (result.status === "binary-missing") {
          this.logger.warn(
            `${result.binary} CLI not found on PATH — skipping native plugin activation.${
              enablePlugins.length > 0 ? " Rerun `aidd setup --global` once it is installed." : ""
            }`
          );
          binaryMissing.push({ toolId, binary: result.binary });
        } else if (result.status === "activated") outcomes.set(toolId, result.outcome);
      } catch (error) {
        errors.push({ scope: toolId, message: (error as Error).message });
      }
    }
    return { outcomes, binaryMissing, warnings, errors };
  }

  /** The refs this run enables: the manifest's own, plus the framework plugins a caller asked
   * for, which only the framework marketplace can resolve. */
  private refsToEnableOn(
    toolId: ToolId,
    manifest: Manifest,
    marketplaces: readonly DeclaredMarketplace[],
    hostNameByAlias: ReadonlyMap<string, string>,
    scope: MarketplaceScope,
    enablePlugins: readonly string[]
  ): string[] {
    const frameworkHost = hostNameByAlias.get(FRAMEWORK_MARKETPLACE_NAME);
    const requested =
      frameworkHost === undefined ? [] : enablePlugins.map((name) => `${name}@${frameworkHost}`);
    return [
      ...new Set([
        ...this.pluginRefsToEnable(toolId, manifest, marketplaces, hostNameByAlias, scope),
        ...requested,
      ]),
    ];
  }

  /** Keyed by `hostName`, not `plugin.marketplace` (aidd's own alias): the host resolves the
   * marketplace half of a ref against its own registry, which knows this catalog only by the
   * name it declares itself. */
  private pluginRefsToEnable(
    toolId: ToolId,
    manifest: Manifest,
    marketplaces: readonly DeclaredMarketplace[],
    hostNameByAlias: ReadonlyMap<string, string>,
    scope: MarketplaceScope
  ): string[] {
    const byName = new Map(marketplaces.map((m) => [m.name, m]));
    const refs: string[] = [];
    for (const plugin of manifest.getPlugins(toolId)) {
      const marketplace = plugin.marketplace == null ? undefined : byName.get(plugin.marketplace);
      if (marketplace === undefined) continue;
      const hostName = hostNameByAlias.get(marketplace.name);
      if (hostName === undefined) continue;
      refs.push(`${plugin.name}@${hostName}`);
    }
    // Native-only global installs record successful activations, not copied plugin files.
    // Claims also recover a selection an older sync dropped from its projection.
    if (scope === "user") {
      const native = manifest.getNativeRegistrations(toolId);
      const provenHosts = [...hostNameByAlias.values()];
      for (const ref of [
        ...(native?.pluginRefs ?? []),
        ...(native?.pluginClaims ?? []).map((claim) => claim.ref),
      ]) {
        if (provenHosts.some((hostName) => ref.endsWith(`@${hostName}`))) refs.push(ref);
      }
    }
    return refs;
  }
}
