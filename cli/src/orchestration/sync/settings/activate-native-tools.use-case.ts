import type { PlanRefsToEnable } from "../../../contexts/host-registration/application/register/plan-refs-to-enable.use-case.js";
import type {
  RegisterPluginWithHost,
  RegisterPluginWithHostResult,
} from "../../../contexts/host-registration/application/register/register-plugin-with-host.use-case.js";
import type { HostRegistrationOutcome } from "../../../contexts/host-registration/application/register/registration-outcome.js";
import type { BuiltCatalogs } from "../../../contexts/host-registration/contract/built-catalogs.js";
import type { ClaimsView } from "../../../contexts/host-registration/contract/claims-view.js";
import type { SyncContext } from "../../../contexts/installation/application/sync/load-sync-context.use-case.js";
import type { HintedMessage } from "../../../shared/domain/describe-error.js";
import type { Scope } from "../../../shared/domain/scope.js";
import type { ToolId } from "../../../shared/domain/tool.js";
import type { Logger } from "../../../shared/ports/logger.js";
import type { BuildMarketplaceForTool } from "./build-marketplace-for-tool.use-case.js";
import type { SyncedMarketplaces } from "./plugin-refs-run.js";

export interface ActivationRun {
  outcomes: ReadonlyMap<ToolId, HostRegistrationOutcome>;
  /** The tools whose host took plugins through its own server, which no registration records. */
  served: readonly ToolId[];
  binaryMissing: readonly { toolId: ToolId; binary: string }[];
  warnings: readonly (string | HintedMessage)[];
  errors: readonly { scope: string; error: unknown }[];
}

/** The run while it is being collected: the same four answers, still open to writing. */
interface ActivationAccumulator {
  outcomes: Map<ToolId, HostRegistrationOutcome>;
  served: ToolId[];
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
  /** Root of a user-scope marketplace's built tree, mirroring `CacheBuiltMarketplace`'s
   * own `userCacheRoot`: the version a drift is decided against comes from `builtDir` itself,
   * already built before this runs, never from a path recomputed without one. */
  readonly userCacheRoot: () => string;
}

export interface ActivateNativeToolsDeps {
  readonly registerPluginWithHost: Pick<RegisterPluginWithHost, "execute">;
  readonly buildMarketplace: Pick<BuildMarketplaceForTool, "execute">;
  readonly logger: Logger;
  readonly marketplace: ActivationMarketplace;
  readonly planRefs: Pick<PlanRefsToEnable, "execute">;
}

export class ActivateNativeTools {
  constructor(private readonly deps: ActivateNativeToolsDeps) {}

  /** Never a tool with no native activation, and never one whose binary is absent: neither wrote
   * anything, so a settings file that differs for it differs because a person changed it. */
  async execute(request: ActivateNativeToolsRequest): Promise<ActivationRun> {
    const run: ActivationAccumulator = {
      outcomes: new Map(),
      served: [],
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
    const { manifest, records, marketplaces } = context;
    return this.deps.registerPluginWithHost.execute({
      toolId,
      projectRoot,
      scope,
      marketplaces,
      claims: claims(toolId),
      build: this.builtFor(toolId, projectRoot),
      refsToEnable: (hostNameByAlias) =>
        this.deps.planRefs.execute({
          scope,
          recordedPlugins: manifest
            .getRecordedPlugins(toolId)
            .map(({ plugin, marketplace }) => ({ pluginName: plugin.name, marketplace })),
          marketplaceAliases: marketplaces.map((m) => m.name),
          hostNameByAlias,
          nativeRecord: records.get(toolId),
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
      warnBinaryMissing(this.deps.logger, result.binary, enablePlugins.length > 0);
      run.binaryMissing.push({ toolId, binary: result.binary });
    }
  }

  /** Each catalogue's tree, built for one tool the moment its registration asks for it. */
  private builtFor(toolId: ToolId, projectRoot: string): BuiltCatalogs<SyncedMarketplaces[number]> {
    return (marketplace) => this.deps.buildMarketplace.execute(toolId, marketplace, projectRoot);
  }
}

/** Says a host's CLI is not on the PATH, so its plugins were not activated: with where to rerun
 * once it is, when the run asked for plugins. */
export function warnBinaryMissing(logger: Logger, binary: string, pluginsAsked: boolean): void {
  logger.warn({
    text: `${binary} CLI not found on PATH — skipping native plugin activation.`,
    hint: pluginsAsked ? "rerun-setup-global" : undefined,
  });
}
