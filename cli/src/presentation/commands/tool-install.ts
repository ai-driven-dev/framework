import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import type { AiToolId, IdeToolId } from "../../shared/domain/tool.js";
import { reportNativeActivation } from "../display/sync-display.js";
import { printToolAlreadyInstalled, printToolInstalled } from "../display/tool-config-display.js";
import { render } from "../errors/error-translator.presenter.js";
import { assertKnownToolId, type ToolRun } from "./tool-config-run.js";

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
  deps,
  output,
  projectRoot,
  toolId,
  cmdOptions,
}: ToolRun & {
  toolId: AiToolId;
  cmdOptions: { force: boolean; plugins: boolean };
}): Promise<void> {
  const version = deps.currentVersionProvider.get();
  const result = await deps.installAiToolUseCase.execute({
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
  deps,
  output,
  projectRoot,
  toolId,
  cmdOptions,
}: ToolRun & { toolId: IdeToolId; cmdOptions: { force: boolean } }): Promise<void> {
  const version = deps.currentVersionProvider.get();
  const result = await deps.installIdeToolUseCase.execute({
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
