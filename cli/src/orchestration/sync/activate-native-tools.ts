import type {
  HostRegistrationOutcome,
  RegisterPluginWithHost,
} from "../../contexts/host-registration/application/register-plugin-with-host.js";
import type { BuiltCatalogs } from "../../contexts/host-registration/contract/built-catalogs.js";
import type { ClaimsView } from "../../contexts/host-registration/contract/claims-view.js";
import type { BuildMarketplaceForTool } from "../../contexts/installation/application/sync/build-marketplace-for-tool.js";
import type { SyncContext } from "../../contexts/installation/application/sync/load-sync-context.js";
import type { MarketplaceScope } from "../../shared/domain/scope.js";
import type { ToolId } from "../../shared/domain/tool.js";
import type { Logger } from "../../shared/ports/logger.js";

type SyncedManifest = SyncContext["manifest"];
type SyncedMarketplaces = SyncContext["marketplaces"];

/** What the record rules answer about refs: the host name a ref sits under, and which recorded
 * refs sit on which host. */
interface RefRules {
  readonly refOnHostName: (plugin: string, hostName: string) => string;
  readonly refsOnHosts: (
    record: NonNullable<ReturnType<SyncedManifest["getNativeRegistrations"]>>,
    hostNames: Iterable<string>
  ) => string[];
}

interface PluginRefsRun {
  toolId: ToolId;
  manifest: SyncedManifest;
  marketplaces: SyncedMarketplaces;
  hostNameByAlias: ReadonlyMap<string, string>;
  scope: MarketplaceScope;
}

export interface ActivationRun {
  outcomes: ReadonlyMap<ToolId, HostRegistrationOutcome>;
  binaryMissing: readonly { toolId: ToolId; binary: string }[];
  warnings: readonly string[];
  errors: readonly { scope: string; message: string }[];
}

export interface ActivateNativeToolsRequest {
  projectRoot: string;
  context: SyncContext;
  /** What a host registration is checked against for one tool. */
  claims: (toolId: ToolId) => ClaimsView;
  scope: MarketplaceScope;
  enablePlugins: readonly string[];
}

/** The marketplace the requested plugins are enabled from. */
export interface ActivationMarketplace {
  readonly name: string;
  /** Root of a user-scope marketplace's built tree, mirroring `CacheBuiltMarketplace`'s
   * own `userCacheRoot`: the version a drift is decided against comes from `builtDir` itself,
   * already built before this runs, never from a path recomputed without one. */
  readonly userCacheRoot: () => string;
}

export class ActivateNativeTools {
  constructor(
    private readonly registerPluginWithHost: Pick<RegisterPluginWithHost, "execute">,
    private readonly buildMarketplace: BuildMarketplaceForTool,
    private readonly logger: Logger,
    private readonly marketplace: ActivationMarketplace,
    private readonly records: RefRules
  ) {}

  /** Never a tool with no native activation, and never one whose binary is absent: neither wrote
   * anything, so a settings file that differs for it differs because a person changed it. */
  async execute(request: ActivateNativeToolsRequest): Promise<ActivationRun> {
    const { projectRoot, context, claims, scope, enablePlugins } = request;
    const { manifest, marketplaces } = context;
    const outcomes = new Map<ToolId, HostRegistrationOutcome>();
    const binaryMissing: { toolId: ToolId; binary: string }[] = [];
    const warnings: string[] = [];
    const errors: { scope: string; message: string }[] = [];
    for (const toolId of context.toolIds) {
      try {
        const result = await this.registerPluginWithHost.execute({
          toolId,
          projectRoot,
          scope,
          marketplaces,
          claims: claims(toolId),
          build: this.builtFor(toolId, projectRoot),
          refsToEnable: (hostNameByAlias) =>
            this.refsToEnableOn({
              toolId,
              manifest,
              marketplaces,
              hostNameByAlias,
              scope,
              enablePlugins,
            }),
          userCacheRoot: this.marketplace.userCacheRoot,
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
        errors.push({
          scope: toolId,
          message: (error as Error).message,
        });
      }
    }
    return { outcomes, binaryMissing, warnings, errors };
  }

  /** Each catalogue's tree, built for one tool the moment its registration asks for it. */
  private builtFor(toolId: ToolId, projectRoot: string): BuiltCatalogs<SyncedMarketplaces[number]> {
    return (marketplace) => this.buildMarketplace.forTool(toolId, marketplace, projectRoot);
  }

  /** The refs this run enables: the manifest's own, plus the framework plugins a caller asked
   * for, which only the framework marketplace can resolve. */
  private refsToEnableOn(run: PluginRefsRun & { enablePlugins: readonly string[] }): string[] {
    const { hostNameByAlias, enablePlugins } = run;
    const frameworkHost = hostNameByAlias.get(this.marketplace.name);
    const requested =
      frameworkHost === undefined
        ? []
        : enablePlugins.map((name) => this.records.refOnHostName(name, frameworkHost));
    return [...new Set([...this.pluginRefsToEnable(run), ...requested])];
  }

  /** Keyed by `hostName`, not `plugin.marketplace` (aidd's own alias): the host resolves the
   * marketplace half of a ref against its own registry, which knows this catalog only by the
   * name it declares itself. */
  private pluginRefsToEnable(run: PluginRefsRun): string[] {
    const { toolId, manifest, marketplaces, hostNameByAlias, scope } = run;
    const byName = new Map(marketplaces.map((m) => [m.name, m]));
    const refs: string[] = [];
    for (const plugin of manifest.getPlugins(toolId)) {
      const marketplace = plugin.marketplace == null ? undefined : byName.get(plugin.marketplace);
      if (marketplace === undefined) continue;
      const hostName = hostNameByAlias.get(marketplace.name);
      if (hostName === undefined) continue;
      refs.push(this.records.refOnHostName(plugin.name, hostName));
    }
    // Native-only global installs record successful activations, not copied plugin files.
    // Claims also recover a selection an older sync dropped from its projection.
    if (scope === "user") {
      const native = manifest.getNativeRegistrations(toolId);
      const provenHosts = [...hostNameByAlias.values()];
      if (native !== undefined) refs.push(...this.records.refsOnHosts(native, provenHosts));
    }
    return refs;
  }
}
