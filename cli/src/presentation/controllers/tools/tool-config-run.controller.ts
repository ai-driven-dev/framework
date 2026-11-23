import type { InstallIdeTool } from "../../../contexts/installation/application/install/install-ide-tool.use-case.js";
import type { ListInstalledRules } from "../../../contexts/installation/application/list-installed-rules.use-case.js";
import type { UninstallProjectTools } from "../../../orchestration/clean/uninstall-project-tools.use-case.js";
import type { Output } from "../../../orchestration/domain/output.js";
import type { InstallAiToolWithPlugins } from "../../../orchestration/setup/install-ai-tool-with-plugins.use-case.js";
import type { UpdateTools } from "../../../orchestration/sync/update-tools.use-case.js";

/** What the tool commands read of the container. */
export interface ToolConfigContainer {
  shared: { currentVersion: string };
  global: {
    installAiToolWithPlugins: Pick<InstallAiToolWithPlugins, "execute">;
    installIdeTool: Pick<InstallIdeTool, "execute">;
    updateTools: Pick<UpdateTools, "execute">;
  };
  clean: { uninstallTools: Pick<UninstallProjectTools, "execute"> };
  installation: { listInstalledRules: Pick<ListInstalledRules, "execute"> };
}

/** What every tool command is given: the container it reads, where it writes, and the project. */
export interface ToolRun {
  container: ToolConfigContainer;
  output: Output;
  projectRoot: string;
}
