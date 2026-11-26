import type { SyncServerPlugins } from "../../../../contexts/host-registration/application/server/sync-server-plugins.use-case.js";
import type { ToolId } from "../../../../shared/domain/tool.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import {
  type ActivateNativeTools,
  type ActivateNativeToolsRequest,
  type ActivationRun,
  warnBinaryMissing,
} from "../activate-native-tools.use-case.js";
import type { BuildMarketplaceForTool } from "../build-marketplace-for-tool.use-case.js";

export interface ActivateHostToolsDeps {
  readonly native: Pick<ActivateNativeTools, "execute">;
  /** A host with no plugin verbs, which takes plugins through its own server. */
  readonly serverPlugins: Pick<SyncServerPlugins, "execute">;
  readonly buildMarketplace: Pick<BuildMarketplaceForTool, "execute">;
  readonly logger: Logger;
  /** The name the framework marketplace is registered under: the plugins a run asks for are its. */
  readonly frameworkName: string;
}

/** What one tool's server added to the run: the same answers an activation reports. */
type Served = Omit<ActivationRun, "outcomes">;

const NOTHING: Served = { served: [], binaryMissing: [], warnings: [], errors: [] };

/**
 * Activates every tool the machine installed plugins for: the ones whose own CLI enables them, then
 * the ones whose host takes them through its own server, installed from the framework's tree. The
 * server is the user's, so a project run leaves it alone. A tool's failure is returned as an error
 * and the rest go on.
 */
export class ActivateHostTools {
  constructor(private readonly deps: ActivateHostToolsDeps) {}

  async execute(request: ActivateNativeToolsRequest): Promise<ActivationRun> {
    const run = await this.deps.native.execute(request);
    if (request.scope !== "user") return run;
    const results: Served[] = [run];
    for (const toolId of request.context.toolIds) {
      results.push(await this.serve(toolId, request));
    }
    return {
      outcomes: run.outcomes,
      served: results.flatMap((result) => result.served),
      binaryMissing: results.flatMap((result) => result.binaryMissing),
      warnings: results.flatMap((result) => result.warnings),
      errors: results.flatMap((result) => result.errors),
    };
  }

  private async serve(toolId: ToolId, request: ActivateNativeToolsRequest): Promise<Served> {
    try {
      const result = await this.deps.serverPlugins.execute({
        toolId,
        names: request.enablePlugins,
        builtDir: () => this.builtDir(toolId, request),
      });
      if (result.status === "binary-missing") {
        warnBinaryMissing(this.deps.logger, result.binary, request.enablePlugins.length > 0);
        return { ...NOTHING, binaryMissing: [{ toolId, binary: result.binary }] };
      }
      if (result.status !== "installed") return NOTHING;
      for (const problem of result.problems) this.deps.logger.warn(problem);
      return {
        ...NOTHING,
        served: result.installed.length > 0 ? [toolId] : [],
        warnings: result.problems,
      };
    } catch (error) {
      return { ...NOTHING, errors: [{ scope: toolId, error }] };
    }
  }

  private async builtDir(
    toolId: ToolId,
    { context, projectRoot }: ActivateNativeToolsRequest
  ): Promise<string | null> {
    const framework = context.marketplaces.find(
      (marketplace) => marketplace.name === this.deps.frameworkName
    );
    return framework === undefined
      ? null
      : this.deps.buildMarketplace.execute(toolId, framework, projectRoot);
  }
}
