import type {
  RegisterPluginWithHost,
  RegisterPluginWithHostResult,
} from "../../contexts/host-registration/application/register/register-plugin-with-host.use-case.js";
import type { HostRegistrationOutcome } from "../../contexts/host-registration/application/register/registration-outcome.js";
import type { BuiltCatalogs } from "../../contexts/host-registration/contract/built-catalogs.js";
import type { ClaimsView } from "../../contexts/host-registration/contract/claims-view.js";
import type { SyncContext } from "../../contexts/installation/application/sync/load-sync-context.use-case.js";
import type { HintedMessage } from "../../shared/domain/describe-error.js";
import type { Scope } from "../../shared/domain/scope.js";
import type { ToolId } from "../../shared/domain/tool.js";
import type { Logger } from "../../shared/ports/logger.js";
import type { BuildMarketplaceForTool } from "./build-marketplace-for-tool.use-case.js";
import type { PluginRefsRun, RefRules, SyncedMarketplaces } from "./plugin-refs-run.js";

export interface ActivationRun {
  outcomes: ReadonlyMap<ToolId, HostRegistrationOutcome>;
  binaryMissing: readonly { toolId: ToolId; binary: string }[];
  warnings: readonly (string | HintedMessage)[];
  errors: readonly { scope: string; error: unknown }[];
}

/** The run while it is being collected: the same four answers, still open to writing. */
interface ActivationAccumulator {
  outcomes: Map<ToolId, HostRegistrationOutcome>;
  binaryMissing: { toolId: ToolId; binary: string }[];
  warnings: (string | HintedMessage)[];
  errors: { scope: string; error: unknown }[];
}

export interface ActivateNativeToolsRequest {
  projectRoot: string;
  context: SyncContext;
  /** What a host registration is checked against for one tool. */
  claims: (toolId: ToolId) => ClaimsView;
  scope: Scope;
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

export interface ActivateNativeToolsDeps {
  readonly registerPluginWithHost: Pick<RegisterPluginWithHost, "execute">;
  readonly buildMarketplace: Pick<BuildMarketplaceForTool, "forTool">;
  readonly logger: Logger;
  readonly marketplace: ActivationMarketplace;
  readonly records: RefRules;
}

export class ActivateNativeTools {
  constructor(private readonly deps: ActivateNativeToolsDeps) {}

  /** Never a tool with no native activation, and never one whose binary is absent: neither wrote
   * anything, so a settings file that differs for it differs because a person changed it. */
  async execute(request: ActivateNativeToolsRequest): Promise<ActivationRun> {
    const run: ActivationAccumulator = {
      outcomes: new Map(),
      binaryMissing: [],
      warnings: [],
      errors: [],
    };
    for (const toolId of request.context.toolIds) {
      try {
        const result = await this.register(toolId, request, run.warnings);
        this.record({ run, toolId, result, enablePlugins: request.enablePlugins });
      } catch (error) {
        run.errors.push({ scope: toolId, error });
      }
    }
    return run;
  }

  private register(
    toolId: ToolId,
    request: ActivateNativeToolsRequest,
    warnings: (string | HintedMessage)[]
  ) {
    const { projectRoot, context, claims, scope, enablePlugins } = request;
    const { manifest, marketplaces } = context;
    return this.deps.registerPluginWithHost.execute({
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
      userCacheRoot: this.deps.marketplace.userCacheRoot,
      sink: { logger: this.deps.logger, warnings },
    });
  }

  private record(outcome: {
    run: ActivationAccumulator;
    toolId: ToolId;
    result: RegisterPluginWithHostResult;
    enablePlugins: readonly string[];
  }): void {
    const { run, toolId, result, enablePlugins } = outcome;
    if (result.status === "activated") {
      run.outcomes.set(toolId, result.outcome);
    } else if (result.status === "binary-missing") {
      this.deps.logger.warn({
        text: `${result.binary} CLI not found on PATH — skipping native plugin activation.`,
        hint: enablePlugins.length > 0 ? "rerun-setup-global" : undefined,
      });
      run.binaryMissing.push({ toolId, binary: result.binary });
    }
  }

  /** Each catalogue's tree, built for one tool the moment its registration asks for it. */
  private builtFor(toolId: ToolId, projectRoot: string): BuiltCatalogs<SyncedMarketplaces[number]> {
    return (marketplace) => this.deps.buildMarketplace.forTool(toolId, marketplace, projectRoot);
  }

  /** The refs this run enables: the manifest's own, plus the framework plugins a caller asked
   * for, which only the framework marketplace can resolve. */
  private refsToEnableOn(run: PluginRefsRun & { enablePlugins: readonly string[] }): string[] {
    const { hostNameByAlias, enablePlugins } = run;
    const frameworkHost = hostNameByAlias.get(this.deps.marketplace.name);
    const requested =
      frameworkHost === undefined
        ? []
        : enablePlugins.map((name) => this.deps.records.refOnHostName(name, frameworkHost));
    return [...new Set([...this.pluginRefsToEnable(run), ...requested])];
  }

  /** Keyed by `hostName`, not `plugin.marketplace` (aidd's own alias): the host resolves the
   * marketplace half of a ref against its own registry, which knows this catalog only by the
   * name it declares itself. */
  private pluginRefsToEnable(run: PluginRefsRun): string[] {
    return [...this.declaredRefs(run), ...this.nativeRefs(run)];
  }

  private declaredRefs(run: PluginRefsRun): string[] {
    const { toolId, manifest, marketplaces, hostNameByAlias } = run;
    const known = new Set(marketplaces.map((m) => m.name));
    return manifest.getRecordedPlugins(toolId).flatMap(({ plugin, marketplace }) => {
      const alias = marketplace == null ? undefined : marketplace;
      const hostName =
        alias !== undefined && known.has(alias) ? hostNameByAlias.get(alias) : undefined;
      return hostName === undefined ? [] : [this.deps.records.refOnHostName(plugin.name, hostName)];
    });
  }

  // Native-only global installs record successful activations, not copied plugin files.
  // Claims also recover a selection an older sync dropped from its projection.
  private nativeRefs(run: PluginRefsRun): string[] {
    if (run.scope !== "user") return [];
    const native = run.manifest.getNativeRegistrations(run.toolId);
    if (native === undefined) return [];
    return this.deps.records.refsOnHosts(native, this.deps.records.claimedRefs(native), [
      ...run.hostNameByAlias.values(),
    ]);
  }
}
