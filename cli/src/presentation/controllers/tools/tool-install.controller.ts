import type { ToolCatalog } from "../../../contexts/tools/contract/tool-catalog.js";
import type { AiToolId, IdeToolId } from "../../../shared/domain/tool.js";
import { render } from "../../errors/error-translator.presenter.js";
import { reportNativeActivation } from "../../presenters/setup/sync.presenter.js";
import {
  printToolAlreadyInstalled,
  printToolInstalled,
} from "../../presenters/tools/tool-config.presenter.js";
import { assertKnownToolId } from "../../presenters/tools/tool-id.presenter.js";
import type { ToolRun } from "./tool-config-run.controller.js";

export async function installTool({
  raw,
  cmdOptions,
  catalog,
  ...run
}: ToolRun & {
  raw: string;
  cmdOptions: { force: boolean; plugins: boolean };
  catalog: ToolCatalog;
}): Promise<void> {
  const toolId = assertKnownToolId(raw, catalog);
  if (catalog.isAiTool(toolId)) {
    await installAiTool({ ...run, toolId, cmdOptions });
  } else {
    await installIdeTool({ ...run, toolId, cmdOptions });
  }
}

async function installAiTool({
  container,
  output,
  projectRoot,
  toolId,
  cmdOptions,
}: ToolRun & {
  toolId: AiToolId;
  cmdOptions: { force: boolean; plugins: boolean };
}): Promise<void> {
  const version = container.shared.currentVersion;
  const result = await container.global.installAiToolWithPlugins.execute({
    toolId,
    projectRoot,
    force: cmdOptions.force,
    version,
    propagatePlugins: cmdOptions.plugins,
  });
  if (result.runtimeResult.skipped) {
    printToolAlreadyInstalled(output, toolId);
    return;
  }
  printToolInstalled(output, {
    toolId,
    fileCount: result.runtimeResult.fileCount,
    warnings: [
      ...result.runtimeResult.warnings,
      ...result.propagationWarnings.map(
        ({ text, cause }) => text + (cause === undefined ? "" : render(cause))
      ),
    ],
  });
  if (result.activation !== undefined) reportNativeActivation(output, result.activation);
}

async function installIdeTool({
  container,
  output,
  projectRoot,
  toolId,
  cmdOptions,
}: ToolRun & { toolId: IdeToolId; cmdOptions: { force: boolean } }): Promise<void> {
  const version = container.shared.currentVersion;
  const result = await container.global.installIdeTool.execute({
    toolId,
    projectRoot,
    force: cmdOptions.force,
    version,
  });
  if (result.skipped) {
    printToolAlreadyInstalled(output, result.toolId);
    return;
  }
  printToolInstalled(output, {
    toolId: result.toolId,
    fileCount: result.fileCount,
    warnings: result.warnings,
  });
}
