import type { Command } from "commander";
import {
  agentIdeNames,
  agentProviderNames,
  isAgentProvider,
  resolveAgentHost,
} from "../../contexts/tools/domain/formats/agent-models.js";
import { createDeps } from "../../runtime/wiring/framework.js";
import { ErrorHandler } from "../error-handler.js";
import { parseGlobalOptions, parseScopeFlag } from "./global-options.js";

const SCOPE_HELP = "project (default) or user, the IDE's user configuration directory";

export function registerAgentsCommand(program: Command): void {
  const agents = program
    .command("agents")
    .description("Opt in to native specialist agents for this project");
  agents
    .command("install")
    .description("Install agents with the selected provider's model and effort")
    .requiredOption("--provider <provider>", agentProviderNames().join(", "))
    .requiredOption("--ide <ide>", agentIdeNames().join(", "))
    .option("--main", "also set the provider's main session model in the IDE's settings")
    .option("--scope <scope>", SCOPE_HELP)
    .action(async (options: { provider: string; ide: string; main?: boolean; scope?: string }) => {
      const { projectRoot, verbose, output } = parseGlobalOptions(program);
      try {
        const host = resolveAgentHost(options.ide);
        if (!isAgentProvider(options.provider))
          throw new Error(`Unsupported agent provider: ${options.provider}`);
        const user = parseScopeFlag(options.scope, output) === "user";
        const deps = await createDeps(projectRoot, { verbose }, output);
        const count = await deps.manageAgentsUseCase.install({
          projectRoot,
          host,
          ...(user ? { user: deps.userAgentRoot } : {}),
          provider: options.provider,
          main: options.main === true,
        });
        output.success(
          `${count} agent files installed for ${options.ide}${options.main ? ", main model set" : ""}.`
        );
      } catch (error) {
        new ErrorHandler(output).handle(error);
      }
    });
  agents
    .command("remove")
    .description("Remove unmodified AIDD agents and restore the main model they replaced")
    .requiredOption("--ide <ide>", agentIdeNames().join(", "))
    .option("--scope <scope>", SCOPE_HELP)
    .action(async (options: { ide: string; scope?: string }) => {
      const { projectRoot, verbose, output } = parseGlobalOptions(program);
      try {
        const host = resolveAgentHost(options.ide);
        const user = parseScopeFlag(options.scope, output) === "user";
        const deps = await createDeps(projectRoot, { verbose }, output);
        const count = await deps.manageAgentsUseCase.remove({
          projectRoot,
          host,
          ...(user ? { user: deps.userAgentRoot } : {}),
        });
        output.success(`${count} agent files removed for ${options.ide}.`);
      } catch (error) {
        new ErrorHandler(output).handle(error);
      }
    });
}
