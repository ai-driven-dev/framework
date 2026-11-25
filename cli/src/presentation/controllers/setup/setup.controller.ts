import type { Command } from "commander";
import { agentModelsRequest } from "../../../contexts/tools/contract/agent-models-request.model.js";
import type { ToolCatalog } from "../../../contexts/tools/contract/tool-catalog.js";
import type { SetAgentModels } from "../../../orchestration/agent-models/set-agent-models.use-case.js";
import type { RunSetup } from "../../../orchestration/setup/run-setup.use-case.js";
import type { Scope } from "../../../shared/domain/scope.js";
import {
  printDetectedContext,
  printNextSteps,
  printSetupOutcome,
  printWelcomeBanner,
} from "../../presenters/setup/setup.presenter.js";
import { reportNativeActivation } from "../../presenters/setup/sync.presenter.js";
import { reportAgentModels } from "../../presenters/tools/agent-models.presenter.js";
import type { Output } from "../../terminal/output.model.js";
import { type ContainerFactory, parseGlobalOptions } from "../menu/global-options.controller.js";
import { declareAgentModelOptions, requireAgentHosts } from "./setup-agent-flags.controller.js";
import {
  declareSetupOptions,
  globalSetupHelp,
  type SetupCatalog,
  type SetupCmdOptions,
} from "./setup-flags.controller.js";
import { buildSetupFlow, parseSetupRequest } from "./setup-request.controller.js";

/** What this command reads of the container. */
export interface SetupContainer {
  setup: { runSetup: Pick<RunSetup, "execute"> };
  agentModels: { setAgentModels: Pick<SetAgentModels, "execute"> };
}

interface SetupRun {
  verbose: boolean;
  output: Output;
  projectRoot: string;
  catalog: ToolCatalog;
  containerOf: ContainerFactory<SetupContainer>;
  cmdOptions: SetupCmdOptions;
}

type AgentModelsChoice = Pick<ReturnType<typeof agentModelsRequest>, "hosts" | "provider"> & {
  /** No provider named: each host keeps the one saved for it. */
  keepSaved: boolean;
};

/** The agents' models the flags ask for, refused before anything is built or written;
 * undefined when the flags ask for none. */
function parseAgentModels(
  run: SetupRun,
  aiTools: readonly string[]
): AgentModelsChoice | undefined {
  const { cmdOptions, catalog } = run;
  const keepSaved = cmdOptions.provider === undefined;
  if (keepSaved && cmdOptions.agentsOnly !== true) return undefined;
  const { runnable, ...agents } = agentModelsRequest(cmdOptions.provider, aiTools, catalog);
  requireAgentHosts(keepSaved ? "--agents-only" : "--provider", { hosts: agents.hosts, runnable });
  return { ...agents, keepSaved };
}

/** Once the install has succeeded: the provider and, unless asked otherwise, the main session's
 * model hold for every project on the machine, so a failed install leaves both as they were. */
async function setAgentModels(
  run: SetupRun,
  container: SetupContainer,
  { agents, scope }: { agents: AgentModelsChoice; scope: Scope | undefined }
): Promise<void> {
  const { output, projectRoot, catalog, cmdOptions } = run;
  const { agentsOnly } = cmdOptions;
  const main = await container.agentModels.setAgentModels.execute({
    projectRoot,
    ...agents,
    scope: scope ?? "project",
    agentsOnly,
  });
  reportAgentModels({ output, catalog, ...agents, main, agentsOnly });
}

async function runSetupAction(run: SetupRun): Promise<void> {
  const { verbose, output, projectRoot, catalog, containerOf, cmdOptions } = run;
  const request = parseSetupRequest(cmdOptions, output, catalog);
  const { interactive, scope } = request;
  const flow = buildSetupFlow(run, request);
  const agents = parseAgentModels(run, request.toolIds.aiTools);

  if (interactive) printWelcomeBanner(output);

  const container = await containerOf(projectRoot, { verbose }, output);
  const result = await container.setup.runSetup.execute(flow);

  if (interactive && result.context !== undefined) {
    printDetectedContext(output, result.context.describe());
  }
  printSetupOutcome(output, result, verbose);
  if (agents !== undefined) await setAgentModels(run, container, { agents, scope });
  if (interactive) printNextSteps(output, result.install.results.length > 0);
  reportNativeActivation(output, result.activation);
}

export function registerSetupCommand(
  program: Command,
  catalog: SetupCatalog,
  containerOf: ContainerFactory<SetupContainer>
): void {
  declareAgentModelOptions(declareSetupOptions(program.command("setup"), catalog), catalog)
    .description(
      "Set up or update the project to a correct state — bootstraps the whole project (marketplace, framework, tools, plugins); see `framework install`, which acts on the framework alone"
    )
    .addHelpText("after", () => globalSetupHelp(catalog))
    .action(async (cmdOptions: SetupCmdOptions) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      await runSetupAction({ verbose, output, projectRoot, catalog, containerOf, cmdOptions });
    });
}
