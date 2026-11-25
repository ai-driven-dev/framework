import type { Command } from "commander";
import type { ToolCatalog } from "../../../contexts/tools/contract/tool-catalog.js";
import {
  type ContainerFactory,
  GLOBAL_FLAG_HELP,
  parseGlobalOptions,
  resolveScopeFlags,
} from "../menu/global-options.controller.js";
import { runFullDoctor, runScopedDoctor } from "./doctor-project.controller.js";
import type { DoctorCmdOptions, DoctorContainer } from "./doctor-run.controller.js";
import { runUserScopeDoctor } from "./doctor-user-scope.controller.js";

export function registerDoctorCommand(
  program: Command,
  tools: ToolCatalog,
  containerOf: ContainerFactory<DoctorContainer>
): void {
  program
    .command("doctor")
    .description(
      "Detected and equipped tools, plugins, drift, and problems — across all tools or one"
    )
    .option("--tool <tool>", "Limit to a specific AI or IDE tool")
    .option("--plugin <name>", "Limit plugin checks to a specific plugin")
    .option(
      "--scope <scope>",
      "project (default) checks this project's own manifest; user checks the " +
        "machine-wide manifest --scope user setup wrote"
    )
    .option("--global", GLOBAL_FLAG_HELP)
    .action(async (cmdOptions: DoctorCmdOptions) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const container = await containerOf(projectRoot, { verbose }, output);
      const scope = resolveScopeFlags(cmdOptions, output) ?? "project";
      if (scope === "user") {
        await runUserScopeDoctor({ tools, container, output, projectRoot, cmdOptions });
      } else if (cmdOptions.tool !== undefined) {
        await runScopedDoctor({
          container,
          output,
          projectRoot,
          toolId: cmdOptions.tool,
          tools,
          pluginName: cmdOptions.plugin,
        });
      } else {
        await runFullDoctor({ container, output, projectRoot, pluginName: cmdOptions.plugin });
      }
    });
}
