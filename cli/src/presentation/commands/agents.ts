import type { Command } from "commander";
import {
  AGENT_MODELS,
  type AgentHost,
  agentProviders,
  isAgentHost,
} from "../../contexts/tools/domain/formats/agent-models.js";
import { createDeps } from "../../runtime/wiring/framework.js";
import { ErrorHandler } from "../error-handler.js";
import type { CLIOutput } from "../output.js";
import { parseGlobalOptions } from "./global-options.js";

const HOSTS = Object.keys(AGENT_MODELS.hosts).join(", ");
const GLOBAL_HELP = "write the main model in the IDE's user settings instead of this project's";

function parseHosts(value: string): AgentHost[] {
  const ids = value.split(",").map((id) => id.trim());
  const unknown = ids.filter((id) => !isAgentHost(id));
  if (unknown.length > 0) throw new Error(`Unknown IDE: ${unknown.join(", ")}. Use: ${HOSTS}.`);
  return ids as AgentHost[];
}

interface SetModelOptions {
  ide: string;
  main?: boolean;
  global?: boolean;
}

async function setModel(
  program: Command,
  provider: string | undefined,
  options: SetModelOptions
): Promise<void> {
  const { projectRoot, verbose, output } = parseGlobalOptions(program);
  try {
    const hosts = parseHosts(options.ide);
    const deps = await createDeps(projectRoot, { verbose }, output);
    const result = await deps.setAgentModelUseCase.execute({
      projectRoot,
      hosts,
      provider,
      main: options.main === true,
      scope: options.global === true ? "user" : "project",
    });
    report(output, provider, hosts, result, options.main === true);
  } catch (error) {
    new ErrorHandler(output).handle(error);
  }
}

function report(
  output: CLIOutput,
  provider: string | undefined,
  hosts: readonly AgentHost[],
  result: { mainSet: readonly AgentHost[]; reinstalled: readonly string[] },
  main: boolean
): void {
  const agents =
    provider === undefined
      ? `Agents for ${hosts.join(", ")} run on the session's model.`
      : `Agents for ${hosts.join(", ")} run on ${provider}.`;
  output.success(agents);
  output.info("Other projects on this machine pick it up at their next aidd update.");
  if (result.mainSet.length > 0) output.success(`Main model set for ${result.mainSet.join(", ")}.`);
  const skipped = main ? hosts.filter((host) => !result.mainSet.includes(host)) : [];
  if (skipped.length > 0) {
    output.warn(`No main-model setting at this scope for ${skipped.join(", ")}; left unchanged.`);
  }
  if (result.reinstalled.length > 0) output.info(`Reinstalled: ${result.reinstalled.join(", ")}.`);
}

export function registerAgentsCommand(program: Command): void {
  const agents = program
    .command("agents")
    .description("Choose the models the framework's agents run on");
  agents
    .command("set-model")
    .description(
      "Run each IDE's agents on the provider's model for their role, on this machine, and re-install this project's plugins with them"
    )
    .argument("<provider>", agentProviders().join(", "))
    .requiredOption("--ide <ids>", `Comma-separated IDEs: ${HOSTS}`)
    .option("--main", "also run the main session on the provider's smart model")
    .option("--global", GLOBAL_HELP)
    .action((provider: string, options: SetModelOptions) => setModel(program, provider, options));
  agents
    .command("unset-model")
    .description("Give each IDE's agents back the session's model, and restore the main model")
    .requiredOption("--ide <ids>", `Comma-separated IDEs: ${HOSTS}`)
    .option("--global", GLOBAL_HELP)
    .action((options: SetModelOptions) => setModel(program, undefined, options));
}
