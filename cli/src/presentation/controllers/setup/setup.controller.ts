import type { Command } from "commander";
import type { FrameworkSource } from "../../../contexts/distribution/contract/framework-source.js";
import type { ToolCatalog } from "../../../contexts/tools/contract/tool-catalog.js";
import type { DepsSliceFactory } from "../../../orchestration/deps.js";
import type { Output } from "../../../orchestration/domain/output.js";
import {
  type PluginInstallMode,
  SetupFlow,
} from "../../../orchestration/domain/setup-flow.model.js";
import {
  agentModelsRequest,
  isInteractiveRun,
} from "../../../orchestration/setup/setup-request.js";
import {
  printDetectedContext,
  printNextSteps,
  printSetupOutcome,
  printWelcomeBanner,
} from "../../presenters/setup/setup.presenter.js";
import { reportNativeActivation } from "../../presenters/setup/sync.presenter.js";
import { reportAgentModels } from "../../presenters/tools/agent-models.presenter.js";
import { parseGlobalOptions, parseScopeFlag } from "../menu/global-options.controller.js";
import {
  activatesAtUserScope,
  declareSetupOptions,
  globalSetupHelp,
  parsePluginsFlag,
  parseSourceFlag,
  parseToolIds,
  requireAgentHosts,
  type SetupCatalog,
  type SetupCmdOptions,
} from "./setup-flags.controller.js";

/** What this command reads of the graph. */
type SetupKeys = "runSetup" | "setAgentModels";

interface SetupRequest {
  source: FrameworkSource | undefined;
  scope: ReturnType<typeof parseScopeFlag>;
  toolIds: { aiTools: string[]; ideTools: string[] };
  interactive: boolean;
  plugins: { mode: PluginInstallMode; names: string[] };
}

function parseSetupRequest(
  cmdOptions: SetupCmdOptions,
  output: Output,
  catalog: ToolCatalog
): SetupRequest {
  const source = parseSourceFlag(cmdOptions, output);
  const scope = cmdOptions.global === true ? "user" : parseScopeFlag(cmdOptions.scope, output);
  const toolIds = parseToolIds(cmdOptions, catalog);

  const interactive = isInteractiveRun(process.stdout.isTTY, [
    cmdOptions.source,
    cmdOptions.release,
    cmdOptions.ai,
    cmdOptions.ide,
    cmdOptions.plugins,
    cmdOptions.yes,
    cmdOptions.global,
    cmdOptions.provider,
  ]);
  return {
    source,
    scope,
    toolIds,
    interactive,
    plugins: parsePluginsFlag(cmdOptions.plugins, interactive),
  };
}

function buildSetupFlow(
  { projectRoot, catalog, cmdOptions }: Pick<SetupRun, "projectRoot" | "catalog" | "cmdOptions">,
  request: SetupRequest
): SetupFlow {
  return new SetupFlow({
    projectRoot,
    registeredToolIds: catalog.idsInCanonicalOrder(),
    aiToolIds: catalog.idsInCanonicalOrder("ai"),
    ideToolIds: catalog.idsInCanonicalOrder("ide"),
    supportsUserScopeActivation: (id) => activatesAtUserScope(catalog.profile(id)),
    source: request.source,
    aiTools: request.toolIds.aiTools,
    ideTools: request.toolIds.ideTools,
    pluginMode: request.plugins.mode,
    pluginNames: request.plugins.names,
    interactive: request.interactive,
    force: false,
    registerDefaultMarketplace: cmdOptions.defaultMarketplace !== false,
    scope: request.scope,
  });
}

interface SetupRun {
  verbose: boolean;
  output: Output;
  projectRoot: string;
  catalog: ToolCatalog;
  createDeps: DepsSliceFactory<SetupKeys>;
  cmdOptions: SetupCmdOptions;
}

async function runSetupAction(run: SetupRun): Promise<void> {
  const { verbose, output, projectRoot, catalog, createDeps, cmdOptions } = run;
  const request = parseSetupRequest(cmdOptions, output, catalog);
  const { interactive, scope } = request;
  const flow = buildSetupFlow(run, request);
  const { runnable, ...agents } = agentModelsRequest(
    cmdOptions.provider,
    request.toolIds.aiTools,
    catalog
  );
  requireAgentHosts(cmdOptions.provider, { hosts: agents.hosts, runnable });

  if (interactive) printWelcomeBanner(output);

  const deps = await createDeps(projectRoot, { verbose }, output);
  const result = await deps.runSetup.execute(flow);

  if (interactive && result.context !== undefined) {
    printDetectedContext(output, result.context.describe());
  }
  printSetupOutcome(output, result, verbose);
  // Once the install has succeeded: the provider and the main session's model hold for
  // every project on the machine, so a failed install leaves both as they were.
  if (cmdOptions.provider !== undefined) {
    const main = await deps.setAgentModels.execute({
      projectRoot,
      ...agents,
      scope: scope ?? "project",
    });
    reportAgentModels({
      output,
      catalog,
      provider: agents.provider,
      hosts: agents.hosts,
      main,
    });
  }
  if (interactive) printNextSteps(output, result.install.results.length > 0);
  reportNativeActivation(output, result.activation);
}

export function registerSetupCommand(
  program: Command,
  catalog: SetupCatalog,
  createDeps: DepsSliceFactory<SetupKeys>
): void {
  declareSetupOptions(program.command("setup"), catalog)
    .description(
      "Set up or update the project to a correct state — bootstraps the whole project (marketplace, framework, tools, plugins); see `framework install`, which acts on the framework alone"
    )
    .addHelpText("after", () => globalSetupHelp(catalog))
    .action(async (cmdOptions: SetupCmdOptions) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      await runSetupAction({ verbose, output, projectRoot, catalog, createDeps, cmdOptions });
    });
}
