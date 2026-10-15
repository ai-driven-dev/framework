import type { Command } from "commander";
import {
  agentIdeNames,
  isAgentProvider,
  resolveAgentHost,
} from "../../contexts/tools/domain/formats/agent-models.js";
import { createDeps } from "../../runtime/wiring/framework.js";
import { ErrorHandler } from "../error-handler.js";
import { parseGlobalOptions } from "./global-options.js";

export function registerAgentsCommand(program: Command): void {
  const agents = program
    .command("agents")
    .description("Opt in to native specialist agents for this project");
  agents
    .command("install")
    .description("Install agents with the selected provider's model and effort")
    .requiredOption("--provider <provider>", "openai or anthropic")
    .requiredOption("--ide <ide>", agentIdeNames().join(", "))
    .action(async (options: { provider: string; ide: string }) => {
      const { projectRoot, verbose, output } = parseGlobalOptions(program);
      try {
        const host = resolveAgentHost(options.ide);
        if (!isAgentProvider(options.provider))
          throw new Error(`Unsupported agent provider: ${options.provider}`);
        const deps = await createDeps(projectRoot, { verbose }, output);
        const count = await deps.manageAgentsUseCase.install({
          projectRoot,
          host,
          provider: options.provider,
        });
        output.success(`${count} agent files installed for ${options.ide}.`);
      } catch (error) {
        new ErrorHandler(output).handle(error);
      }
    });
  agents
    .command("remove")
    .description("Remove unmodified AIDD agents from this project")
    .requiredOption("--ide <ide>", agentIdeNames().join(", "))
    .action(async (options: { ide: string }) => {
      const { projectRoot, verbose, output } = parseGlobalOptions(program);
      try {
        const host = resolveAgentHost(options.ide);
        const deps = await createDeps(projectRoot, { verbose }, output);
        const count = await deps.manageAgentsUseCase.remove({ projectRoot, host });
        output.success(`${count} agent files removed for ${options.ide}.`);
      } catch (error) {
        new ErrorHandler(output).handle(error);
      }
    });
}
